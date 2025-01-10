import {
    Message,
    CallbackQuery,
    InlineKeyboardButton,
} from "node-telegram-bot-api";
import { IExpense } from "./expense.interface";
import { PushkaBot } from "../bot/bot.service";
import { isMessage, isCallbackQuery } from "../ts/typeguards";

export class Expenses {
    newExpenseProcess: {
        [chatId: number]: { step: number; expense: Partial<IExpense> };
    };

    constructor() {
        this.newExpenseProcess = {};
    }

    async getAllFromDb(bot: PushkaBot, msg: Message) {
        const chatId = msg.chat.id;
        const expenses: IExpense[] = (
            await bot.db.query("SELECT * FROM expenses")
        ).rows;

        if (expenses.length === 0) {
            bot.sendMessage(chatId, "Расходов пока нет");
        } else {
            let message = "Текущие расходы:";
            for (const expense of expenses) {
                message +=
                    "\n" +
                    `- ${expense.date} ${expense.amount} ${expense.description}`;
            }
            await bot.sendMessage(chatId, message);
        }
    }

    async createExpense(bot: PushkaBot, msg: Message | CallbackQuery) {
        let chatId: number = 0;
        let inputData: string = "";

        if (isMessage(msg)) {
            chatId = msg.chat.id;
            inputData = msg.text!;
        } else if (isCallbackQuery(msg)) {
            chatId = msg.message!.chat.id;
            inputData = msg.data!;
        }

        const process = this.newExpenseProcess[chatId];

        if (process) {
            const members = await bot.members.getAllFromDb(bot);
            if (members === null) return;

            switch (process.step) {
                case 1:
                    process.expense.amount = Number(inputData);
                    process.step = 2;
                    await bot.sendMessage(chatId, "Введите описание");
                    break;

                case 2:
                    process.expense.description = inputData;
                    process.step = 3;

                    const options: InlineKeyboardButton[] = members.map(
                        (member) => ({
                            text: member.name,
                            callback_data: `${member.member_id}`,
                        }),
                    );
                    await bot.sendMessage(chatId, "Кто платил?", {
                        reply_markup: {
                            inline_keyboard: [options],
                        },
                    });
                    break;

                case 3:
                    process.expense.whoPaid = Number(inputData);
                    process.step = 4;
                    if (members === null) return;
                    const participantsOptions = members
                        .filter((m) => m.member_id !== process.expense.whoPaid)
                        .map((member) => ({
                            text: member.name,
                            callback_data: `${member.member_id}`,
                        }));

                    participantsOptions.push({
                        text: "Все",
                        callback_data: "all",
                    });
                    await bot.sendMessage(chatId, "Кто участвовал?", {
                        reply_markup: {
                            inline_keyboard: [participantsOptions],
                        },
                    });
                    break;

                case 4:
                    const participantsIds =
                        inputData === "all"
                            ? members
                                  .filter((m) => {
                                      return (
                                          m.member_id !==
                                          process.expense.whoPaid
                                      );
                                  })
                                  .map((m) => {
                                      return m.member_id;
                                  })
                            : [Number(inputData)];
                    process.expense.whoParticipated = participantsIds;
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
                    await bot.sendMessage(chatId, "Ошибка создания расхода");
                    break;
            }
            return;
        }
        this.newExpenseProcess[chatId] = { step: 1, expense: {} };
        await bot.sendMessage(chatId, "Введите сумму платежа");
    }

    async deleteAllExpenses(bot: PushkaBot, msg: Message) {
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
