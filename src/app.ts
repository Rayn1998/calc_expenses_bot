import { PushkaBot } from "./bot/bot.service";

export class App {
    private bot: PushkaBot;

    constructor() {
        this.bot = new PushkaBot();
    }

    async init() {
        await this.bot.connectToDb();
        await this.bot.setCommands();
        await this.bot.listen();
    }
}
