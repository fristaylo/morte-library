import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "mysql",
    schema: "./api/db/schema.ts",
    out: "./api/drizzle",
});
