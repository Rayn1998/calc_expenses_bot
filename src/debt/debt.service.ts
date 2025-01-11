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
    amount: number;
    debtorsIds: number[];
    debtorsIdsForDB?: number[];
    towhom?: number;
    debtsAmounts?: number[];
    currentDebtor?: IMember;
    expenseId?: number;
}

export class Debts {
    newDebtProcess: { [chatId: number]: INewDebtProcess };
    deleteDebtProcess: boolean;

    constructor() {
        this.newDebtProcess = {};
        this.deleteDebtProcess = false;
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

    async calcdebts(bot: PushkaBot, msg: Message): Promise<void> {
        const chatId = msg.chat.id;

        try {
            const debts: IDebt[] = (await bot.db.query("SELECT * FROM debts"))
                .rows;

            const members: IMember[] = (
                await bot.db.query("SELECT * FROM members")
            ).rows;

            if (debts.length === 0) {
                await bot.sendMessage(chatId, "Нет долгов для расчета.");
                return;
            }

            const debtMap: { [key: number]: { [key: number]: number } } = {};

            for (const debt of debts) {
                const { debt: amount, towhom, whosedebt, resolve } = debt;

                if (!debtMap[whosedebt]) debtMap[whosedebt] = {};
                if (!debtMap[whosedebt][towhom]) debtMap[whosedebt][towhom] = 0;

                if (!resolve) {
                    debtMap[whosedebt][towhom] += amount;
                }
            }

            let message = "Текущие долги между участниками:\n";

            for (const debtorId in debtMap) {
                for (const creditorId in debtMap[debtorId]) {
                    const amountOwed = debtMap[debtorId][creditorId];
                    if (amountOwed > 0) {
                        const debtorName = members.find(
                            (member) => member.member_id === +debtorId,
                        )?.name;
                        const creditorName = members.find(
                            (member) => member.member_id === +creditorId,
                        )?.name;

                        message += `- ${debtorName} должен ${creditorName} ${amountOwed}\n`;
                    } else {
                        message = "Долгов нет!";
                    }
                }
            }

            await bot.sendMessage(chatId, message);
        } catch (err) {
            console.error("Ошибка расчета долгов:", err);
        }
    }

    async solveAllDebts(bot: PushkaBot, msg: Message) {
        const chatId = msg.chat.id;

        try {
            await bot.db.query("UPDATE debts SET resolve = true;");
            await bot.sendMessage(chatId, "Все долги анулированы");
            return;
        } catch (err) {
            await bot.sendMessage(chatId, "Ошибка анулирования долгов");
            return;
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

        if (bot.checkInSomeProcess() && bot.checkAddCommands(inputData)) {
            await bot.sendMessage(
                chatId,
                "Вы начали, но не завершили процесс создания или добавления. Пожалуйста, завершите его или отмените",
                {
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
                },
            );
            return;
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

                    process.amount = selectedExpense.amount;
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

                    if (amount > process.amount) {
                        await bot.sendMessage(
                            chatId,
                            "Долг не может быть больше расхода, повторите ввод, пожалуйста",
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
                        bot.setInSomeProcess(false);
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

        bot.setInSomeProcess(true);
        this.newDebtProcess[chatId] = {
            step: 1,
            amount: 0,
            debtorsIds: [],
            debtsAmounts: [],
        };

        const options: InlineKeyboardButton[] = expenses!.map((expense) => ({
            text: `${expense.amount} в ${expense.description}`,
            callback_data: `${expense.expense_id}`,
        }));

        options.push({
            text: "Отмена",
            callback_data: "cancel",
        });

        await bot.sendMessage(
            chatId,
            "Выберите, какой расход сейчас посчитаем:",
            {
                reply_markup: {
                    inline_keyboard: [...options.map((button) => [button])],
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

    async deleteOneDebt(bot: PushkaBot, msg: Message | CallbackQuery) {
        let chatId = 0;
        let inputData = "";

        if (isMessage(msg)) {
            chatId = msg.chat.id;
            inputData = msg.text!;
        } else if (isCallbackQuery(msg)) {
            chatId = msg.message!.chat.id;
            inputData = msg.data!;
        }

        const process = this.deleteDebtProcess;

        const debts: IDebt[] = (await bot.db.query("SELECT * FROM debts;"))
            .rows;
        const members: IMember[] = (await bot.db.query("SELECT * FROM members"))
            .rows;

        if (process) {
            switch (process) {
                case true:
                    const debt_id = +inputData;
                    if (debt_id && typeof debt_id === "number") {
                        await bot.db.query(
                            "DELETE FROM debts WHERE debt_id = $1",
                            [debt_id],
                        );
                        await bot.sendMessage(chatId, "Долг успешно удалён");
                    }

                    this.deleteDebtProcess = false;
                    bot.setInSomeProcess(false);
                    break;
                default:
                    await bot.sendMessage(
                        chatId,
                        "Ошибка удаления долга, попробуйте ещё раз",
                    );

                    this.deleteDebtProcess = false;
                    bot.setInSomeProcess(false);
                    break;
            }
            return;
        }

        this.deleteDebtProcess = true;
        bot.setInSomeProcess(true);
        const options: InlineKeyboardButton[] = debts.map((debt) => ({
            text: `Долг ${debt.debt} ${
                members.find((member) => member.member_id === debt.whosedebt)
                    ?.name
            } для ${
                members.find((member) => member.member_id === debt.towhom)?.name
            }`,
            callback_data: `${debt.debt_id}`,
        }));

        await bot.sendMessage(chatId, "Выберите какой долг удалить:", {
            reply_markup: {
                inline_keyboard: [...options.map((button) => [button])],
            },
        });
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
