const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Хранилище для данных текущей выбранной команды
let currentTeam = null;

// 1. Инициализация экранов
const screens = {
    disclaimer: document.getElementById('disclaimer-screen'),
    leagues: document.getElementById('league-menu'),
    teams: document.getElementById('team-menu'),
    dashboard: document.getElementById('team-dashboard')
};

// 2. Универсальная функция навигации
function showScreen(screenKey) {
    Object.values(screens).forEach(s => {
        if (s) s.classList.add('hidden');
    });
    
    if (screens[screenKey]) {
        screens[screenKey].classList.remove('hidden');
    }

    if (screenKey === 'disclaimer' || screenKey === 'leagues') {
        tg.BackButton.hide();
    } else {
        tg.BackButton.show();
    }
}

// 3. Обработка системной кнопки "Назад"
tg.onEvent('backButtonClicked', () => {
    if (!screens.dashboard.classList.contains('hidden')) {
        showScreen('teams');
    } else if (!screens.teams.classList.contains('hidden')) {
        showScreen('leagues');
    } else if (!screens.leagues.classList.contains('hidden')) {
        showScreen('disclaimer');
    }
});

// 4. Логика переключения Табов внутри Дашборда
document.querySelectorAll('.nav-item').forEach(button => {
    button.onclick = function() {
        if (!currentTeam) return;

        // Визуальное переключение активной вкладки
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');

        const view = this.getAttribute('data-view');
        if (view === 'matches') {
            loadMatchesTab(currentTeam.id);
        } else if (view === 'overview') {
            loadOverview(currentTeam);
        } else {
            document.getElementById('dashboard-content').innerHTML = 
                `<p class="loader">Раздел ${view} в разработке...</p>`;
        }
    };
});

// 5. Загрузка команд
async function loadTeams() {
    showScreen('teams');
    const grid = document.getElementById('teams-grid');
    grid.innerHTML = '<div class="loader">Загрузка клубов...</div>';

    try {
        const response = await fetch('/api/teams', {
            headers: { 'Authorization': `twa ${tg.initData}` }
        });
        const teams = await response.json();

        grid.innerHTML = ''; 
        teams.forEach(team => {
            const card = document.createElement('div');
            card.className = 'team-card-ui';
            card.innerHTML = `
                <div class="team-logo-circle">
                    <img src="${team.crest}" alt="${team.name}" onerror="this.src='assets/icons/premier-league.svg'">
                </div>
                <span class="team-label">${team.tla}</span>
            `;
            card.onclick = () => {
                tg.HapticFeedback.selectionChanged();
                openDashboard(team);
            };
            grid.appendChild(card);
        });
    } catch (e) {
        grid.innerHTML = '<p class="error">Ошибка загрузки команд</p>';
    }
}

// 6. Открытие Дашборда
function openDashboard(team) {
    currentTeam = team;
    showScreen('dashboard');
    document.getElementById('team-name').innerText = team.name;
    document.getElementById('team-crest').src = team.crest;
    
    // Сброс вкладок на "Обзор"
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-view="overview"]').classList.add('active');
    
    loadOverview(team);
}

// 7. Контент вкладки "Обзор"
function loadOverview(team) {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
        <div class="overview-card">
            <h3 style="margin-top:0">Кабинет: ${team.shortName}</h3>
            <p>Вы выбрали <b>${team.name}</b>. Перейдите в раздел матчей, чтобы увидеть расписание и запустить ИИ-аналитику для конкретной игры.</p>
            <button class="ai-button" id="quick-ai-btn">🦾 Общий анализ состава</button>
        </div>
    `;
    
    document.getElementById('quick-ai-btn').onclick = () => {
        runAIAnalysis(team.name, "текущей формы в лиге", "ближайший тур");
    };
}

// 8. Контент вкладки "Матчи" (Календарь)
async function loadMatchesTab(teamId) {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = '<div class="loader">Получаем расписание матчей...</div>';

    try {
        const response = await fetch(`/api/teams/${teamId}/matches`, {
            headers: { 'Authorization': `twa ${tg.initData}` }
        });
        const matches = await response.json();

        if (!matches || matches.length === 0) {
            content.innerHTML = '<p class="loader">Предстоящих матчей не найдено.</p>';
            return;
        }

        content.innerHTML = '<h3 class="tab-title">Предстоящие игры</h3>';
        
        matches.forEach(match => {
            const date = new Date(match.utcDate).toLocaleDateString('ru-RU', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            });

            const item = document.createElement('div');
            item.className = 'match-calendar-item';
            item.innerHTML = `
                <div class="match-date">${date}</div>
                <div class="match-teams">
                    <span>${match.homeTeam.shortName}</span>
                    <span class="vs">vs</span>
                    <span>${match.awayTeam.shortName}</span>
                </div>
                <button class="mini-ai-btn">AI Анализ</button>
            `;

            item.querySelector('.mini-ai-btn').onclick = () => {
                tg.HapticFeedback.impactOccurred('medium');
                runAIAnalysis(match.homeTeam.name, match.awayTeam.name, date);
            };

            content.appendChild(item);
        });
    } catch (e) {
        content.innerHTML = '<p class="error">Ошибка загрузки календаря. Попробуйте позже.</p>';
    }
}

// 9. Универсальная функция запуска ИИ
async function runAIAnalysis(home, away, date) {
    tg.MainButton.setText('ИИ анализирует...');
    tg.MainButton.show();
    tg.MainButton.showProgress();

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `twa ${tg.initData}`
            },
            body: JSON.stringify({ homeTeam: home, awayTeam: away, date: date })
        });
        const data = await response.json();
        tg.showAlert(`Прогноз на ${date}:\n\n${data.analysis}`);
    } catch (e) {
        tg.showAlert("Ошибка связи с ИИ-мозгом.");
    } finally {
        tg.MainButton.hide();
    }
}

// Стартовые привязки
document.getElementById('start-btn').onclick = () => showScreen('leagues');
document.querySelector('[data-league="PL1"]').onclick = () => loadTeams();

// Запуск
showScreen('disclaimer');