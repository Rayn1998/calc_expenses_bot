import TelegramBot from "node-telegram-bot-api";
import { IExpense } from "./expense.interface";
import { PushkaBot } from "../bot/bot.service";

export class Expenses {
    private _expenses: Map<number, IExpense>;

    constructor() {
        this._expenses = new Map();
    }

    get(chatId: number) {
        return this._expenses.get(chatId);
    }

    async createExpense(
        bot: PushkaBot,
        msg: TelegramBot.Message,
    ): Promise<boolean> {
        const chatId = msg.chat.id;
        this._expenses.set(chatId, { step: 1 });
        await bot.sendMessage(chatId, "Введите сумму платежа");
        return true;
    }
}
