import { PushkaBot } from "./bot/bot.service";
import * as process from "process";

export class App {
    private bot: PushkaBot;

    constructor() {
        this.bot = new PushkaBot();
    }

    async init() {
        const dbConnection = await this.bot.connectToDb();
        const settingCommands = await this.bot.setCommands();
        if (!dbConnection || !settingCommands) {
            console.error("Something doesn't work, check");
            process.exit(1);
        }
        await this.bot.listen();
    }
}
