from aiogram import Bot, Dispatcher, types


# Ваш токен от @BotFather
API_TOKEN = "8252709135:AAHlZ59UAK-iH1xw0xU1DyUWdjGy2GyyY4w"


bot = Bot(token=API_TOKEN)
dp = Dispatcher(bot)


@dp.message_handler(commands=['start'])
async def start(message: types.Message):
    keyboard = types.InlineKeyboardMarkup()
    keyboard.add(types.InlineKeyboardButton(
        text="Открыть приложение",
        web_app=types.WebAppInfo(url="https://ваш-домен.ru/")
    ))
    await message.answer("Добро пожаловать в футбольный дашборд!", reply_markup=keyboard)


if __name__ == '__main__':
    from aiogram import executor
    executor.start_polling(dp, skip_updates=True)
