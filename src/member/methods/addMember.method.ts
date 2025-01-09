import { PushkaBot } from "../../bot/bot.service";
import TelegramBot from "node-telegram-bot-api";
// import { promises as fs } from "fs";

export const addMember = async (
    bot: PushkaBot,
    msg: TelegramBot.Message,
): Promise<boolean> => {
    const chatId = msg.chat.id;
    const member = bot.members.get(chatId);

    if (!member) return false;

    switch (member.step) {
        case 1:
            member.name = msg.text;
            member.debt = [];
            member.paidInOverAll = 0;
            member.step = 2;
            await bot.sendMessage(
                chatId,
                `Создан участник с именем ${member.name}`,
            );
            bot.members.deleteMember(chatId);
            return true;

        default:
            await bot.sendMessage(
                chatId,
                "Произошла ошибка добавления участника, пожалуйста, попробуйте ещё раз",
            );
            return true;
    }
};
