const axios = require("axios");
const fs = require("fs");
const path = require("path");

async function getPLData() {
  console.log("🚀 Начинаю загрузку данных АПЛ...");

  const url = "https://footballapi.pulselive.com/football/standings";
  const filePath = path.join(__dirname, "data", "data_25_26.json");

  try {
    const response = await axios.get(url, {
      params: {
        compSeasons: "719", // Убедись, что ID актуален для сезона 25/26
        altIds: true,
        detail: 2,
        FOOTBALL_COMPETITION: 1,
      },
      headers: {
        Origin: "https://www.premierleague.com",
        Referer: "https://www.premierleague.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    // Извлекаем только нужные данные (таблицу)
    const standings = response.data;

    // ПРОВЕРКА: создаем папку data, если её нет
    if (!fs.existsSync(path.join(__dirname, "data"))) {
      fs.mkdirSync(path.join(__dirname, "data"));
    }

    // СОХРАНЕНИЕ: записываем результат в файл
    fs.writeFileSync(filePath, JSON.stringify(standings, null, 2));

    console.log(`✅ Данные успешно сохранены в: ${filePath}`);
    console.log(
      `📊 Всего команд в таблице: ${standings.tables[0]?.entries?.length || 0}`,
    );
  } catch (e) {
    console.error("❌ Ошибка при получении данных:");
    if (e.response) {
      console.error(`Статус: ${e.response.status}`);
      console.error(
        `Причина: API заблокировало запрос (нужно обновить заголовки или Origin)`,
      );
    } else {
      console.error(e.message);
    }
  }
}

getPLData();
