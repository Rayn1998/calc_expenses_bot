import TelegramBot, {
    CallbackQuery,
    CopyMessageOptions,
    Message,
} from "node-telegram-bot-api";
import { botKey, dbData } from "../constant";
import { botAddCommands, botCommands } from "./bot.commands";
import { Members } from "../member/member.service";
import { Expenses } from "../expense/expense.service";
import { Pool } from "pg";
import { Debts } from "../debt/debt.service";
import { isCallbackQuery, isMessage } from "../ts/typeguards";

export class PushkaBot {
    process: boolean;
    private bot: TelegramBot;
    members: Members;
    expenses: Expenses;
    debts: Debts;
    db: Pool;

    constructor() {
        this.db = new Pool(dbData);
        this.bot = new TelegramBot(botKey, { polling: true });
        this.members = new Members();
        this.expenses = new Expenses();
        this.debts = new Debts();
        this.process = false;
    }

    async checkInSomeProcess(msg: Message | CallbackQuery): Promise<boolean> {
        const { chatId, inputData } = this.getChatIdAndInputData(msg);
        if (this.process && this.checkAddCommands(inputData)) {
            await this.sendMessage(
                chatId,
                "Вы начали, но не завершили процесс создания или добавления. Пожалуйста, завершите его или отмените",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "Отменить",
                                    callback_data: "cancel",
                                },
                            ],
                        ],
                    },
                },
            );
            return true;
        }
        return false;
    }

    getChatIdAndInputData(msg: Message | CallbackQuery): {
        chatId: number;
        inputData: string;
    } {
        let chatId = 0;
        let inputData = "";

        if (isMessage(msg)) {
            chatId = msg.chat.id;
            inputData = msg.text!;
        } else if (isCallbackQuery(msg)) {
            chatId = msg.message!.chat.id;
            inputData = msg.data!;
        }

        return { chatId, inputData };
    }

    checkCommands(text: string): boolean {
        if (botCommands.some((regex) => regex.test(text))) {
            return true;
        } else {
            return false;
        }
    }

    checkAddCommands(text: string): boolean {
        if (botAddCommands.some((regex) => regex.test(text))) {
            return true;
        } else {
            return false;
        }
    }

    async cancelAllStarted(chatId: number) {
        this.members.deleteStates(this);
        this.expenses.deleteStates(this, chatId);
        this.debts.deleteStates(this, chatId);

        await this.sendMessage(chatId, "Отмена");
    }

    async sendMessage(
        chatId: number,
        message: string,
        options?: CopyMessageOptions,
    ) {
        try {
            await this.bot.sendMessage(chatId, message, options);
        } catch (err) {
            throw err;
        }
    }

    async setCommands(): Promise<boolean> {
        try {
            await this.bot.setMyCommands([
                {
                    command: "start",
                    description: "Приветствие бота",
                },
                {
                    command: "addmember",
                    description: "Добавить участника в расходы",
                },
                {
                    command: "addexpense",
                    description: "Добавить новый расход",
                },
                {
                    command: "adddebt",
                    description: "Добавить новый долг",
                },
                {
                    command: "showmemberslist",
                    description: "Получить списко всех участников",
                },
                {
                    command: "showexpenseslist",
                    description: "Получить список всех расходов",
                },
                {
                    command: "showdebtlist",
                    description: "Получить список всех долгов",
                },
                {
                    command: "calcdebts",
                    description: "Расчитать все долги",
                },
                {
                    command: "deletemembers",
                    description: "Удалить всех участников",
                },
                {
                    command: "deleteexpenses",
                    description: "Удалить все расходы",
                },
                {
                    command: "deleteonemember",
                    description: "Удалить 1го участника",
                },
                {
                    command: "deleteoneexpense",
                    description: "Удалить 1 расход",
                },
                {
                    command: "deleteonedebt",
                    description: "Удалить 1 долг",
                },
                {
                    command: "deletedebts",
                    description: "Удалить все долги",
                },
                {
                    command: "solvealldebts",
                    description: "Зачесть все долги",
                },
            ]);
            return true;
        } catch (err) {
            console.error("Ошибка при установке команд: ", err);
            return false;
        }
    }

    async connectToDb(): Promise<boolean> {
        try {
            const connection = await this.db.connect();
            if (connection) {
                console.log("DataBase connection established");
            }
            return true;
        } catch (err) {
            console.log("Can't connect to db");
            return false;
        }
    }

    async listen() {
        this.bot.onText(/\/start/, async (msg) => {
            await this.sendMessage(
                msg.chat.id,
                "Привет, я бот, помогу с подсчётом расходов",
            );
        });

        this.bot.onText(/\/addmember/, async (msg) => {
            await this.members.createMember(this, msg);
        });

        this.bot.onText(/\/addexpense/, async (msg) => {
            await this.expenses.createExpense(this, msg);
        });

        this.bot.onText(/\/adddebt/, async (msg) => {
            await this.debts.createDebt(this, msg);
        });

        this.bot.onText(/\/showmemberslist/, async (msg) => {
            await this.members.showAllFromDb(this, msg);
        });

        this.bot.onText(/\/showexpenseslist/, async (msg) => {
            await this.expenses.showAllFromDb(this, msg);
        });

        this.bot.onText(/\/calcdebts/, async (msg) => {
            await this.debts.calcdebts(this, msg);
        });

        this.bot.onText(/\/showdebtlist/, async (msg) => {
            await this.debts.showAllFromDb(this, msg);
        });

        this.bot.onText(/\/deleteonemember/, async (msg) => {
            await this.members.deleteOneMember(this, msg);
        });

        this.bot.onText(/\/deleteoneexpense/, async (msg) => {
            await this.expenses.deleteOneExpense(this, msg);
        });

        this.bot.onText(/\/deleteonedebt/, async (msg) => {
            await this.debts.deleteOneDebt(this, msg);
        });

        this.bot.onText(/\/deletemembers/, async (msg) => {
            await this.members.deleteAllMembers(this, msg);
        });

        this.bot.onText(/\/deleteexpenses/, async (msg) => {
            await this.expenses.deleteAllExpenses(this, msg);
        });

        this.bot.onText(/\/deletedebts/, async (msg) => {
            await this.debts.deleteAllDebts(this, msg);
        });

        this.bot.onText(/\/solvealldebts/, async (msg) => {
            await this.debts.solveAllDebts(this, msg);
        });

        this.bot.on("message", async (msg) => {
            const { chatId, inputData } = this.getChatIdAndInputData(msg);

            if (
                this.checkAddCommands(inputData) ||
                this.checkCommands(inputData)
            ) {
                return;
            }

            if (this.process) {
                if (this.members.newMemberProcess) {
                    await this.members.createMember(this, msg);
                    return;
                }

                if (this.expenses.newExpenseProcess[chatId]) {
                    await this.expenses.createExpense(this, msg);
                    return;
                }

                if (this.debts.newDebtProcess[chatId]) {
                    await this.debts.createDebt(this, msg);
                    return;
                }
            }
        });

        this.bot.on("callback_query", async (query) => {
            const { chatId, inputData } = this.getChatIdAndInputData(query);

            if (!chatId || !inputData) return;

            if (inputData === "cancel") {
                await this.cancelAllStarted(chatId);
                return;
            }

            if (this.process) {
                if (this.members.deleteMemberProcess) {
                    await this.members.deleteOneMember(this, query);
                    return;
                }

                if (this.expenses.newExpenseProcess[chatId]) {
                    await this.expenses.createExpense(this, query);
                    return;
                }

                if (this.expenses.deleteExpenseProcess) {
                    await this.expenses.deleteOneExpense(this, query);
                    return;
                }

                if (this.debts.newDebtProcess[chatId]) {
                    await this.debts.createDebt(this, query);
                    return;
                }

                if (this.debts.deleteDebtProcess) {
                    await this.debts.deleteOneDebt(this, query);
                    return;
                }
            }
        });
    }
}
