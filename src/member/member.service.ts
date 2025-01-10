import TelegramBot from "node-telegram-bot-api";
import { PushkaBot } from "../bot/bot.service";
import { IMember } from "./member.interface";

export class Members {
    newMemberProcess: { [chatId: number]: { step: number } };

    constructor() {
        this.newMemberProcess = {};
    }

    async showAllFromDb(
        bot: PushkaBot,
        msg: TelegramBot.Message,
    ): Promise<void> {
        const chatId = msg.chat.id;
        const members: IMember[] = (await bot.db.query("SELECT * FROM members"))
            .rows;

        if (members.length === 0) {
            bot.sendMessage(chatId, "Пользователей пока нет");
            return;
        } else {
            let message = "Текущие участники:";
            for (const member of members) {
                message += "\n" + `- ${member.name}`;
            }
            await bot.sendMessage(chatId, message);
        }
    }

    async getAllFromDb(bot: PushkaBot): Promise<IMember[] | null> {
        const members: IMember[] = (await bot.db.query("SELECT * FROM members"))
            .rows;

        if (members.length === 0) {
            return null;
        } else {
            return members;
        }
    }

    async createMember(bot: PushkaBot, msg: TelegramBot.Message) {
        const chatId = msg.chat.id;

        if (this.newMemberProcess[chatId]) {
            const process = this.newMemberProcess[chatId];

            switch (process.step) {
                case 1:
                    const name = msg.text;
                    await bot.db.query(`INSERT INTO members(name) VALUES($1)`, [
                        name,
                    ]);
                    await bot.sendMessage(
                        chatId,
                        `Создан участник с именем ${name}`,
                    );
                    delete this.newMemberProcess[chatId];
                    break;

                default:
                    await bot.sendMessage(
                        msg.chat.id,
                        "Ошибка создания пользователя",
                    );
                    break;
            }
            return;
        }

        this.newMemberProcess[chatId] = { step: 1 };
        await bot.sendMessage(msg.chat.id, "Введите имя участника");
    }

    async deleteAllMembers(bot: PushkaBot, msg: TelegramBot.Message) {
        const chatId = msg.chat.id;
        try {
            await bot.db.query("DELETE FROM members");
            await bot.db.query(
                "ALTER SEQUENCE members_member_id_seq RESTART WITH 1;",
            );
            await bot.sendMessage(chatId, "Все пользователи удалены");
            console.log("All members deleted and ID counter restarted.");
        } catch (err) {
            await bot.sendMessage(chatId, "Ошибка удаления пользователей");
            console.error("Error deleting all members:", err);
        }
    }
}
