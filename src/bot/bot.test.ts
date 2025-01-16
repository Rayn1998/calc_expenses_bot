import PushkaBot from "./bot.service";
import Members from "../member/member.service";
import Expenses from "../expense/expense.service";
import Debts from "../debt/debt.service";
import { Pool } from "pg";
import TelegramBot from "node-telegram-bot-api";

describe("PushkaBot Class", () => {
    test("PushkaBot should initialize correctly", () => {
        const botMock = jest.fn() as unknown as TelegramBot;
        const dbMock = jest.fn() as unknown as Pool;
        const membersMock = jest.fn() as unknown as Members;
        const expensesMock = jest.fn() as unknown as Expenses;
        const debtsMock = jest.fn() as unknown as Debts;

        const pushkaBot = new PushkaBot(botMock, dbMock, membersMock, expensesMock, debtsMock);

        expect(pushkaBot.bot).toBe(botMock);
        expect(pushkaBot.db).toBe(dbMock);
        expect(pushkaBot.members).toBe(membersMock);
        expect(pushkaBot.expenses).toBe(expensesMock);
        expect(pushkaBot.debts).toBe(debtsMock);
    });

    // test("Check if connecting to data base", async () => {
    //     const mockDbConnection = jest.spyOn(pushkaBot, "connectToDb").mockResolvedValue(true);

    //     const result = await pushkaBot.connectToDb();

    //     expect(mockDbConnection).toHaveBeenCalled();
    //     expect(result).toBeTruthy();
    // });

    // test("Should throw an error if database connection fails", async () => {
    //     jest.spyOn(bot, "connectToDb").mockRejectedValue(new Error("Connection failed"));

    //     await expect(bot.connectToDb()).rejects.toThrow("Connection failed");
    // });
});
