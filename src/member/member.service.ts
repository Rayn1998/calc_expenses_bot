import { PushkaBot } from "../bot/bot.service";
import { IMember } from "./member.interface";
import { Pool } from "pg";

export class Members {
    private _members: Map<number, IMember>;
    db: Pool;

    constructor(db: Pool) {
        this._members = new Map();
        this.db = db;
    }

    get(chatId: number) {
        return this._members.get(chatId);
    }

    async getAllFromDb() {
        return (await this.db.query("SELECT * FROM members")).rows;
    }

    deleteMember(chatId: number) {
        this._members.delete(chatId);
    }

    async createMember(bot: PushkaBot, chatId: number) {
        this._members.set(chatId, { step: 1 });
        await bot.sendMessage(chatId, "Введите имя участника");
    }
}
