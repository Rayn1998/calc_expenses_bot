import assert from "node:assert";
import test from "node:test";
import { isMessage, isCallbackQuery } from "./typeguards";

test("Check that msg is Message type", () => {
    const inputMessage = {
        text: "InputMessage",
        chat: {},
    };
    assert.ok(isMessage(inputMessage));
});

test("Check that msg is CallbackQuery type", () => {
    const inputMessage = {
        data: "InputMessage",
        id: 1,
    };
    assert.ok(isCallbackQuery(inputMessage));
});
