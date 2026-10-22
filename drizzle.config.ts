import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "mysql",
    schema: "./server/db/schema.ts",
    out: "./server/drizzle",
});
