import TelegramBot, {
    CopyMessageOptions,
    Message,
} from "node-telegram-bot-api";
import { botKey, dbData } from "../constant";
import { botAddCommands, botCommands } from "./bot.commands";
import { Members } from "../member/member.service";
import { Expenses } from "../expense/expense.service";
import { Pool } from "pg";
import { Debts } from "../debt/debt.service";

export class PushkaBot {
    private bot: TelegramBot;
    private inSomeProcess: boolean;
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
        this.inSomeProcess = false;
    }

    checkInSomeProcess(): boolean {
        if (this.inSomeProcess) {
            return true;
        }
        return false;
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

    setInSomeProcess(state: boolean) {
        this.inSomeProcess = state;
    }

    async cancelAllStarted(chatId: number) {
        delete this.members.newMemberProcess[chatId];
        delete this.expenses.newExpenseProcess[chatId];
        this.expenses.deleteExpenseProcess = false;
        delete this.debts.newDebtProcess[chatId];
        this.debts.deleteDebtProcess = false;
        this.inSomeProcess = false;

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
            const chatId = msg.chat.id;
            const text = msg.text;

            if (this.checkAddCommands(text!) || this.checkCommands(text!)) {
                return;
            }

            if (this.checkInSomeProcess()) {
                if (this.members.newMemberProcess[chatId]) {
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

            // await this.sendMessage(msg.chat.id, "Вы что-то написали");
        });

        this.bot.on("callback_query", async (query) => {
            const chatId = query.message!.chat.id;
            const data = query.data;

            if (!chatId || !data) return;

            if (data === "cancel") {
                await this.cancelAllStarted(chatId);
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
        });
    }
}
