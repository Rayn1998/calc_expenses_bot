import { Pool } from "pg";
import path from "path";
import * as fs from "fs/promises";

const dbConfig = {
    user: "postgres",
    host: "localhost",
    password: "postgresql",
    port: 5432,
};

const sqlFile = path.join(__dirname, "..", "tables.sql");

const pool = new Pool(dbConfig);

(async () => {
    try {
        const sqlCommands = (await fs.readFile(sqlFile)).toString();

        const client = await pool.connect();
        console.log("Connected to PostgreSQL");

        try {
            await client.query("CREATE DATABASE calc_expenses_bot");
            console.log("Database calc_expenses_bot created");
        } catch (err) {
            console.error("Database might already exist");
            client.release();
            await pool.end();
            process.exit(1);
        } finally {
            client.release();
        }

        const dbPool = new Pool({ ...dbConfig, database: "calc_expenses_bot" });
        const dbClient = await dbPool.connect();

        try {
            await dbClient.query(sqlCommands);
            console.log("Database and tables created successfully");
        } catch (err) {
            console.log("Can't execute the sql commands");
        } finally {
            dbClient.release();
            await dbPool.end();
            console.log("Database connection closed");
        }
    } catch (err) {
        console.error("Error initializing database:", err);
    } finally {
        await pool.end();
        console.log("Pool has ended");
        process.exit(0);
    }
})();
