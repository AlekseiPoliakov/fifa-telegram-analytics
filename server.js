require('dotenv').config();
const express = require('express');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const { OpenAI } = require('openai');
const Database = require('better-sqlite3');
const path = require('path');

// 1. Инициализация БД (Файл создастся в корне проекта)
const db = new Database('football_memory.db');

// Создание таблиц для "памяти" и "обучения"
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

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Функция сохранения матча в БД
const saveMatchToMemory = (match) => {
    const insert = db.prepare(`INSERT OR REPLACE INTO matches (id, competition, home_team, away_team, score, date) VALUES (?, ?, ?, ?, ?, ?)`);
    const scoreText = match.score?.fullTime?.home !== null ? `${match.score.fullTime.home}:${match.score.fullTime.away}` : 'scheduled';
    insert.run(match.id, match.competition.name, match.homeTeam.name, match.awayTeam.name, scoreText, match.utcDate);
};

// Бот
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `Привет, ${msg.from_user.first_name}! ⚽ Аналитика готова.`, {
        reply_markup: { inline_keyboard: [[{ text: "📊 Открыть приложение", web_app: { url: process.env.WEBAPP_URL } }]] }
    });
});

// Прокси для футбольных данных + Авто-сохранение в БД для обучения
app.get('/api/football/*', async (req, res) => {
    try {
        const endpoint = req.params[0];
        const response = await axios.get(`api.football-data.org{endpoint}`, {
            headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY },
            params: req.query
        });
        
        // Если это список матчей, сохраняем их в базу для будущего анализа ИИ
        if (response.data.matches) {
            response.data.matches.forEach(saveMatchToMemory);
        }
        
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка API' });
    }
});

// Умная ИИ-аналитика на основе данных из БД
app.get('/api/ai-analyze', async (req, res) => {
    const { teamName } = req.query;
    try {
        // Достаем историю из нашей базы
        const history = db.prepare(`SELECT * FROM matches WHERE home_team = ? OR away_team = ? ORDER BY date DESC LIMIT 5`).all(teamName, teamName);
        const historyContext = history.map(m => `${m.date}: ${m.home_team} ${m.score} ${m.away_team}`).join('\n');

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Ты футбольный аналитик. Твои прогнозы основаны на истории матчей из базы данных пользователя." },
                { role: "user", content: `Проанализируй ${teamName}. История игр:\n${historyContext}\nДай прогноз и объясни причины.` }
            ]
        });

        const analysis = completion.choices.message.content;
        db.prepare('INSERT INTO predictions (team_name, prediction) VALUES (?, ?)').run(teamName, analysis);
        res.json({ analysis });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.use(express.static(path.join(__dirname, 'public')));
app.listen(process.env.PORT || 3000, () => console.log(`🚀 Сервер запущен на порту ${process.env.PORT || 3000}`));