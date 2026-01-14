document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.expand(); 

    // 1. Элементы первого экрана (Дисклеймер)
    const disclaimerScreen = document.getElementById('disclaimer-screen');
    const acceptCheck = document.getElementById('accept-disclaimer');
    const startBtn = document.getElementById('start-btn');

    // 2. Элементы второго экрана (Выбор лиги)
    const leagueMenu = document.getElementById('league-menu');
    const plCard = document.querySelector('[data-league="PL1"]'); // Карточка АПЛ

    // 3. Элементы третьего экрана (Выбор команды)
    const teamMenu = document.getElementById('team-menu');
    
    // 4. Элементы четвертого экрана (Дашборд)
    const backBtn = document.getElementById('back-btn');

    // --- Логика переходов ---

    // A. Активация кнопки входа
    acceptCheck.addEventListener('change', () => {
        startBtn.disabled = !acceptCheck.checked;
    });

    // B. Переход с Дисклеймера на Выбор лиги
    startBtn.addEventListener('click', () => {
        disclaimerScreen.classList.add('hidden');
        leagueMenu.classList.remove('hidden');
    });

    // C. Переход с Выбора лиги на Выбор команды АПЛ
    plCard.addEventListener('click', () => {
        leagueMenu.classList.add('hidden');
        teamMenu.classList.remove('hidden');
    });

    // D. Кнопка "Назад" с экрана команды на экран лиги
    // !!! Этот обработчик нужно будет убрать, когда мы добавим кнопку "Назад" на самом экране команды
    if (backBtn) {
         backBtn.addEventListener('click', () => {
            teamMenu.classList.add('hidden');
            leagueMenu.classList.remove('hidden');
        });
    }

});