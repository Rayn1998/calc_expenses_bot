import PushkaBot from "./bot.service";
import Members from "../member/member.service";
import Expenses from "../expense/expense.service";
import Debts from "../debt/debt.service";
import { Pool } from "pg";
import TelegramBot from "node-telegram-bot-api";
import { describe, it, mock, before } from "node:test";
import assert from "node:assert";

const mockTelegramBot = mock.module("node-telegram-bot-api") as unknown as TelegramBot;
const mockDb = mock.module("pg") as unknown as Pool;
const mockMembers = mock.module("../member/member.service") as unknown as Members;
const mockExpenses = mock.module("../expense/expense.service") as unknown as Expenses;
const mockDebts = mock.module("../debt/debt.service") as unknown as Debts;

describe("PushkaBot Class", () => {
    let bot: PushkaBot;
    const msg = { chat: { id: 123 }, text: "test_text" } as unknown as TelegramBot.Message;

    before(() => {
        bot = new PushkaBot(mockTelegramBot, mockDb, mockMembers, mockExpenses, mockDebts);
        bot.checkCommands = mock.fn(() => true);
        bot.checkAddCommands = mock.fn(() => true);
        bot.sendMessage = mock.fn((chatId: number, message: string, options?: any) => {
            return Promise.resolve();
        });
    });

    it("PushkaBot takes chatId and inputData correctly", () => {
        const { chatId, inputData } = bot.getChatIdAndInputData(msg);

        assert.strictEqual(chatId, 123);
        assert.strictEqual(inputData, "test_text");
    });

    it("Testing the checkInSomeProcess method", async () => {
        bot.process = true;
        bot.getChatIdAndInputData = mock.fn(() => ({
            chatId: 123,
            inputData: "test",
        }));
        const res = await bot.checkInSomeProcess(msg);
        assert.ok(res);

        bot.process = false;

        const badRes = await bot.checkInSomeProcess(msg);
        assert.strictEqual(false, badRes);
    });
});
