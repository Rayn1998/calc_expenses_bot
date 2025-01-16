import { CallbackQuery, InlineKeyboardButton, Message } from "node-telegram-bot-api";
import PushkaBot from "../bot/bot.service";
import IMember from "./member.interface";

export default class Members {
    newMemberProcess: boolean;
    deleteMemberProcess: boolean;

    constructor() {
        this.newMemberProcess = false;
        this.deleteMemberProcess = false;
    }

    /**
     * Функция выводит в чат всех участников одним общим списком
     * @param bot
     * @param msg
     */
    async showAllFromDb(bot: PushkaBot, msg: Message): Promise<void> {
        const chatId = msg.chat.id;
        const members: IMember[] = (await bot.db.query("SELECT * FROM members")).rows;

        if (members.length === 0) {
            bot.sendMessage(chatId, "Пользователей пока нет");
            return;
        } else {
            let message = "Текущие участники:";
            for (const member of members) {
                message += "\n" + `- ${member.name}`;
            }
            await bot.sendMessage(chatId, message);
        }
    }

    /**
     * Функция выводит объект всех участников из базы данных
     * @param bot
     * @returns
     */
    async getAllFromDb(bot: PushkaBot): Promise<IMember[] | null> {
        const members: IMember[] = (await bot.db.query("SELECT * FROM members")).rows;

        if (members.length === 0) {
            return null;
        } else {
            return members;
        }
    }

    /**
     * Функция позволяет создать нового пользователя, задавая вопросы пользователю в чате
     * @param bot
     * @param msg
     * @returns
     */
    async createMember(bot: PushkaBot, msg: Message) {
        const { chatId, inputData } = bot.getChatIdAndInputData(msg);
        const process = this.newMemberProcess;

        if (await bot.checkInSomeProcess(msg)) {
            return;
        }

        if (process) {
            switch (process) {
                case true:
                    const name = msg.text;
                    await bot.db.query(`INSERT INTO members(name) VALUES($1)`, [name]);
                    await bot.sendMessage(chatId, `Создан участник с именем ${name}`);

                    this.deleteStates(bot);
                    break;

                default:
                    await bot.sendMessage(msg.chat.id, "Ошибка создания пользователя");
                    this.deleteStates(bot);
                    break;
            }
            return;
        }

        this.newMemberProcess = true;
        bot.process = true;

        await bot.sendMessage(msg.chat.id, "Введите имя участника", {
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
     * Функция позволяет удалить 1го конкретного пользователя, выбирает пользователь из списка в чате
     * @param bot
     * @param msg
     * @returns
     */
    async deleteOneMember(bot: PushkaBot, msg: Message | CallbackQuery) {
        const { chatId, inputData } = bot.getChatIdAndInputData(msg);

        const process = this.deleteMemberProcess;

        if (await bot.checkInSomeProcess(msg)) {
            return;
        }

        const members: IMember[] = (await bot.db.query("SELECT * FROM members")).rows;

        if (members.length === 0) {
            await bot.sendMessage(chatId, "Некого удалять");
            return;
        }

        if (process) {
            switch (process) {
                case true:
                    const memberId = +inputData;
                    if (memberId && typeof memberId === "number") {
                        await bot.db.query("DELETE FROM member WHERE expense_id = $1", [memberId]);
                        await bot.sendMessage(chatId, "Участник успешно удалён");
                    }

                    this.deleteStates(bot);
                    break;

                default:
                    await bot.sendMessage(chatId, "Ошибка удаления участника, попробуйте ещё раз");

                    this.deleteStates(bot);
                    break;
            }
            return;
        }

        this.deleteMemberProcess = true;
        bot.process = true;

        const options: InlineKeyboardButton[] = members.map((member) => ({
            text: `${member.name}`,
            callback_data: `${member.member_id}`,
        }));

        options.push({
            text: "Отмена",
            callback_data: "cancel",
        });

        await bot.sendMessage(chatId, "Выберите, кого же удаляем", {
            reply_markup: {
                inline_keyboard: [...options.map((button) => [button])],
            },
        });
    }

    /**
     * Функция удаляет всех участников из базы данных
     * @param bot
     * @param msg
     */
    async deleteAllMembers(bot: PushkaBot, msg: Message) {
        const chatId = msg.chat.id;
        try {
            await bot.db.query("DELETE FROM members");
            await bot.db.query("ALTER SEQUENCE members_member_id_seq RESTART WITH 1;");
            await bot.sendMessage(chatId, "Все пользователи удалены");
            console.log("All members deleted and ID counter restarted.");
        } catch (err) {
            await bot.sendMessage(chatId, "Ошибка удаления пользователей");
            console.error("Error deleting all members:", err);
        }
    }

    /**
     * Функция обнуляет все статусы процессов создания или удаления пользователя
     * @param bot
     * @param chatId
     */
    deleteStates(bot: PushkaBot) {
        this.newMemberProcess = false;
        this.deleteMemberProcess = false;
        bot.process = false;
    }
}
