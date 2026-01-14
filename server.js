require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const { OpenAI } = require('openai');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// Инициализация БД
const db = new Database('football_memory.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY,
    competition TEXT,
    home_team TEXT,
    away_team TEXT,
    score TEXT,
    date TEXT
  );
  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name TEXT,
    prediction TEXT,
    actual_result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// --- КЭШИРОВАНИЕ ---
let cachedLeagueData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 минут

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Вспомогательная функция сохранения в БД
const saveMatchToMemory = (match) => {
    const insert = db.prepare(`INSERT OR REPLACE INTO matches (id, competition, home_team, away_team, score, date) VALUES (?, ?, ?, ?, ?, ?)`);
    const scoreText = match.score?.fullTime?.home !== null ? `${match.score.fullTime.home}:${match.score.fullTime.away}` : 'scheduled';
    insert.run(match.id, match.competition.name, match.homeTeam.name, match.awayTeam.name, scoreText, match.utcDate);
};

// 1. Оптимизированный эндпоинт для лиги (с кэшем)
app.get('/api/leagues/premier-league', async (req, res) => {
    const now = Date.now();
    if (cachedLeagueData && (now - lastFetchTime < CACHE_DURATION)) {
        return res.json(cachedLeagueData);
    }

    try {
        const response = await axios.get('api.football-data.org', {
            headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
        });

        cachedLeagueData = {
            matchCount: response.data.matches.length,
            matches: response.data.matches.slice(0, 10)
        };
        lastFetchTime = now;

        // Фоновое сохранение в БД для обучения ИИ
        response.data.matches.forEach(saveMatchToMemory);

        res.json(cachedLeagueData);
    } catch (error) {
        console.error('API Error:', error.message);
        if (cachedLeagueData) return res.json(cachedLeagueData);
        res.status(500).json({ error: 'Ошибка получения данных' });
    }
});

// 2. Бот
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `Привет, ${msg.from.first_name}! ⚽ Аналитика АПЛ готова.`, {
        reply_markup: { inline_keyboard: [[{ text: "📊 Открыть приложение", web_app: { url: process.env.WEBAPP_URL } }]] }
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Сервер: http://localhost:${PORT}`));
