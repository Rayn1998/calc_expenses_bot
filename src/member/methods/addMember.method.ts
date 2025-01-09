import { PushkaBot } from "../../bot/bot.service";
import TelegramBot from "node-telegram-bot-api";

export const addMember = async (bot: PushkaBot, msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const name = msg.text;
    // const member = bot.members.get(chatId);

    // if (!member) return false;

    try {
        await bot.db.query(`INSERT INTO members(name) VALUES($1)`, [name]);
        await bot.sendMessage(chatId, `Создан участник с именем ${name}`);
    } catch (err) {
        await bot.sendMessage(
            chatId,
            "Произошла ошибка добавления участника, пожалуйста, попробуйте ещё раз",
        );
        console.error(`Error creating member "${name}":`, err);
    }
    // bot.members.resolveCreationState();
    // bot.members.deleteMember(chatId);
};
