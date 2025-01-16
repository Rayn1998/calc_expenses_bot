import TelegramBot from "node-telegram-bot-api";
import { Pool } from "pg";
import PushkaBot from "./bot/bot.service";
import * as process from "process";
import { botKey, dbData } from "./constant";
import Members from "./member/member.service";
import Expenses from "./expense/expense.service";
import Debts from "./debt/debt.service";

const telegramBot = new TelegramBot(botKey, { polling: true });
const dataBasePool = new Pool(dbData);
const membersService = new Members();
const expensesService = new Expenses();
const debtsService = new Debts();

const pushkaBot = new PushkaBot(
    telegramBot,
    dataBasePool,
    membersService,
    expensesService,
    debtsService,
);

export default pushkaBot;
