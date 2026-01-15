/**
 * 1. ИНИЦИАЛИЗАЦИЯ И НАСТРОЙКИ
 */
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Хранилище для текущей команды
window.currentTeam = null;

// Исключения для названий логотипов
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
 * 2. УНИВЕРСАЛЬНАЯ НАВИГАЦИЯ
 * Сделана глобальной, чтобы атрибуты onclick в HTML работали
 */
window.showScreen = function(screenId) {
    console.log("Переключение на экран:", screenId);
    
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
};

// Обработка системной кнопки "Назад"
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
window.loadTeams = async function(leagueId) {
    showScreen('screen-teams');
    const grid = document.getElementById('teams-grid');
    grid.innerHTML = '<div class="loader">Загрузка клубов...</div>';

    try {
        // Заглушка, пока нет реального API URL
        // Замени на реальный fetch('/api/teams'...) когда будешь готов
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
        grid.innerHTML = '<p class="error">Ошибка загрузки команд. Проверьте сервер.</p>';
    }
};

/**
 * 5. ЛИЧНЫЙ КАБИНЕТ (ШАГ 5)
 */
function openClubCabinet(team) {
    window.currentTeam = team;
    showScreen('screen-club-cabinet');
    
    document.getElementById('cabinet-team-name').innerText = team.name;
    const logoPlace = document.getElementById('cabinet-logo-place');
    if (logoPlace) {
        logoPlace.innerHTML = getTeamLogoHtml(team.name, "cabinet-main-logo");
    }

    loadOverview(team);
}

function loadOverview(team) {
    const content = document.getElementById('cabinet-content');
    content.innerHTML = `
        <div class="info-card">
            <h3>Обзор клуба</h3>
            <p>Добро пожаловать в кабинет <b>${team.shortName}</b>.</p>
        </div>
    `;
}

/**
 * ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM загружен");

    // Оживляем кнопку "Войти в приложение"
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.onclick = () => {
            tg.HapticFeedback.impactOccurred('light');
            showScreen('screen-countries');
        };
    }

    // Настройка табов в кабинете
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const tabName = this.innerText.trim();
            if (tabName === 'Матчи' && window.currentTeam) {
                // Здесь будет вызов loadMatchesTab(window.currentTeam.id);
                document.getElementById('cabinet-content').innerHTML = 'Загрузка матчей...';
            }
        };
    });

    // Показываем первый экран
    showScreen('screen-welcome');
});