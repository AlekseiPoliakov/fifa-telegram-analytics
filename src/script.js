const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Привет! Выберите команду:\n/table — Таблица АПЛ\n/matches — Последние матчи');
});

const Telegram = window.Telegram?.WebApp;
if (Telegram) {
    Telegram.ready(); // Сообщаем Telegram, что приложение готово
} else {
    console.error("Telegram Web App не доступен!");
}

if (user) {
    const welcomeEl = document.getElementById('welcome');
    if (welcomeEl) {
        welcomeEl.textContent = `Привет, ${user.first_name}!`;
    }
}

// Получаем данные пользователя (имя, id)
const user = Telegram.initDataUnsafe.user;
console.log('Пользователь Telegram:', user);

require('dotenv').config();
const express = require('express');
const path = require('path');

// Отладка: выводим все переменные окружения
console.log('Переменные окружения:');
console.log('FOOTBALL_DATA_API_KEY:', process.env.FOOTBALL_DATA_API_KEY);
console.log('FOOTBALL_DATA_BASE_URL:', process.env.FOOTBALL_DATA_BASE_URL);
console.log('PORT:', process.env.PORT);

const app = express();
const PORT = process.env.PORT || 3000;

class App {
    constructor() {
        this.currentLeague = null;
        this.currentTeam = null;
    }

    // Показать экран выбора лиги
    showLeagueMenu() {
        document.getElementById('league-menu').style.display = 'block';
        document.getElementById('disclaimer-screen').style.display = 'none';
        document.getElementById('team-menu').style.display = 'none';
        document.getElementById('team-dashboard').style.display = 'none';
    }

    // Показать экран выбора клуба
    showTeamMenu(teams) {
        const teamMenu = document.getElementById('team-menu');
        const teamsGrid = teamMenu.querySelector('.teams-grid');
        teamsGrid.innerHTML = '';

        teams.forEach(team => {
            const card = document.createElement('div');
            card.className = 'team-card';
            card.dataset.id = team.id;

            card.innerHTML = `
                <img src="${team.crestUrl || 'https://via.placeholder.com/80'}" 
                     alt="${team.name}" />
                <p>${team.name}</p>
            `;

            card.addEventListener('click', () => this.showTeamDashboard(team));
            teamsGrid.appendChild(card);
        });

        teamMenu.style.display = 'block';
        document.getElementById('league-menu').style.display = 'none';
    }

    // Показать дашборд команды
    showTeamDashboard(team) {
        this.currentTeam = team;

        document.getElementById('team-name').textContent = team.name;
        document.getElementById('team-crest').src = team.crestUrl || 'https://via.placeholder.com/60';


        document.getElementById('team-dashboard').style.display = 'block';
        document.getElementById('team-menu').style.display = 'none';

        this.loadDashboardSection('overview'); // Загружаем вкладку "Обзор"
    }
}

// В классе App
setupDashboardNavigation() {
    const menuItems = document.querySelectorAll('.dashboard-menu li');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const section = e.target.dataset.section;
            
            // Снимаем активный класс со всех
            menuItems.forEach(i => i.classList.remove('active'));
            // Добавляем активному
            e.target.classList.add('active');

            this.loadDashboardSection(section);
        });
    });
}

loadDashboardSection(section) {
    const content = document.querySelector('.dashboard-content');

    switch (section) {
        case 'overview':
            content.innerHTML = '<p>Общая информация о клубе...</p>';
            break;
        case 'matches':
            content.innerHTML = '<p>Ближайшие и прошедшие матчи...</p>';
            break;
        case 'table':
            content.innerHTML = '<p>Турнирная таблица лиги...</p>'; // Позже заменим на реальную таблицу
            break;
        case 'stats':
            content.innerHTML = '<p>Статистика команды...</p>';
            break;
    }
}

// В конструкторе App
document.getElementById('back-btn').addEventListener('click', () => {
    if (this.currentTeam) {
        // Возвращаемся к выбору клуба
        document.getElementById('team-dashboard').style.display = 'none';
        document.getElementById('team-menu').style.display = 'block';
    } else if (this.currentLeague) {
        // Возвращаемся к выбору лиги
        document.getElementById('team-menu').style.display = 'none';
        document.getElementById('league-menu').style.display = 'block';
    }
});


const APIService = {
    config: {
        baseURL: window.API_CONFIG?.baseUrl || '',
        apiKey: window.API_CONFIG?.key || '',
        timeout: 10000,
        retries: 3
    },

    async request(endpoint, params = {}, page = 1) {
        const url = new URL(`${this.config.baseURL}${endpoint}`);

        if (page > 1) {
            url.searchParams.append('page', page);
        }

        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const headers = {
            'X-Auth-Token': this.config.apiKey,
            'Accept': 'application/json'
        };

        try {
            console.log('[API] Запрос:', url.toString());

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: headers,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Запрос прерван: превышено время ожидания.');
            }
            console.error('[API] Ошибка запроса:', error);
            throw error;
        }
    },

    init() {
        if (!this.config.apiKey) {
            throw new Error('API-ключ не найден. Проверьте сервер и .env.');
        }
        if (!this.config.baseURL) {
            throw new Error('Base URL не задан.');
        }
        console.log('[API] Сервис инициализирован:', this.config.baseURL);
    }
};

const UI = {
    showLoading() {
        const loader = document.createElement('div');
        loader.id = 'loader';
        loader.textContent = 'Загружаем данные...';
        loader.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            z-index: 1000;
            font-family: Arial, sans-serif;
            text-align: center;
        `;
        document.body.appendChild(loader);
    },

    hideLoading() {
        const loader = document.getElementById('loader');
        if (loader) loader.remove();
    },

    showError(message) {
        alert(`Ошибка: ${message}`);
    },

    showLeagueMenu() {
        document.getElementById('league-menu').style.display = 'block';
        document.querySelector('.disclaimer').style.display = 'none';
        document.getElementById('enterBtn').style.display = 'none';
    },

    showTeamMenu(teams) {
        const grid = document.querySelector('.teams-grid');
        grid.innerHTML = '';

        teams.forEach(team => {
            const card = document.createElement('div');
            card.className = 'team-card';
            card.dataset.teamId = team.id;
            card.innerHTML = `
                <img
                    src="${team.crestUrl || 'https://via.placeholder.com/60?text=No+Logo'}"
                    alt="${team.name}"
                    style="width: 60px; height: 60px; object-fit: contain;"
                >
                <p style="margin-top: 0.5rem;">${team.name}</p>
            `;
            grid.appendChild(card);
        });

        document.getElementById('team-menu').style.display = 'block';
        document.getElementById('league-menu').style.display = 'none';
    },

    showTeamDashboard(team) {
        document.getElementById('team-name').textContent = team.name;
        document.getElementById('team-logo').src = team.crestUrl || 'https://via.placeholder.com/80?text=No+Logo';

        document.getElementById('team-dashboard').style.display = 'block';
        document.getElementById('team-menu').style.display = 'none';
    },

    goBack() {
        document.querySelectorAll('#league-menu, #team-menu, #team-dashboard')
            .forEach(el => el.style.display = 'none');
        document.querySelector('.disclaimer').style.display = 'block';
        document.getElementById('enterBtn').style.display = 'inline-block';
    },

    renderMatches(data) {
        if (!data?.matches || data.matches.length === 0) {
            this.showError('Нет данных о последних матчах.');
            return;
        }

        const container = document.createElement('div');
        container.innerHTML = `
            <h2>Последние матчи АПЛ</h2>
            <ul class="matches-list">
                ${data.matches.map(match => `
                    <li>
                        <div class="match-header">
                            <strong>${match.homeTeam.name}</strong>
                            <span>${match.score.fullTime.homeTeam ?? '0'} : ${match.score.fullTime.awayTeam ?? '0'}</span>
                            <strong>${match.awayTeam.name}</strong>
                        </div>
                        <div class="match-stats">
                            <small>
                                Дата: ${new Date(match.utcDate).toLocaleDateString('ru-RU')}<br>
                                Статус: ${match.status}
                            </small>
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;

        document.querySelector('.container').appendChild(container);
    }
};

const App = {
    currentLeague: 'PL1',
    currentTeam: null,
    currentStandings: null,

    init() {
        this.setupEventListeners();
        this.loadLeagues();
    },

    setupEventListeners() {
        document.getElementById('enterBtn').addEventListener('click', () => {
            UI.showLeagueMenu();
        });

        document.querySelectorAll('.league-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('disabled')) {
                    this.currentLeague = e.target.dataset.league;
                    this.loadTeams();
                }
            });
        });

        document.addEventListener('click', (e) => {
            if (e.target && e.target.closest('.team-card')) {
                const teamCard = e.target.closest('.team-card');
                const teamId = teamCard.dataset.teamId;
                this.loadTeam(teamId);
            }
        });

        document.getElementById('back-btn').addEventListener('click', () => {
            UI.goBack();
            this.currentTeam = null;
        });

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.target.dataset.view;
                this.showDashboardView(view);
            });
        });
    },

    loadLeagues() {
        console.log('[App] Лиги загружены (статично)');
    },

async loadTeams(page = 1) {
    UI.showLoading();
    try {
        APIService.init();
        
        // Запрашиваем команды с указанием номера страницы
        const response = await APIService.request(
            `/competitions/${this.currentLeague}/teams`,
            {},        // Дополнительные параметры (если нужны)
            page       // Номер страницы
        );

        if (response.teams && response.teams.length > 0) {
            UI.showTeamMenu(response.teams);
            
            // Опционально: рисуем кнопки «Предыдущая/Следующая страница»
            this.renderPagination(response, page);
        } else {
            UI.showError('Нет команд в этой лиге.');
        }
    } catch (error) {
        UI.showError(error.message);
    } finally {
        UI.hideLoading();
    }
},

    renderPagination(response, currentPage) {
    const grid = document.querySelector('.teams-grid');

    const paginator = document.getElementById('paginator');
    if (paginator) paginator.remove();

    const paginatorEl = document.createElement('div');
    paginatorEl.id = 'paginator';
    paginatorEl.style.marginTop = '1rem';
    paginatorEl.style.textAlign = 'center';

    const totalTeams = response.count || 0;
    const teamsPerPage = response.teams?.length || 0;
    const hasNext = totalTeams > (currentPage * teamsPerPage);
    const hasPrev = currentPage > 1;

    if (hasPrev) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '← Предыдущая';
        prevBtn.style.marginRight = '0.5rem';
        prevBtn.addEventListener('click', () => {
            this.loadTeams(currentPage - 1);
        });
        paginatorEl.appendChild(prevBtn);
    }

    if (hasNext) {
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Следующая →';
        nextBtn.addEventListener('click', () => {
            this.loadTeams(currentPage + 1);
        });
        paginatorEl.appendChild(nextBtn);
    }

    grid.appendChild(paginatorEl);
},


    async loadTeam(teamId) {
        UI.showLoading();
        try {
            APIService.init();
            const response = await APIService.request(`/teams/${teamId}`);
            
            this.currentTeam = response;
            UI.showTeamDashboard(response);
            this.showDashboardView('overview');
        } catch (error) {
            UI.showError(error.message);
        } finally {
            UI.hideLoading();
        }
    },

    async showDashboardView(view) {
        const response = await APIService.request(`/competitions/${this.currentLeague}/standings`);

        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.view === view);
        });

        switch (view) {
            case 'overview':
                content.innerHTML = `
                    <h3>Обзор команды</h3>
                    <p><strong>Страна:</strong> ${this.currentTeam.area.name}</p>
                    <p><strong>Стадион:</strong> ${this.currentTeam.venue || 'Не указан'}</p>
                    <p><strong>Официальный сайт:</strong> <a href="${this.currentTeam.website}" target="_blank">${this.currentTeam.website}</a></p>
                `;
                break;

            case 'matches':
                content.innerHTML = `
                    <h3>Последние матчи</h3>
                    <ul class="matches-list">
                        ${this.currentTeam.matches?.slice(0, 5).map(match => `
                            <li>
                                <strong>${match.homeTeam.name}</strong> 
                                ${match.score.fullTime.homeTeam ?? '0'} : ${match.score.fullTime.awayTeam ?? '0'}
                                <strong>${match.awayTeam.name}</strong>
                            </li>
                        `).join('')}
                    </ul>
                `;
                break;

            case 'table':
    try {
        // Запрос к API: турнирная таблица лиги
        const standingsResponse = await APIService.request(
            `/competitions/${this.currentLeague}/standings`,
            { season: new Date().getFullYear() } // Текущий сезон
        );

        // Извлекаем таблицу (обычно в standings[0].table)
        const table = standingsResponse.standings?.[0]?.table || [];

        if (table.length === 0) {
            content.innerHTML = '<p>Таблица не доступна.</p>';
            return;
        }

        if (this.currentStandings) {
        this.renderStandingsTable(this.currentStandings, content);
        }

        try {
            const standingsResponse = await APIService.request(/* ... */);
            this.currentStandings = standingsResponse.standings?.[0]?.table || [];
            this.renderStandingsTable(this.currentStandings, content);
        }

        // Формируем HTML-таблицу
        let tableHTML = `
            <table class="standings-table">
                <thead>
                    <tr>
                        <th>№</th>
                        <th>Клуб</th>
                        <th>И</th>
                        <th>В</th>
                        <th>Н</th>
                        <th>П</th>
                        <th>ГЗ</th>
                        <th>ГП</th>
                        <th>О</th>
                    </tr>
                </thead>
                <tbody>
        `;

        table.forEach((team, index) => {
            tableHTML += `
                <tr>
                    <td>${team.position}</td>
                    <td>
                        <img src="${team.team.crestUrl || 'https://via.placeholder.com/30'}" 
                             alt="${team.team.name}" style="width: 24px; height: 24px;">
                        ${team.team.name}
                    </td>
                    <td>${team.playedGames}</td>
                    <td>${team.won}</td>
                    <td>${team.draw}</td>
                    <td>${team.lost}</td>
                    <td>${team.goalsFor}</td>
                    <td>${team.goalsAgainst}</td>
                    <td><strong>${team.points}</strong></td>
                </tr>
            `;
        });

        tableHTML += '</tbody></table>';
        content.innerHTML = tableHTML;

    } catch (error) {
        content.innerHTML = `<p>Ошибка загрузки таблицы: ${error.message}</p>`;
    }
    break;



            case 'stats':
                content.innerHTML = `
                    <h3>Статистика</h3>
                    <p>Детализированная статистика по команде (голы, владение, удары и т.д.)</p>
                `;
                break;

            default:
                content.innerHTML = '<p>Раздел не найден.</p>';
        }
    }
};

const app = new App();

// Обработчик кнопки "Начать"
document.getElementById('start-btn').addEventListener('click', () => {
    app.showLeagueMenu();
});

// Обработчик выбора лиги (только для активной)
document.querySelectorAll('.league-card.active').forEach(card => {
    card.addEventListener('click', () => {
        app.currentLeague = card.dataset.league;
        app.loadTeams(); // Метод должен быть реализован (запрос к API)
    });
});

// Настройка навигации дашборда
app.setupDashboardNavigation();


document.addEventListener('DOMContentLoaded', () => {
    App.init();
});