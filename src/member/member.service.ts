import TelegramBot from "node-telegram-bot-api";
import { PushkaBot } from "../bot/bot.service";
// import { IMember } from "./member.interface";

export class Members {
    bot: PushkaBot;
    private _step: number;
    private _stateOfCreationNewMember: boolean;

    constructor(bot: PushkaBot) {
        this.bot = bot;
        this._step = 1;
        this._stateOfCreationNewMember = false;
    }

    async getAllFromDb() {
        return (await this.bot.db.query("SELECT * FROM members")).rows;
    }

    getMemberCreationState(): boolean {
        return this._stateOfCreationNewMember;
    }

    async createMember(bot: PushkaBot, msg: TelegramBot.Message) {
        this._stateOfCreationNewMember = true;
        try {
            await bot.sendMessage(msg.chat.id, "Введите имя участника");

            // const member = await addMember(bot, msg);
            // if (member) {
            //     this._stateOfCreationNewMember = false;
            // }
        } catch (err) {
            await this.bot.sendMessage(
                msg.chat.id,
                "Ошибка создания пользователя",
            );
            console.error("Error creating a member:", err);
        }
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
