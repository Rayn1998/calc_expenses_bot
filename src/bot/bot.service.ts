import TelegramBot from "node-telegram-bot-api";
import { botKey, dbData } from "../constant";
import { botCommands } from "./bot.commands";
import { Members } from "../member/member.service";
import { Expenses } from "../expense/expense.service";
import { Pool } from "pg";

export class PushkaBot {
    private bot: TelegramBot;
    members: Members;
    expenses: Expenses;
    db: Pool;

    constructor() {
        this.db = new Pool(dbData);
        this.bot = new TelegramBot(botKey, { polling: true });
        this.members = new Members(this);
        this.expenses = new Expenses();
    }

    async sendMessage(
        chatId: number,
        message: string,
        options?: TelegramBot.CopyMessageOptions,
    ) {
        try {
            await this.bot.sendMessage(chatId, message, options);
        } catch (err) {
            throw err;
        }
    }

    async setCommands() {
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
                    command: "help",
                    description: "Доступные команды",
                },
                {
                    command: "getmembers",
                    description: "получить всех участников",
                },
                {
                    command: "deletemembers",
                    description: "удалить всех участников",
                },
            ]);
        } catch (err) {
            console.error("Ошибка при установке команд: ", err);
        }
    }

    async connectToDb() {
        try {
            const connection = await this.db.connect();
            if (connection) {
                console.log("DataBase connection established");
            }
        } catch (err) {
            console.log("Can't connect to db");
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

        // this.bot.onText(/\/addexpense/, async (msg) => {});

        this.bot.onText(/\/getmembers/, async (msg) => {
            const chatId = msg.chat.id;
            const members = await this.members.getAllFromDb();

            await this.sendMessage(chatId, `${members}`);
        });

        this.bot.onText(/\/deletemembers/, async (msg) => {
            const chatId = msg.chat.id;
            await this.members.deleteAllMembers(chatId);
        });

        this.bot.on("message", async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;

            if (this.members.newMemberProcess[chatId]) {
                await this.members.createMember(this, msg);
                return;
            }

            if (text && botCommands.some((regex) => regex.test(text))) {
                return;
            }

            await this.sendMessage(msg.chat.id, "Вы что-то написали");
        });
    }
}
