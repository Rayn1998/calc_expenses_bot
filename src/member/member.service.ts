import TelegramBot from "node-telegram-bot-api";
import { PushkaBot } from "../bot/bot.service";
// import { IMember } from "./member.interface";

export class Members {
    bot: PushkaBot;
    newMemberProcess: { [chatId: number]: { step: number } };

    constructor(bot: PushkaBot) {
        this.bot = bot;
        this.newMemberProcess = {};
    }

    async getAllFromDb() {
        return (await this.bot.db.query("SELECT * FROM members")).rows;
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
                    await this.bot.sendMessage(
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

    async deleteAllMembers(chatId: number) {
        try {
            await this.bot.db.query("DELETE FROM members");
            await this.bot.db.query(
                "ALTER SEQUENCE members_member_id_seq RESTART WITH 1;",
            );
            await this.bot.sendMessage(chatId, "Все пользователи удалены");
            console.log("All members deleted and ID counter restarted.");
        } catch (err) {
            await this.bot.sendMessage(chatId, "Ошибка удаления пользователей");
            console.error("Error deleting all members:", err);
        }
    }
}
