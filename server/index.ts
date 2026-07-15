import mysql from "mysql2/promise";
import { seed } from "./seed";

function env(name: string): string {
    const value = process.env[name];
    if (!value) {
        console.error(`Missing required env variable: ${name}`);
        process.exit(1);
    }
    return value;
}

const PORT = Number(env("PORT"));

const pool = mysql.createPool({
    host: env("DB_HOST"),
    port: Number(env("DB_PORT")),
    user: env("DB_USER"),
    password: env("DB_PASSWORD"),
    database: env("DB_NAME"),
    charset: "utf8mb4",
    dateStrings: true,
    connectionLimit: 5,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS books (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(191) NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    synopsis TEXT NULL,
    review MEDIUMTEXT NULL,
    rating TINYINT UNSIGNED NOT NULL DEFAULT 0,
    pages SMALLINT UNSIGNED NULL,
    width_px SMALLINT UNSIGNED NULL,
    height_px SMALLINT UNSIGNED NULL,
    spine_color CHAR(7) NOT NULL DEFAULT '#7ab8e0',
    spine_text_color CHAR(7) NOT NULL DEFAULT '#fdfaf4',
    cover_image MEDIUMBLOB NULL,
    cover_mime VARCHAR(64) NULL,
    spine_image MEDIUMBLOB NULL,
    spine_mime VARCHAR(64) NULL,
    date_read DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_books_slug (slug),
    KEY idx_books_author (author),
    KEY idx_books_rating (rating),
    KEY idx_books_date_read (date_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function waitForDb(): Promise<void> {
    for (let attempt = 1; attempt <= 30; attempt++) {
        try {
            await pool.query("SELECT 1");
            console.log("MySQL is up");
            return;
        } catch (err) {
            console.log(
                `MySQL not ready (attempt ${attempt}/30): ${
                    (err as Error).message
                }`,
            );
            await new Promise((r) => setTimeout(r, 2000));
        }
    }
    console.error("Could not connect to MySQL, giving up");
    process.exit(1);
}

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });
}

interface BookRow {
    id: number;
    slug: string;
    title: string;
    author: string;
    synopsis: string | null;
    review: string | null;
    rating: number;
    pages: number | null;
    widthPx: number | null;
    heightPx: number | null;
    spineColor: string;
    spineTextColor: string;
    hasCover: number;
    hasSpineImage: number;
    dateRead: string | null;
}

async function listBooks(): Promise<Response> {
    const [rows] = await pool.query(
        `SELECT id, slug, title, author, synopsis, review, rating, pages,
            width_px AS widthPx, height_px AS heightPx,
            spine_color AS spineColor, spine_text_color AS spineTextColor,
            (cover_image IS NOT NULL) AS hasCover,
            (spine_image IS NOT NULL) AS hasSpineImage,
            date_read AS dateRead
        FROM books
        ORDER BY date_read ASC, id ASC`,
    );
    const books = (rows as BookRow[]).map((r) => ({
        ...r,
        hasCover: Boolean(r.hasCover),
        hasSpineImage: Boolean(r.hasSpineImage),
    }));
    return json(books);
}

async function serveImage(
    slug: string,
    kind: "cover" | "spine",
): Promise<Response> {
    const [rows] = await pool.query(
        `SELECT ${kind}_image AS image, ${kind}_mime AS mime
        FROM books WHERE slug = ?`,
        [slug],
    );
    const row = (rows as { image: Buffer | null; mime: string | null }[])[0];
    if (!row?.image) {
        return json({ error: "Not found" }, 404);
    }
    return new Response(row.image, {
        headers: {
            "Content-Type": row.mime ?? "application/octet-stream",
            "Cache-Control": "public, max-age=86400",
        },
    });
}

await waitForDb();
await pool.query(SCHEMA);
const [[{ n }]] = (await pool.query(
    "SELECT COUNT(*) AS n FROM books",
)) as unknown as [[{ n: number }]];
if (n === 0) {
    console.log("Empty books table, seeding...");
    await seed(pool);
    console.log("Seeded");
}

Bun.serve({
    port: PORT,
    async fetch(req) {
        const { pathname } = new URL(req.url);
        try {
            if (pathname === "/api/books") {
                return await listBooks();
            }
            const m = pathname.match(
                /^\/api\/books\/([^/]+)\/(cover|spine)$/,
            );
            if (m) {
                return await serveImage(
                    decodeURIComponent(m[1]),
                    m[2] as "cover" | "spine",
                );
            }
            return json({ error: "Not found" }, 404);
        } catch (err) {
            console.error(err);
            return json({ error: "Internal server error" }, 500);
        }
    },
});

console.log(`API listening on :${PORT}`);
