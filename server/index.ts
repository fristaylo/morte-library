import mysql from "mysql2/promise";

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
    spine_ratio DECIMAL(5, 3) NULL,
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
    spineRatio: string | null;
    dateRead: string | null;
}

async function listBooks(): Promise<Response> {
    const [rows] = await pool.query(
        `SELECT id, slug, title, author, synopsis, review, rating, pages,
            width_px AS widthPx, height_px AS heightPx,
            spine_color AS spineColor, spine_text_color AS spineTextColor,
            (cover_image IS NOT NULL) AS hasCover,
            (spine_image IS NOT NULL) AS hasSpineImage,
            spine_ratio AS spineRatio,
            date_read AS dateRead
        FROM books
        ORDER BY id ASC`,
    );
    const books = (rows as BookRow[]).map((r) => ({
        ...r,
        hasCover: Boolean(r.hasCover),
        hasSpineImage: Boolean(r.hasSpineImage),
        spineRatio: r.spineRatio === null ? null : Number(r.spineRatio),
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

function formStr(v: FormDataEntryValue | null): string | null {
    const s = typeof v === "string" ? v.trim() : "";
    return s || null;
}

function formInt(
    v: FormDataEntryValue | null,
    lo: number,
    hi: number,
): number | null {
    if (typeof v !== "string" || v.trim() === "") return null;
    const n = Math.trunc(Number(v));
    if (!Number.isFinite(n)) return null;
    return Math.min(hi, Math.max(lo, n));
}

function formFloat(
    v: FormDataEntryValue | null,
    lo: number,
    hi: number,
): number | null {
    if (typeof v !== "string" || v.trim() === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.min(hi, Math.max(lo, n));
}

function formHexColor(v: FormDataEntryValue | null): string | null {
    const s = typeof v === "string" ? v.trim().toLowerCase() : "";
    return /^#[0-9a-f]{6}$/.test(s) ? s : null;
}

async function fileBlob(
    v: FormDataEntryValue | null,
): Promise<[Buffer, string] | [null, null]> {
    if (v instanceof File && v.size > 0) {
        return [
            Buffer.from(await v.arrayBuffer()),
            v.type || "application/octet-stream",
        ];
    }
    return [null, null];
}

async function uniqueSlug(title: string): Promise<string> {
    const base =
        title
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, "-")
            .replace(/^-+|-+$/g, "") || "kniga";
    let slug = base;
    for (let i = 2; ; i++) {
        const [rows] = await pool.query(
            "SELECT 1 FROM books WHERE slug = ? LIMIT 1",
            [slug],
        );
        if ((rows as unknown[]).length === 0) return slug;
        slug = `${base}-${i}`;
    }
}

async function createBook(req: Request): Promise<Response> {
    const form = await req.formData();
    const title = formStr(form.get("title"));
    const author = formStr(form.get("author"));
    if (!title || !author) {
        return json({ error: "title and author are required" }, 400);
    }

    const [coverImage, coverMime] = await fileBlob(form.get("cover"));
    const [spineImage, spineMime] = await fileBlob(form.get("spine"));

    const slug = await uniqueSlug(title);
    await pool.query(
        `INSERT INTO books (slug, title, author, synopsis, review, rating,
            pages, spine_color, cover_image, cover_mime,
            spine_image, spine_mime, spine_ratio, date_read)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            slug,
            title,
            author,
            formStr(form.get("synopsis")),
            formStr(form.get("review")),
            formInt(form.get("rating"), 0, 10) ?? 0,
            formInt(form.get("pages"), 1, 65535),
            formHexColor(form.get("spineColor")) ?? "#7ab8e0",
            coverImage,
            coverMime,
            spineImage,
            spineMime,
            formFloat(form.get("spineRatio"), 0.5, 20),
            formStr(form.get("dateRead")),
        ],
    );
    return json({ slug }, 201);
}

await waitForDb();
await pool.query(SCHEMA);
await pool
    .query("ALTER TABLE books ADD COLUMN spine_ratio DECIMAL(5, 3) NULL")
    .catch(() => {});

Bun.serve({
    port: PORT,
    async fetch(req) {
        const { pathname } = new URL(req.url);
        try {
            if (pathname === "/api/books") {
                if (req.method === "POST") {
                    return await createBook(req);
                }
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
