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

    async showAllFromDb(bot: PushkaBot, msg: Message) {
        const chatId = msg.chat.id;
        const expenses: IExpense[] = (
            await bot.db.query("SELECT * FROM expenses")
        ).rows;

        if (expenses.length === 0) {
            bot.sendMessage(chatId, "Расходов пока нет");
        } else {
            let message = "Текущие расходы:";
            for (const expense of expenses) {
                const expenseState = expense.resolve
                    ? "Расчитан ✅"
                    : "Не расчитан ⛔️";
                message +=
                    "\n" +
                    `- ${expense.description}, ${
                        expense.amount
                    }, ${expense.date.toDateString()}, ${expenseState}`;
            }
            await bot.sendMessage(chatId, message);
        }
    }

    async getAllUnresolvedExpenses(bot: PushkaBot): Promise<IExpense[] | null> {
        try {
            const expenses: IExpense[] = (
                await bot.db.query(
                    "SELECT * FROM expenses WHERE resolve = false",
                )
            ).rows;
            if (expenses.length !== 0) {
                return expenses;
            } else {
                return null;
            }
        } catch (err) {
            return null;
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
                    process.expense.whopaid = Number(inputData);
                    process.step = 4;
                    if (members === null) return;
                    const participantsOptions = members
                        .filter((m) => m.member_id !== process.expense.whopaid)
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
                                          process.expense.whopaid
                                      );
                                  })
                                  .map((m) => {
                                      return m.member_id;
                                  })
                            : [Number(inputData)];
                    process.expense.whoparticipated = participantsIds;
                    process.step = 5;

                    try {
                        await bot.db.query(
                            `INSERT INTO expenses(amount, description, date, whopaid, whoparticipated, resolve)
                            VALUES
                            ($1, $2, $3, $4, $5, false);`,
                            [
                                process.expense.amount,
                                process.expense.description,
                                new Date().toDateString(),
                                process.expense.whopaid,
                                process.expense.whoparticipated,
                            ],
                        );

                        await bot.sendMessage(
                            chatId,
                            "Расход успешно добавлен, спасибо",
                        );
                    } catch (err) {
                        await bot.sendMessage(
                            chatId,
                            "Ошибка создания расхода d БД",
                        );
                        return;
                    }

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

    async resolveExpense(bot: PushkaBot, chatId: number, id: number) {
        try {
            await bot.db.query(
                "UPDATE expenses SET resolve = true WHERE expense_id = $1;",
                [id],
            );
            await bot.sendMessage(chatId, "Расход успешно расчитан, спасибо");
        } catch (err) {
            await bot.sendMessage(
                chatId,
                "Ошибка расчёта расхода, попробуйте ещё раз",
            );
        }
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
