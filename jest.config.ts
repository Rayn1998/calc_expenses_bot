import type { Config } from "jest";

const config: Config = {
    verbose: true,
    preset: "ts-jest",
    testEnvironment: "node", // Окружение для тестов
    extensionsToTreatAsEsm: [".ts"], // Указывает Jest обрабатывать файлы .ts как ESM
    rootDir: "./src",
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                useESM: true, // Если вы используете ESM
            },
        ],
    },
};

export default config;
