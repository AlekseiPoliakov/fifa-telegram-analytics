require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const cors = require('cors');
const fs = require('fs');
const squadsData = require('./squads.json');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new Database('football_memory.db');
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Инициализация БД
db.exec(`
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY,
    competition TEXT,
    home_team TEXT,
    away_team TEXT,
    score TEXT,
    date TEXT
  );
`);

// --- MIDDLEWARE: ПРОВЕРКА БЕЗОПАСНОСТИ ---
const verifyTelegramWebAppData = (req, res, next) => {
    if (req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
        return next();
    }
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    const [authType, rawInitData] = authHeader.split(' ');
    if (authType !== 'twa') return res.status(401).json({ error: "Invalid auth type" });

    try {
        const urlParams = new URLSearchParams(rawInitData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');

        const dataCheckString = Array.from(urlParams.entries())
            .map(([key, value]) => `${key}=${value}`)
            .sort()
            .join('\n');

        const secretKey = crypto.createHmac('sha256', 'WebAppData')
            .update(process.env.TELEGRAM_BOT_TOKEN)
            .digest();

        const hmac = crypto.createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        if (hmac === hash) {
            next();
        } else {
            res.status(403).json({ error: "Data integrity error" });
        }
    } catch (e) {
        res.status(500).json({ error: "Internal security check error" });
    }
};

// --- API ЭНДПОИНТЫ ---

// 1. Получить список всех команд АПЛ
app.get('/api/teams', verifyTelegramWebAppData, async (req, res) => {
    try {
        const response = await axios.get('https://api.football-data.org/v4/competitions/PL/teams', {
            headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
        });
        const teams = response.data.teams.map(team => ({
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            tla: team.tla,
            crest: team.crest
        }));
        res.json(teams);
    } catch (error) {
        console.error('Teams Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

// --- КОНФИГУРАЦИЯ КЭША ---
const cache = {
    standings: { data: null, lastFetch: 0 },
    matches: new Map(),
    teams: { data: null, lastFetch: 0 },
    teamDetails: new Map(),
    teamStats: new Map() 
};

const CACHE_DURATION = 10 * 60 * 1000;

// 2. Получить календарь матчей конкретной команды
app.get('/api/teams/:id/matches', verifyTelegramWebAppData, async (req, res) => {
    const teamId = req.params.id;
    const now = Date.now();
    const cachedTeam = cache.matches.get(teamId);

    // 1. Проверка кэша (чтобы не тратить 10 запросов в минуту)
    if (cachedTeam && (now - cachedTeam.lastFetch < CACHE_DURATION)) {
        return res.json(cachedTeam.data);
    }

    try {
        // 2. Запрос: только статус SCHEDULED (запланированные) 
        // Мы берем limit=10, и это будут первые 10 матчей от СЕГОДНЯШНЕГО дня в будущее.
        const response = await axios.get(`https://api.football-data.org/v4/teams/${teamId}/matches?status=SCHEDULED&limit=10`, {
            headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
        });

        const matches = response.data.matches;

        // 3. Сохраняем в кэш
        cache.matches.set(teamId, {
            data: matches,
            lastFetch: now
        });

        console.log(`🌍 Получены свежие матчи для команды ${teamId} (кол-во: ${matches.length})`);
        res.json(matches);

    } catch (error) {
        console.error('Ошибка API матчей:', error.message);
        // Если будущих матчей нет вообще, API может вернуть 404 или пустой массив
        res.json([]);
    }
});

// 1.5 Получить турнирную таблицу (с кэшированием)
app.get('/api/standings', verifyTelegramWebAppData, async (req, res) => {
    const now = Date.now();
    if (cache.standings.data && (now - cache.standings.lastFetch < CACHE_DURATION)) {
        console.log('📦 Возвращаем таблицу из кэша');
        return res.json(cache.standings.data);
    }

    try {
        const response = await axios.get('https://api.football-data.org/v4/competitions/PL/standings', {
            headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
        });

        cache.standings.data = response.data;
        cache.standings.lastFetch = now;

        console.log('🌍 Запрос к API выполнен (Таблица)');
        res.json(response.data);
    } catch (error) {
        console.error('Standings Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch standings' });
    }
});

// 2.5 Получить состав и детали конкретной команды
app.get('/api/v2/squad/:teamId', verifyTelegramWebAppData, (req, res) => {
    const teamId = req.params.teamId;

    if (squadsData[teamId]) {
        console.log(`✅ Отдан локальный состав для команды ${teamId}`);
        res.json(squadsData[teamId]);
    } else {
        console.log(`⚠️ Состав для ID ${teamId} не найден в squads.json`);
        res.status(404).json({ error: 'Squad not found' });
    }
});

// Эндпоинт для AI анализа
app.get('/api/analyze/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;
        const IAM_TOKEN = process.env.YANDEX_API_KEY;
        const FOLDER_ID = process.env.YANDEX_FOLDER_ID;
        const FOOTBALL_API_KEY = process.env.FOOTBALL_DATA_API_KEY;

        // 1. Собираем данные: Информация о команде + Последние 5 матчей
        let teamName = "команда АПЛ";
        let matchesContext = "Данные о последних матчах недоступны";

        try {
            const [teamInfo, matchesInfo] = await Promise.all([
                axios.get(`https://api.football-data.org/v4/teams/${teamId}`, {
                    headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
                }),
                axios.get(`https://api.football-data.org/v4/teams/${teamId}/matches?status=FINISHED&limit=5`, {
                    headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
                })
            ]);

            teamName = teamInfo.data.name;

            // Формируем список результатов для Промпта
            matchesContext = matchesInfo.data.matches.map(m => {
                const isHome = m.homeTeam.id == teamId;
                const opponent = isHome ? m.awayTeam.name : m.homeTeam.name;
                const score = `${m.score.fullTime.home}:${m.score.fullTime.away}`;
                return `- ${isHome ? 'Дома' : 'В гостях'} против ${opponent} (${score})`;
            }).join('\n');

        } catch (e) {
            console.log("⚠️ Ошибка при сборе футбольных данных:", e.message);
        }

        console.log(`--- Анализ КРИСТАЛЛ для: ${teamName} (ID: ${teamId}) ---`);

        // 2. Формируем расширенный промпт с учетом реальных результатов
        const prompt = {
            modelUri: `gpt://${FOLDER_ID}/yandexgpt/latest`,
            completionOptions: { stream: false, temperature: 0.5, maxTokens: "2000" },
            messages: [
                {
                    role: "system",
                    text: "Ты — экспертный футбольный аналитик системы 'КРИСТАЛЛ'. Твой стиль: профессиональный, лаконичный, основанный на фактах. Ты используешь терминологию: билд-ап, низкий блок, xG-эффективность, переходные фазы."
                },
                {
                    role: "user",
                    text: `Подготовь глубокий технический отчет по команде "${teamName}". 

📊 **ПОСЛЕДНИЕ РЕЗУЛЬТАТЫ (ДЛЯ СПРАВКИ):**
${matchesContext}

Используй эти цифры для формирования отчета по структуре:

⚽ **ТАКТИЧЕСКИЙ ПРОФИЛЬ**
- **Стиль:** [Опиши: владение, контратаки или лонгболлы]
- **Переходные фазы:** [Как команда переходит из обороны в атаку]

🛡️ **АНАЛИЗ ТЕКУЩЕЙ ФОРМЫ (НА ОСНОВЕ ЦИФР)**
- **Оборона:** [Оцени пропущенные голы в последних 5 матчах. Укажи на слабые места]
- **Реализация:** [Посмотри на забитые мячи. Есть ли проблемы с атакой?]

🔮 **ВЕРДИКТ КРИСТАЛЛ**
- **Прогноз:** [Дай конкретный шанс в % на победу в следующем матче. Какой главный риск?]

ВАЖНО: Пиши как профи, используй **жирный шрифт** для терминов. Не лей воду, опирайся на предоставленные результаты матчей.`
                }
            ]
        };

        const response = await axios.post(
            'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
            prompt,
            {
                headers: {
                    'Authorization': `Api-Key ${IAM_TOKEN}`,
                    'x-folder-id': FOLDER_ID,
                    'Content-Type': 'application/json'
                }
            }
        );

        const analysisText = response.data.result.alternatives[0].message.text;
        res.json({ analysis: analysisText });

    } catch (error) {
        console.error('❌ Ошибка анализа:', error.message);
        res.status(500).json({ error: 'ИИ не смог подготовить отчет' });
    }
});

app.get('/api/teams/:id/stats', verifyTelegramWebAppData, async (req, res) => {
    const teamId = req.params.id;
    const now = Date.now();

    // Защита от undefined
    if (!cache.teamStats) cache.teamStats = new Map();

    const cached = cache.teamStats.get(teamId);
    if (cached && (now - cached.lastFetch < CACHE_DURATION)) {
        return res.json(cached.data);
    }

    try {
        let standingsData;
        if (cache.standings.data && (now - cache.standings.lastFetch < CACHE_DURATION)) {
            standingsData = cache.standings.data;
        } else {
            const response = await axios.get('https://api.football-data.org/v4/competitions/PL/standings', {
                headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
            });
            standingsData = response.data;
            cache.standings.data = standingsData;
            cache.standings.lastFetch = now;
        }

        const table = standingsData.standings[0].table;
        const team = table.find(t => t.team.id == teamId);

        if (!team) return res.status(404).json({ error: 'Team not found' });

        const processedStats = {
            position: team.position,
            winRate: Math.round((team.won / (team.playedGames || 1)) * 100),
            goals: { scored: team.goalsFor, conceded: team.goalsAgainst },
            form: team.form ? team.form.replace(/,/g, '') : '???'
        };

        cache.teamStats.set(teamId, { data: processedStats, lastFetch: now });
        res.json(processedStats);
    } catch (error) {
        console.error('Статистика упала:', error.message);
        res.status(500).json({ error: 'API error' });
    }
});

// Запуск бота
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `Привет, ${msg.from.first_name}! ⚽\nНажми на кнопку ниже, чтобы войти в дашборд аналитики.`, {
        reply_markup: {
            inline_keyboard: [[
                { text: "📊 Аналитика АПЛ", web_app: { url: process.env.WEBAPP_URL } }
            ]]
        }
    });
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name;
  console.log(`-----------------------------------`);
  console.log(`🔔 ПОЛУЧЕНО СООБЩЕНИЕ ОТ: ${firstName}`);
  console.log(`🆔 ТВОЙ НАСТОЯЩИЙ ID: ${chatId}`);
  console.log(`-----------------------------------`);

  // Бот сам ответит тебе твоим же ID
  bot.sendMessage(chatId, `Твой ID: ${chatId}. Скопируй его в .env`);
});

// Проверка связи при старте сервера
app.listen(PORT, async () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    
    const myChatId = process.env.ADMIN_CHAT_ID;
    if (myChatId) {
        try {
            await bot.sendMessage(myChatId, "🚀 **Сервер Titanium запущен!** Связь с админом установлена.");
            console.log("📡 Тестовое сообщение админу отправлено успешно!");
        } catch (e) {
            console.log("⚠️ Тестовое сообщение не ушло. Бот всё еще не видит чат с тобой.");
        }
    }
});

bot.on("message", (msg) => {
  console.log(`🔔 Бот получил сообщение от: ${msg.from.first_name}`);
  console.log(`🆔 Его реальный ID: ${msg.from.id}`);
});

// Исправленный эндпоинт обратной связи
app.post('/api/feedback', verifyTelegramWebAppData, async (req, res) => {
    try {
        const { userId, username, message } = req.body;
        const myChatId = process.env.ADMIN_CHAT_ID;

        const htmlText = `
<b>🚀 Новый отзыв Titanium</b>
<b>👤 От:</b> ${username}
<b>🆔 ID:</b> ${userId}
<b>📝 Сообщение:</b> ${message}
        `.trim();

        // Отправляем через уже инициализированный объект bot
        await bot.sendMessage(myChatId, htmlText, { parse_mode: 'HTML' });

        console.log(`📩 Сообщение от ${username} доставлено`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Ошибка отправки в TG:', error.message);
        res.status(500).json({ error: 'Ошибка отправки' });
    }
});