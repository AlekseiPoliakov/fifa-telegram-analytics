const fs = require("fs");
const path = require("path");

const HISTORY_DIR = "./data/history/";
const PROFILES_DIR = "./data/profiles/";
const TEAMS_CONFIG = JSON.parse(fs.readFileSync("./data/teams.json", "utf8"));

if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR);

const teams = TEAMS_CONFIG.teams;
let database = {};

// Инициализируем структуру для каждой команды
teams.forEach((t) => {
  database[t.id] = {
    name: t.name,
    slug: t.slug,
    seasons: {}, // Статистика по сезонам
    h2h: {}, // История личных встреч
    global: { matches: 0, goals: 0, wins: 0, homeStrength: 0, awayStrength: 0 },
  };
});

async function analyze() {
  console.log("🚀 Начинаю глубокий анализ 7 сезонов...");
  const files = fs.readdirSync(HISTORY_DIR).filter((f) => f.endsWith(".json"));

  files.forEach((file) => {
    const seasonName = file.replace(".json", "");
    const data = JSON.parse(
      fs.readFileSync(path.join(HISTORY_DIR, file), "utf8")
    );

    console.log(`📊 Обработка ${seasonName}...`);

    data.matches.forEach((m) => {
      const homeId = m.home_team.id;
      const awayId = m.away_team.id;

      // Если обе команды есть в нашем текущем списке 20 клубов
      if (database[homeId] && database[awayId]) {
        processMatch(homeId, awayId, m, seasonName);
      }
    });
  });

  // Сохраняем индивидуальные профили
  Object.keys(database).forEach((id) => {
    const team = database[id];
    fs.writeFileSync(
      `${PROFILES_DIR}${team.slug}.json`,
      JSON.stringify(team, null, 2)
    );
  });

  console.log("✅ Все профили созданы в data/profiles/");
}

function processMatch(hId, aId, m, season) {
  const res = m.result;
  const hGoals = res.home_goals;
  const aGoals = res.away_goals;

  // Инициализация H2H если нет данных
  if (!database[hId].h2h[aId])
    database[hId].h2h[aId] = { w: 0, d: 0, l: 0, gs: 0, gc: 0 };
  if (!database[aId].h2h[hId])
    database[aId].h2h[hId] = { w: 0, d: 0, l: 0, gs: 0, gc: 0 };

  // 1. Обновляем глобальную статистику голов
  database[hId].global.matches++;
  database[hId].global.goals += hGoals;
  database[aId].global.matches++;
  database[aId].global.goals += aGoals;

  // 2. Обновляем голы в Личных встречах (H2H) - ЭТОГО НЕ БЫЛО
  database[hId].h2h[aId].gs += hGoals; // Home Goals Scored
  database[hId].h2h[aId].gc += aGoals; // Home Goals Conceded
  database[aId].h2h[hId].gs += aGoals; // Away Goals Scored
  database[aId].h2h[hId].gc += hGoals; // Away Goals Conceded

  // 3. Результаты матча
  if (res.outcome === "HOME_WIN") {
    database[hId].h2h[aId].w++;
    database[aId].h2h[hId].l++;
    database[hId].global.wins++;
  } else if (res.outcome === "AWAY_WIN") {
    database[hId].h2h[aId].l++;
    database[aId].h2h[hId].w++;
    database[aId].global.wins++;
  } else {
    database[hId].h2h[aId].d++;
    database[aId].h2h[hId].d++;
  }

  // 4. Расчет силы атаки (упрощенно)
  database[hId].global.homeStrength = (
    database[hId].global.goals / database[hId].global.matches
  ).toFixed(2);
  database[aId].global.awayStrength = (
    database[aId].global.goals / database[aId].global.matches
  ).toFixed(2);
}

analyze();
