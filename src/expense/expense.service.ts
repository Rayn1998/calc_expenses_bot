import TelegramBot from "node-telegram-bot-api";
import { IExpense } from "./expense.interface";
import { PushkaBot } from "../bot/bot.service";

export class Expenses {
    newExpenseProcess: {
        [chatId: number]: { step: number; expense: Partial<IExpense> };
    };

    constructor() {
        this.newExpenseProcess = {};
    }

    async createExpense(bot: PushkaBot, msg: TelegramBot.Message) {
        const chatId = msg.chat.id;

        if (this.newExpenseProcess[chatId]) {
            const process = this.newExpenseProcess[chatId];
            const text = msg.text;
            if (!text) return;

            switch (process.step) {
                case 1:
                    process.expense.amount = Number(msg.text);
                    process.step = 2;
                    await bot.sendMessage(chatId, "Введите описание");
                    break;

                case 2:
                    process.expense.description = text;
                    process.step = 3;
                    await bot.sendMessage(chatId, "Кто платил?");
                    break;

                case 3:
                    process.expense.whoPaid = Number(text);
                    process.step = 4;
                    await bot.sendMessage(chatId, "Кто участвовал?");
                    break;

                case 4:
                    process.expense.whoParticipated = [Number(text)];
                    process.step = 5;
                    await bot.db.query(
                        `INSERT INTO expenses(amount, description, date, whopaid, whoparticipated, resolve)
                        VALUES
                        ($1, $2, $3, $4, $5, false);`,
                        [
                            process.expense.amount,
                            process.expense.description,
                            new Date().toISOString(),
                            process.expense.whoPaid,
                            process.expense.whoParticipated,
                        ],
                    );
                    await bot.sendMessage(
                        chatId,
                        "Расход успешно добавлен, спасибо",
                    );
                    delete this.newExpenseProcess[chatId];
                    break;

                default:
                    await bot.sendMessage(
                        msg.chat.id,
                        "Ошибка создания расхода",
                    );
                    break;
            }
            return;
        }
        this.newExpenseProcess[chatId] = { step: 1, expense: {} };
        await bot.sendMessage(chatId, "Введите сумму платежа");
    }

    async deleteAllExpenses(bot: PushkaBot, msg: TelegramBot.Message) {
        const chatId = msg.chat.id;
        try {
            await bot.db.query("DELETE FROM expenses");
            await bot.db.query(
                "ALTER SEQUENCE expenses_expense_id_seq RESTART WITH 1;",
            );
            await bot.sendMessage(chatId, "Все расходы удалены");
        } catch (err) {
            await bot.sendMessage(
                chatId,
                "Ошибка удаления расходов, попробуйте ещё раз",
            );
        }
    }
}
