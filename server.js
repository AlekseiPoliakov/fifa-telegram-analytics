require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const { OpenAI } = require('openai');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new Database('football_memory.db');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

// 2. Получить календарь матчей конкретной команды
app.get('/api/teams/:id/matches', verifyTelegramWebAppData, async (req, res) => {
    const teamId = req.params.id;
    try {
        const response = await axios.get(`https://api.football-data.org/v4/teams/${teamId}/matches?status=SCHEDULED`, {
            headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
        });
        // Возвращаем ближайшие 5 матчей
        res.json(response.data.matches.slice(0, 5));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch matches' });
    }
});

// 3. Анализ ИИ (OpenAI)
app.post('/api/analyze', verifyTelegramWebAppData, async (req, res) => {
    const { homeTeam, awayTeam, date } = req.body;
    console.log(`🤖 Анализ запрошен: ${homeTeam} vs ${awayTeam}`);

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "Ты — профессиональный футбольный аналитик АПЛ. Твои ответы коротки (до 300 знаков), аргументированы и содержат предполагаемый счет." },
                { role: "user", content: `Дай прогноз: ${homeTeam} против ${awayTeam}, матч состоится ${date}. Вероятный исход?` }
            ],
            max_tokens: 150
        });

        res.json({ analysis: completion.choices[0].message.content });
    } catch (error) {
        console.error('OpenAI Error:', error.message);
        res.status(500).json({ analysis: "Извините, футбольный оракул временно недоступен. Попробуйте позже!" });
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

app.listen(PORT, () => {
    console.log(`
    ✅ Сервер запущен на порту ${PORT}
    🏠 Локально: http://localhost:${PORT}
    🤖 Бот активен
    `);
});