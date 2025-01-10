import { Message } from "node-telegram-bot-api";
import { PushkaBot } from "../bot/bot.service";
import { IDebt } from "./debt.interface";
import { IMember } from "../member/member.interface";

export class Debts {
    newDebtProcess: {
        [chatId: number]: { step: number; debt: Partial<IDebt> };
    };

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
                        (m) => m.member_id === debt.toWhom,
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

    async createDebt(bot: PushkaBot, msg: Message) {
        const chatId = msg.chat.id;
        // const expenses = await bot.expenses.
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
