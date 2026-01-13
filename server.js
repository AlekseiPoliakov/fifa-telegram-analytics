require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios'); // Установите: npm install axios

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 1. ПРОКСИ-ЭНДПОИНТ (Скрывает ваш ключ)
app.get('/api/matches/:teamId', async (req, res) => {
    try {
        const response = await axios.get(`${process.env.FOOTBALL_DATA_BASE_URL}/teams/${req.params.teamId}/matches`, {
            headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка при получении данных от API' });
    }
});

// 2. ЭНДПОИНТ ДЛЯ АНАЛИТИКИ (Тут будут "мозги" ИИ)
app.post('/api/analyze', async (req, res) => {
    const { teamData } = req.body;
    
    // Здесь мы в будущем будем делать запрос к вашему Python-скрипту с ИИ
    // Пока возвращаем заглушку
    res.json({
        analysis: "Команда в отличной форме. Ожидаемая победа 70%.",
        reasoning: "Основано на последних 5 победах и отсутствии травм у ключевых игроков."
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
});