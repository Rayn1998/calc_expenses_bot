import {
    CallbackQuery,
    InlineKeyboardButton,
    Message,
} from "node-telegram-bot-api";
import { PushkaBot } from "../bot/bot.service";
import { IDebt } from "./debt.interface";
import { IMember } from "../member/member.interface";
import { isMessage, isCallbackQuery } from "../ts/typeguards";

interface INewDebtProcess {
    step: number;
    debt: Partial<IDebt>;
    debtorsIds: number[];
    debtorsIdsForDB?: number[];
    towhom?: number;
    debtsAmounts?: number[];
    currentDebtor?: IMember;
    expenseId?: number;
}

export class Debts {
    newDebtProcess: { [chatId: number]: INewDebtProcess };

    constructor() {
        this.newDebtProcess = {};
    }

    async showAllFromDb(bot: PushkaBot, msg: Message) {
        const chatId = msg.chat.id;

        try {
            let members: IMember[] = [];
            await bot.members
                .getAllFromDb(bot)
                .then((mems) => {
                    mems !== null
                        ? (members = mems)
                        : new Error("Can't get members");
                })
                .catch((err) => {
                    console.error(err);
                });

            const debts: IDebt[] = (await bot.db.query("SELECT * FROM debts"))
                .rows;
            if (debts.length === 0) {
                bot.sendMessage(chatId, "Долгов пока нет");
            } else {
                let message = "Текущие долги:";
                for (const debt of debts) {
                    const debtState = debt.resolve
                        ? "Погашен ✅"
                        : "Не погашен ⛔️";
                    const whoseDebt = members.find(
                        (m) => m.member_id === debt.whosedebt,
                    )?.name;
                    const toWhom = members.find(
                        (m) => m.member_id === debt.towhom,
                    )?.name;
                    message +=
                        "\n" +
                        `- ${whoseDebt} должен ${toWhom} ${debt.debt}, статус: ${debtState}`;
                }
                await bot.sendMessage(chatId, message);
            }
        } catch (err) {
            await bot.sendMessage(chatId, "Ошибка вывода долгов");
        }
    }

    async createDebt(bot: PushkaBot, msg: Message | CallbackQuery) {
        let chatId = 0;
        let inputData = "";

        if (isMessage(msg)) {
            chatId = msg.chat.id;
            inputData = msg.text!;
        } else if (isCallbackQuery(msg)) {
            chatId = msg.message!.chat.id;
            inputData = msg.data!;
        }

        const expenses = await bot.expenses.getAllUnresolvedExpenses(bot);
        const debtors = await bot.members.getAllFromDb(bot);

        if (!expenses || expenses.length === 0) {
            await bot.sendMessage(
                chatId,
                "Пока что нечего расчитывать, сначала создайте расход",
            );
            return;
        }

        if (!debtors || debtors.length === 0) {
            await bot.sendMessage(chatId, "Нет участников для расчета долгов.");
            return;
        }

        const process = this.newDebtProcess[chatId];

        if (process) {
            switch (process.step) {
                case 1:
                    const expenseId = Number(inputData);
                    const selectedExpense = expenses.find(
                        (expense) => expense.expense_id === expenseId,
                    )!;

                    if (!selectedExpense) {
                        await bot.sendMessage(
                            chatId,
                            "Выбранный расход не найден.",
                        );
                        return;
                    }

                    process.expenseId = selectedExpense.expense_id;
                    process.towhom = selectedExpense.whopaid;
                    process.debtorsIds = [...selectedExpense.whoparticipated];
                    process.debtorsIdsForDB = [
                        ...selectedExpense.whoparticipated,
                    ];
                    process.step = 2;

                    await this.promptNextDebtor(bot, chatId, process, debtors);
                    break;

                case 2:
                    const amount = Number(inputData);
                    if (isNaN(amount) || amount <= 0) {
                        await bot.sendMessage(
                            chatId,
                            "Введите корректную сумму",
                        );
                        return;
                    }

                    process.debtsAmounts!.push(amount);

                    if (process.debtorsIds.length > 0) {
                        await this.promptNextDebtor(
                            bot,
                            chatId,
                            process,
                            debtors,
                        );
                    } else {
                        await this.saveDebts(bot, process);
                        await bot.sendMessage(
                            chatId,
                            "Долги успешно сохранены!",
                        );
                        await bot.expenses.resolveExpense(
                            bot,
                            chatId,
                            process.expenseId!,
                        );
                        delete this.newDebtProcess[chatId];
                    }
                    break;

                default:
                    await bot.sendMessage(
                        chatId,
                        "Произошла ошибка составления долга, попробуйте ещё раз",
                    );
                    break;
            }
            return;
        }

        this.newDebtProcess[chatId] = {
            step: 1,
            debt: {},
            debtorsIds: [],
            debtsAmounts: [],
        };

        const options: InlineKeyboardButton[] = expenses!.map((expense) => ({
            text: `${expense.amount} в ${expense.description}`,
            callback_data: `${expense.expense_id}`,
        }));

        await bot.sendMessage(
            chatId,
            "Выберите, какой расход сейчас посчитаем:",
            {
                reply_markup: {
                    inline_keyboard: [options],
                },
            },
        );
    }

    private async promptNextDebtor(
        bot: PushkaBot,
        charId: number,
        process: INewDebtProcess,
        debtors: IMember[],
    ) {
        const currentDebtorId = process.debtorsIds.pop();
        process.currentDebtor = debtors.find(
            (debtor) => debtor.member_id === currentDebtorId,
        );

        if (process.currentDebtor) {
            await bot.sendMessage(
                charId,
                `Сколько наел(а) ${process.currentDebtor.name}?`,
            );
        }
    }

    private async saveDebts(bot: PushkaBot, process: INewDebtProcess) {
        for (let i = 0; i < process.debtorsIdsForDB!.length; i++) {
            const debtAmount = process.debtsAmounts!.pop()!;
            const debtorId = process.debtorsIdsForDB![i];

            const debt: Omit<IDebt, "debt_id"> = {
                debt: debtAmount,
                towhom: process.towhom!,
                whosedebt: debtorId,
                fromexpense: process.expenseId!,
                resolve: false,
            };

            await bot.db.query(
                `INSERT INTO debts(debt, towhom, whosedebt, fromexpense, resolve)
                VALUES ($1, $2, $3, $4, false)`,
                [debt.debt, debt.towhom, debt.whosedebt, debt.fromexpense],
            );
        }
    }

    async deleteAllDebts(bot: PushkaBot, msg: Message) {
        const chatId = msg.chat.id;
        try {
            await bot.db.query("DELETE FROM debts");
            await bot.db.query(
                "ALTER SEQUENCE debts_debt_id_seq RESTART WITH 1;",
            );
            await bot.sendMessage(chatId, "Все долги успешно удалены");
        } catch (err) {
            await bot.sendMessage(chatId, "Ошибка удаления долгов");
        }
    }
}
