import { join } from "node:path";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate as runMigrations } from "drizzle-orm/mysql2/migrator";
import { createPool } from "mysql2/promise";
import * as schema from "./schema";

export const db = drizzle(
    createPool({
        host: "db",
        user: "root",
        password: process.env.PASSWORD,
        database: "morte_library",
        charset: "utf8mb4",
        dateStrings: true,
        connectionLimit: 5,
    }),
    { schema, mode: "default" },
);

export async function migrate(): Promise<void> {
    await runMigrations(db, {
        migrationsFolder: join(import.meta.dirname, "../drizzle"),
    });
}
