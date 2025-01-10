import TelegramBot, { CopyMessageOptions } from "node-telegram-bot-api";
import { botKey, dbData } from "../constant";
import { botCommands } from "./bot.commands";
import { Members } from "../member/member.service";
import { Expenses } from "../expense/expense.service";
import { Pool } from "pg";
import { Debts } from "../debt/debt.service";

export class PushkaBot {
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
                    command: "showmembers",
                    description: "Получить всех участников",
                },
                {
                    command: "deletemembers",
                    description: "Удалить всех участников",
                },
                {
                    command: "addexpense",
                    description: "Добавить новый расход",
                },
                {
                    command: "showexpenses",
                    description: "Получить все расходы",
                },
                {
                    command: "deleteexpenses",
                    description: "Удалить все расходы",
                },
                {
                    command: "showdebts",
                    description: "Получить все долги",
                },
                {
                    command: "deletedebts",
                    description: "Удалить все долги",
                },
                // {
                //     command: "help",
                //     description: "Доступные команды",
                // },
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
            // TEST
            // await this.expenses.resolveExpense(this, msg, 1);
        });

        this.bot.onText(/\/addmember/, async (msg) => {
            await this.members.createMember(this, msg);
        });

        this.bot.onText(/\/showmembers/, async (msg) => {
            await this.members.showAllFromDb(this, msg);
        });

        this.bot.onText(/\/deletemembers/, async (msg) => {
            await this.members.deleteAllMembers(this, msg);
        });

        this.bot.onText(/\/addexpense/, async (msg) => {
            await this.expenses.createExpense(this, msg);
        });

        this.bot.onText(/\/showexpenses/, async (msg) => {
            await this.expenses.showAllFromDb(this, msg);
        });

        this.bot.onText(/\/deleteexpenses/, async (msg) => {
            await this.expenses.deleteAllExpenses(this, msg);
        });

        this.bot.onText(/\/showdebts/, async (msg) => {
            await this.debts.showAllFromDb(this, msg);
        });

        this.bot.onText(/\/deletedebts/, async (msg) => {
            await this.debts.deleteAllDebts(this, msg);
        });

        this.bot.on("message", async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;

            if (this.members.newMemberProcess[chatId]) {
                await this.members.createMember(this, msg);
                return;
            }

            if (this.expenses.newExpenseProcess[chatId]) {
                await this.expenses.createExpense(this, msg);
                return;
            }

            if (text && botCommands.some((regex) => regex.test(text))) {
                return;
            }

            await this.sendMessage(msg.chat.id, "Вы что-то написали");
        });

        this.bot.on("callback_query", async (query) => {
            const chatId = query.message!.chat.id;
            if (!chatId) return;
            if (this.expenses.newExpenseProcess[chatId]) {
                await this.expenses.createExpense(this, query);
                return;
            }
        });
    }
}
