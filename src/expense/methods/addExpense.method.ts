import TelegramBot from "node-telegram-bot-api";
import { PushkaBot } from "../../bot/bot.service";

export const addExpense = async (
    bot: PushkaBot,
    msg: TelegramBot.Message,
): Promise<boolean> => {
    const chatId = msg.chat.id;
    const expense = bot.expenses.get(chatId);

    if (!expense) return false;

    switch (expense.step) {
        case 1:
            expense.amount = Number(msg.text);
            expense.step = 2;
            // const members = bot.members.get()
            await bot.sendMessage(chatId, "Кто оплатил?", {
                reply_markup: {
                    inline_keyboard: [],
                },
            });
            return true;

        case 2:
        // expense.whoPaid =

        default:
            await bot.sendMessage(
                chatId,
                "Произошла ошибка добавления расхода. Пожалуйста, попробуйте снова",
            );
            return true;
    }
};
