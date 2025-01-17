import { Message, CallbackQuery, InlineKeyboardButton } from "node-telegram-bot-api";
import IExpense from "./expense.interface";
import PushkaBot from "../bot/bot.service";

export default class Expenses {
    newExpenseProcess: {
        [chatId: number]: { step: number; expense: Partial<IExpense> };
    };
    deleteExpenseProcess: boolean;

    constructor() {
        this.newExpenseProcess = {};
        this.deleteExpenseProcess = false;
    }

    /**
     * Функция выводит в чат все расходы одним общим списком
     * @param bot
     * @param msg
     */
    async showAllFromDb(bot: PushkaBot, msg: Message) {
        const { chatId } = bot.getChatIdAndInputData(msg);

        const expenses: IExpense[] = (await bot.db.query("SELECT * FROM expenses")).rows;

        if (expenses.length === 0) {
            await bot.sendMessage(chatId, "Расходов пока нет");
        } else {
            let message = "Текущие расходы:";
            for (const expense of expenses) {
                const expenseState = expense.resolve ? "Расчитан ✅" : "Не расчитан ⛔️";
                message +=
                    "\n" +
                    `- ${expense.description}, ${expense.amount}, ${expense.date.toDateString()}, ${expenseState}`;
            }
            await bot.sendMessage(chatId, message);
        }
    }

    /**
     * Функция выводит объект всех нерасчитанных расходов из базы данных
     * @param bot
     * @returns
     */
    async getAllUnresolvedExpenses(bot: PushkaBot): Promise<IExpense[] | null> {
        try {
            const expenses: IExpense[] = (await bot.db.query("SELECT * FROM expenses WHERE resolve = false")).rows;
            if (expenses.length !== 0) {
                return expenses;
            } else {
                return null;
            }
        } catch (err) {
            return null;
        }
    }

    /**
     * Функция позволяет создать новый расход, задавая вопросы пользователю в чате
     * @param bot
     * @param msg
     * @returns
     */
    async createExpense(bot: PushkaBot, msg: Message | CallbackQuery) {
        const { chatId, inputData } = bot.getChatIdAndInputData(msg);

        if (await bot.checkInSomeProcess(msg)) {
            return;
        }

        const members = await bot.members.getAllFromDb(bot);

        if (members === null) {
            await bot.sendMessage(
                chatId,
                "Пока что не для кого составлять расходы). Пожалуйста, создайте сначала участников",
            );
            return;
        }

        const process = this.newExpenseProcess[chatId];

        if (process) {
            const members = await bot.members.getAllFromDb(bot);
            if (!members) return;

            switch (process.step) {
                case 1:
                    if (Number.isNaN(Number(inputData))) {
                        await bot.sendMessage(chatId, "Пожалуйста, введите число");
                        return;
                    }

                    process.expense.amount = Number(inputData);
                    process.step = 2;

                    await bot.sendMessage(chatId, "Введите описание");
                    break;

                case 2:
                    process.expense.description = inputData;
                    process.step = 3;

                    const options: InlineKeyboardButton[] = members.map((member) => ({
                        text: member.name,
                        callback_data: `${member.member_id}`,
                    }));
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
                    const participantsOptions: InlineKeyboardButton[] = members
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
                                      return m.member_id !== process.expense.whopaid;
                                  })
                                  .map((m) => {
                                      return m.member_id;
                                  })
                            : [Number(inputData)];

                    process.expense.whoparticipated = participantsIds;
                    process.step = 5;

                    await bot.sendMessage(chatId, "Сколько оставили на чай?", {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: "Не оставляли",
                                        callback_data: "no_tips",
                                    },
                                ],
                            ],
                        },
                    });
                    break;

                case 5:
                    const tip = Number(inputData);
                    if (inputData === "no_tips") {
                        process.expense.tip = null;
                        process.step = 6;
                        await bot.sendMessage(chatId, "Какой процент за обслуживание");
                        break;
                    }
                    if (tip && typeof tip === "number") {
                        process.expense.tip = tip;
                    } else {
                        await bot.sendMessage(chatId, "Пожалуйста, введите число");
                        return;
                    }

                    process.step = 6;
                    await bot.sendMessage(chatId, "Какой процент за обслуживание");
                    break;

                case 6:
                    const requiredTipPercentage = Number(inputData);
                    if (requiredTipPercentage + 1 > 0 && typeof requiredTipPercentage === "number") {
                        process.expense.requiredtippercentage = requiredTipPercentage;
                    } else {
                        await bot.sendMessage(chatId, "Пожалуйста, введите число");
                        return;
                    }

                    try {
                        await bot.db.query(
                            `INSERT INTO expenses(amount, description, date, whopaid, whoparticipated, resolve, tip, requiredtippercentage)
                            VALUES
                            ($1, $2, $3, $4, $5, false, $6, $7);`,
                            [
                                process.expense.amount,
                                process.expense.description,
                                new Date().toDateString(),
                                process.expense.whopaid,
                                process.expense.whoparticipated,
                                process.expense.tip,
                                process.expense.requiredtippercentage,
                            ],
                        );

                        await bot.sendMessage(chatId, "Расход успешно добавлен, спасибо");
                    } catch (err) {
                        await bot.sendMessage(chatId, "Ошибка создания расхода в БД");
                        this.deleteStates(bot, chatId);
                        return;
                    }

                    this.deleteStates(bot, chatId);
                    break;

                default:
                    await bot.sendMessage(chatId, "Ошибка создания расхода");
                    this.deleteStates(bot, chatId);
                    break;
            }
            return;
        }

        this.newExpenseProcess[chatId] = { step: 1, expense: {} };
        bot.process = true;

        await bot.sendMessage(chatId, "Введите сумму платежа", {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "Отмена",
                            callback_data: "cancel",
                        },
                    ],
                ],
            },
        });
    }

    /**
     * Функция позволяет удалить 1 конкретный расход, выбирает пользователь из списка в чате
     * @param bot
     * @param msg
     * @returns
     */
    async deleteOneExpense(bot: PushkaBot, msg: Message | CallbackQuery) {
        const { chatId, inputData } = bot.getChatIdAndInputData(msg);

        const process = this.deleteExpenseProcess;

        if (await bot.checkInSomeProcess(msg)) {
            return;
        }

        const expenses = (await bot.db.query("SELECT * FROM expenses;")).rows;

        if (expenses.length === 0) {
            await bot.sendMessage(chatId, "Нечего удалять");
            return;
        }

        if (process) {
            switch (process) {
                case true:
                    const expenseId = +inputData;
                    if (expenseId && typeof expenseId === "number") {
                        await bot.db.query("DELETE FROM expenses WHERE expense_id = $1", [expenseId]);
                        await bot.sendMessage(chatId, "Расход успешно удалён");
                    }

                    this.deleteStates(bot, chatId);
                    break;

                default:
                    await bot.sendMessage(chatId, "Ошибка удаления расхода, попробуйте ещё раз");

                    this.deleteStates(bot, chatId);
                    break;
            }
            return;
        }

        this.deleteExpenseProcess = true;
        bot.process = true;

        const options: InlineKeyboardButton[] = expenses!.map((expense) => ({
            text: `${expense.amount} в ${expense.description}`,
            callback_data: `${expense.expense_id}`,
        }));

        options.push({
            text: "Отмена",
            callback_data: "cancel",
        });

        await bot.sendMessage(chatId, "Выберите, какой расход удалить:", {
            reply_markup: {
                inline_keyboard: [...options.map((button) => [button])],
            },
        });
    }

    /**
     * Функция ставит долгу статус "расчитан" в базе данных
     * @param bot
     * @param chatId
     * @param id
     * @returns
     */
    async resolveExpense(bot: PushkaBot, chatId: number, id: number) {
        try {
            await bot.db.query("UPDATE expenses SET resolve = true WHERE expense_id = $1;", [id]);
            await bot.sendMessage(chatId, "Расход успешно расчитан, спасибо");
        } catch (err) {
            await bot.sendMessage(chatId, "Ошибка расчёта расхода, попробуйте ещё раз");
        }
    }

    /**
     * Функция удаляет все расходы из базы данных
     * @param bot
     * @param msg
     */
    async deleteAllExpenses(bot: PushkaBot, msg: Message) {
        const chatId = msg.chat.id;
        try {
            await bot.db.query("DELETE FROM expenses");
            await bot.db.query("ALTER SEQUENCE expenses_expense_id_seq RESTART WITH 1;");
            await bot.sendMessage(chatId, "Все расходы удалены");
        } catch (err) {
            await bot.sendMessage(chatId, "Ошибка удаления расходов, попробуйте ещё раз");
        }
    }

    /**
     * Функция обнуляет все статусы процессов создания или удаления расхода
     * @param bot
     * @param chatId
     */
    deleteStates(bot: PushkaBot, chatId: number) {
        delete this.newExpenseProcess[chatId];
        this.deleteExpenseProcess = false;
        bot.process = false;
    }
}
