import { isMessage, isCallbackQuery } from "./typeguards";

test("Check that msg is Message type", () => {
    const inputMessage = {
        text: "InputMessage",
        chat: {},
    };
    expect(isMessage(inputMessage)).toBeTruthy();
});

test("Check that msg is CallbackQuery type", () => {
    const inputMessage = {
        data: "InputMessage",
        id: 1,
    };
    expect(isCallbackQuery(inputMessage)).toBeTruthy();
});
