/**
 * 1. ИНИЦИАЛИЗАЦИЯ И НАСТРОЙКИ
 */
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Названия файлов для команд, которые не совпадают с API
const teamNameOverrides = {
    "manchester united fc": "manutd",
    "manchester city fc": "mancity",
    "tottenham hotspur fc": "spurs",
    "west ham united fc": "westham",
    "brighton & hove albion fc": "brighton",
    "wolverhampton wanderers fc": "wolves",
    "crystal palace fc": "palace",
    "nottingham forest fc": "forest"
};

/**
 * 2. УНИВЕРСАЛЬНАЯ НАВИГАЦИЯ (РЕЗИНОВАЯ ЛОГИКА)
 */
function showScreen(screenId) {
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    
    // Показываем нужный
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.remove('hidden');
    }

    // Управление кнопкой Back в Telegram
    if (screenId === 'screen-welcome') {
        tg.BackButton.hide();
    } else {
        tg.BackButton.show();
    }
}

// Логика кнопки "Назад"
tg.onEvent('backButtonClicked', () => {
    if (!document.getElementById('screen-club-cabinet').classList.contains('hidden')) {
        showScreen('screen-teams');
    } else if (!document.getElementById('screen-teams').classList.contains('hidden')) {
        showScreen('screen-leagues');
    } else if (!document.getElementById('screen-leagues').classList.contains('hidden')) {
        showScreen('screen-countries');
    } else if (!document.getElementById('screen-countries').classList.contains('hidden')) {
        showScreen('screen-welcome');
    }
});

/**
 * 3. ЛОГИКА ЛОГОТИПОВ
 */
function getTeamLogoHtml(apiName, className = "team-logo-img") {
    const lowerName = apiName.toLowerCase();
    let fileName = teamNameOverrides[lowerName] || lowerName
        .replace(/ fc| united| city| albion| wanderers| town| athletic/g, '')
        .trim()
        .replace(/\s+/g, '');

    const svgPath = `images/club/${fileName}.svg`;
    const pngPath = `images/club/${fileName}.png`;

    return `
        <img 
            src="${svgPath}" 
            alt="${apiName}" 
            class="${className}"
            onerror="this.onerror=null; this.src='${pngPath}'; this.alt='⚽';"
        >
    `;
}

/**
 * 4. ЗАГРУЗКА КЛУБОВ (ШАГ 4)
 */
async function loadTeams(leagueId) {
    showScreen('screen-teams');
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
                    ${getTeamLogoHtml(team.name)}
                </div>
                <span class="team-label">${team.tla || team.shortName}</span>
            `;
            
            card.onclick = () => {
                tg.HapticFeedback.selectionChanged();
                openClubCabinet(team);
            };
            grid.appendChild(card);
        });
    } catch (e) {
        grid.innerHTML = '<p class="error">Ошибка загрузки команд. Проверьте соединение.</p>';
    }
}

/**
 * 5. ЛИЧНЫЙ КАБИНЕТ КЛУБА (ШАГ 5)
 */
function openClubCabinet(team) {
    showScreen('screen-club-cabinet');
    
    document.getElementById('cabinet-team-name').innerText = team.name;
    const logoPlace = document.getElementById('cabinet-logo-place');
    if (logoPlace) {
        logoPlace.innerHTML = getTeamLogoHtml(team.name, "cabinet-main-logo");
    }

    // Пример наполнения контента
    document.getElementById('cabinet-content').innerHTML = `
        <div class="info-card">
            <h3>Обзор клуба</h3>
            <p>Добро пожаловать в личный кабинет <b>${team.shortName}</b>. Здесь будет доступна статистика и форма игроков.</p>
        </div>
    `;
}

async function loadMatchesTab(teamId) {
    const content = document.getElementById('cabinet-content');
    content.innerHTML = '<div class="loader">Загрузка расписания... 📅</div>';

    try {
        // Запрос к API за матчами конкретной команды
        const response = await fetch(`/api/teams/${teamId}/matches`, {
            headers: { 'Authorization': `twa ${tg.initData}` }
        });
        const matches = await response.json();

        if (!matches || matches.length === 0) {
            content.innerHTML = '<p class="empty-state">Ближайших игр не запланировано</p>';
            return;
        }

        content.innerHTML = ''; // Очищаем лоадер

        matches.forEach(match => {
            // Форматируем дату: "15 янв, 22:00"
            const dateObj = new Date(match.utcDate);
            const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            const timeStr = dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

            const isHome = match.homeTeam.id === teamId;
            const opponent = isHome ? match.awayTeam : match.homeTeam;

            const matchCard = document.createElement('div');
            matchCard.className = 'match-card';
            matchCard.innerHTML = `
                <div class="match-info">
                    <span class="match-date">${dateStr} • ${timeStr}</span>
                    <span class="match-status">${isHome ? 'Дома' : 'В гостях'}</span>
                </div>
                <div class="match-teams">
                    <div class="team-mini">
                        ${getTeamLogoHtml(match.homeTeam.name, "tiny-logo")}
                        <span>${match.homeTeam.shortName}</span>
                    </div>
                    <div class="match-score">vs</div>
                    <div class="team-mini">
                        ${getTeamLogoHtml(match.awayTeam.name, "tiny-logo")}
                        <span>${match.awayTeam.shortName}</span>
                    </div>
                </div>
                <button class="btn-ai-mini" onclick="runAIAnalysis('${match.homeTeam.name}', '${match.awayTeam.name}', '${dateStr}')">
                    🦾 Анализ ИИ
                </button>
            `;
            content.appendChild(matchCard);
        });
    } catch (e) {
        content.innerHTML = '<p class="error">Не удалось загрузить календарь</p>';
    }
}

/**
 * СТАРТ ПРИЛОЖЕНИЯ ПРИ ЗАГРУЗКЕ
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- 1. ПЕРЕХОД: ПРИВЕТСТВИЕ -> ВЫБОР СТРАНЫ ---
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.onclick = () => {
            tg.HapticFeedback.impactOccurred('light'); // Легкая вибрация
            showScreen('screen-countries');
        };
    }

    // --- 2. ПЕРЕХОД: ВЫБОР СТРАНЫ (АНГЛИЯ) -> ВЫБОР ЛИГИ ---
    // Ищем активную карточку внутри экрана стран
    const countryCard = document.querySelector('#screen-countries .item-card.active');
    if (countryCard) {
        countryCard.onclick = () => {
            tg.HapticFeedback.selectionChanged();
            showScreen('screen-leagues');
        };
    }

    // --- 3. ПЕРЕХОД: ВЫБОР ЛИГИ (ПРЕМЬЕР-ЛИГА) -> СПИСОК КЛУБОВ ---
    // Ищем активную карточку лиги (Премьер-лига)
    const leagueCard = document.querySelector('#screen-leagues .item-card.active');
    if (leagueCard) {
        leagueCard.onclick = () => {
            tg.HapticFeedback.selectionChanged();
            loadTeams('PL1'); // Запускаем загрузку клубов
        };
    }

    // --- 4. ЛОГИКА ТАБОВ ВНУТРИ КАБИНЕТА КЛУБА ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.onclick = function() {
            // Переключаем визуальный фокус
            tabButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Определяем, какую вкладку загрузить
            const tabName = this.innerText.trim();
            if (tabName === 'Матчи') {
                if (window.currentTeam) loadMatchesTab(window.currentTeam.id);
            } else if (tabName === 'Обзор') {
                if (window.currentTeam) loadOverview(window.currentTeam);
            }
            
            tg.HapticFeedback.impactOccurred('light');
        };
    });

    // --- ФИНАЛЬНЫЙ ШАГ: ЗАПУСК ПЕРВОГО ЭКРАНА ---
    showScreen('screen-welcome');
    console.log("Приложение инициализировано, первый экран запущен.");
});