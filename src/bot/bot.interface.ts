export default interface IBot {
    bot: unknown;
    sendMessage: (...args: any[]) => void;
    connectToDb: (...args: any[]) => void;
    listen: (...args: any[]) => void;
    init: (...args: any[]) => void;
}
