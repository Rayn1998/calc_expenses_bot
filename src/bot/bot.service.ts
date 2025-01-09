import TelegramBot from "node-telegram-bot-api";
import { botKey, registeredCommands } from "../constant";
import { Members } from "../member/member.service";
import { addMember } from "../member/methods/addMember.method";
import { Expenses } from "../expense/expense.service";
import { Pool } from "pg";

export class PushkaBot {
    private bot: TelegramBot;
    members: Members;
    expenses: Expenses;
    db: Pool;

    constructor() {
        this.db = new Pool({
            user: "rayn",
            host: "localhost",
            database: "pushkaBot",
            password: "postgresql",
            port: 5432,
        });
        this.bot = new TelegramBot(botKey, { polling: true });
        this.members = new Members(this.db);
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
            ]);
        } catch (err) {
            console.error("Ошибка при установке команд: ", err);
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
            await this.members.createMember(this, msg.chat.id);
        });

        // this.bot.onText(/\/addexpense/, async (msg) => {});

        this.bot.onText(/\/getmembers/, async (msg) => {
            const chatId = msg.chat.id;
            const members = await this.members.getAllFromDb();

            await this.sendMessage(chatId, `${members}`);
        });

        this.bot.on("message", async (msg) => {
            const text = msg.text;
            const isNewMemberProcess = await addMember(this, msg);
            // const isNewExpenseProcess = await

            if (text && registeredCommands.some((regex) => regex.test(text))) {
                return;
            }

            if (isNewMemberProcess) return;

            await this.sendMessage(msg.chat.id, "Вы что-то написали");
        });
    }
}
