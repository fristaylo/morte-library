import mysql from "mysql2/promise";
import { equals, isAuthorized, makeToken, SESSION_TTL } from "./auth";

function env(name: string): string {
    const value = process.env[name];
    if (!value) {
        console.error(`Missing required env variable: ${name}`);
        process.exit(1);
    }
    return value;
}

const USER = env("USER");
const PASSWORD = env("PASSWORD");

const PORT = 3001;
const DB_HOST = process.env.DB_HOST ?? "localhost";
const DB_PORT = 3306;
const DB_NAME = "morte";

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

const pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: USER,
    password: PASSWORD,
    database: DB_NAME,
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

const CATEGORIES_SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const IMAGES_SCHEMA = `
CREATE TABLE IF NOT EXISTS images (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    mime VARCHAR(64) NOT NULL,
    data MEDIUMBLOB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

async function login(req: Request): Promise<Response> {
    const body = (await req.json().catch(() => null)) as {
        user?: unknown;
        password?: unknown;
    } | null;
    const user = typeof body?.user === "string" ? body.user : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!equals(user, USER) || !equals(password, PASSWORD)) {
        return json({ error: "Неверный логин или пароль" }, 401);
    }
    return new Response(JSON.stringify({ authorized: true }), {
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Set-Cookie":
                `session=${makeToken(PASSWORD)}; HttpOnly; SameSite=Lax;` +
                ` Path=/; Max-Age=${SESSION_TTL / 1000}`,
        },
    });
}

interface BookRow {
    id: number;
    slug: string;
    title: string;
    author: string;
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
    updatedAt: string;
    categoryId: number | null;
    position: number;
}

interface BookDetailRow extends BookRow {
    synopsis: string | null;
    review: string | null;
}

const BOOK_COLUMNS = `id, slug, title, author, rating, pages,
    width_px AS widthPx, height_px AS heightPx,
    spine_color AS spineColor, spine_text_color AS spineTextColor,
    (cover_image IS NOT NULL) AS hasCover,
    (spine_image IS NOT NULL) AS hasSpineImage,
    spine_ratio AS spineRatio,
    date_read AS dateRead,
    updated_at AS updatedAt,
    category_id AS categoryId, position`;

function normalizeBook<T extends BookRow>(r: T) {
    return {
        ...r,
        hasCover: Boolean(r.hasCover),
        hasSpineImage: Boolean(r.hasSpineImage),
        spineRatio: r.spineRatio === null ? null : Number(r.spineRatio),
    };
}

async function listBooks(): Promise<Response> {
    const [rows] = await pool.query(
        `SELECT ${BOOK_COLUMNS} FROM books ORDER BY position ASC, id ASC`,
    );
    return json((rows as BookRow[]).map(normalizeBook));
}

async function getBook(slug: string): Promise<Response> {
    const [rows] = await pool.query(
        `SELECT ${BOOK_COLUMNS}, synopsis, review FROM books WHERE slug = ? LIMIT 1`,
        [slug],
    );
    const row = (rows as BookDetailRow[])[0];
    if (!row) {
        return json({ error: "Not found" }, 404);
    }
    return json(normalizeBook(row));
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
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    });
}

async function uploadImage(req: Request): Promise<Response> {
    if (!isAuthorized(req, PASSWORD)) {
        return json({ error: "Unauthorized" }, 401);
    }
    const form = await req.formData();
    const file = form.get("image");
    if (
        !(file instanceof File) ||
        file.size === 0 ||
        file.size > 8 * 1024 * 1024 ||
        !IMAGE_MIMES.has(file.type)
    ) {
        return json({ error: "Bad image" }, 400);
    }
    const data = Buffer.from(await file.arrayBuffer());
    const [res] = await pool.query(
        "INSERT INTO images (mime, data) VALUES (?, ?)",
        [file.type, data],
    );
    const id = (res as { insertId: number }).insertId;
    return json({ url: `/api/images/${id}` }, 201);
}

async function serveUploadedImage(id: number): Promise<Response> {
    const [rows] = await pool.query(
        "SELECT data, mime FROM images WHERE id = ?",
        [id],
    );
    const row = (rows as { data: Buffer; mime: string }[])[0];
    if (!row) {
        return json({ error: "Not found" }, 404);
    }
    return new Response(row.data, {
        headers: {
            "Content-Type": row.mime,
            "Cache-Control": "public, max-age=31536000, immutable",
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
    if (!isAuthorized(req, PASSWORD)) {
        return json({ error: "Unauthorized" }, 401);
    }
    const form = await req.formData();
    const title = formStr(form.get("title"));
    const author = formStr(form.get("author"));
    if (!title || !author) {
        return json({ error: "title and author are required" }, 400);
    }

    const [coverImage, coverMime] = await fileBlob(form.get("cover"));
    const [spineImage, spineMime] = await fileBlob(form.get("spine"));

    let categoryId = formInt(form.get("categoryId"), 1, 4294967295);
    if (categoryId !== null) {
        const [catRows] = await pool.query(
            "SELECT 1 FROM categories WHERE id = ? LIMIT 1",
            [categoryId],
        );
        if ((catRows as unknown[]).length === 0) categoryId = null;
    }
    if (categoryId === null) {
        const [catRows] = await pool.query(
            "SELECT id FROM categories ORDER BY position ASC, id ASC LIMIT 1",
        );
        categoryId = (catRows as { id: number }[])[0]?.id ?? null;
    }
    const [posRows] = await pool.query(
        "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM books WHERE category_id = ?",
        [categoryId],
    );
    const position = (posRows as { pos: number }[])[0].pos;

    const slug = await uniqueSlug(title);
    await pool.query(
        `INSERT INTO books (slug, title, author, synopsis, review, rating,
            pages, spine_color, cover_image, cover_mime,
            spine_image, spine_mime, spine_ratio, date_read,
            category_id, position)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            categoryId,
            position,
        ],
    );
    return json({ slug }, 201);
}

async function updateBook(req: Request, slug: string): Promise<Response> {
    if (!isAuthorized(req, PASSWORD)) {
        return json({ error: "Unauthorized" }, 401);
    }
    const form = await req.formData();
    const title = formStr(form.get("title"));
    const author = formStr(form.get("author"));
    if (!title || !author) {
        return json({ error: "title and author are required" }, 400);
    }

    const [coverImage, coverMime] = await fileBlob(form.get("cover"));
    const [spineImage, spineMime] = await fileBlob(form.get("spine"));

    const sets = [
        "title = ?",
        "author = ?",
        "synopsis = ?",
        "review = ?",
        "rating = ?",
        "pages = ?",
        "date_read = ?",
    ];
    const params: unknown[] = [
        title,
        author,
        formStr(form.get("synopsis")),
        formStr(form.get("review")),
        formInt(form.get("rating"), 0, 10) ?? 0,
        formInt(form.get("pages"), 1, 65535),
        formStr(form.get("dateRead")),
    ];
    if (coverImage) {
        sets.push("cover_image = ?", "cover_mime = ?");
        params.push(coverImage, coverMime);
    }
    if (spineImage) {
        sets.push(
            "spine_image = ?",
            "spine_mime = ?",
            "spine_color = ?",
            "spine_ratio = ?",
        );
        params.push(
            spineImage,
            spineMime,
            formHexColor(form.get("spineColor")) ?? "#7ab8e0",
            formFloat(form.get("spineRatio"), 0.5, 20),
        );
    }

    const categoryId = formInt(form.get("categoryId"), 1, 4294967295);
    if (categoryId !== null) {
        const [curRows] = await pool.query(
            "SELECT category_id AS categoryId FROM books WHERE slug = ?",
            [slug],
        );
        const current = (curRows as { categoryId: number | null }[])[0]
            ?.categoryId;
        if (current !== categoryId) {
            const [posRows] = await pool.query(
                "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM books WHERE category_id = ?",
                [categoryId],
            );
            const position = (posRows as { pos: number }[])[0].pos;
            sets.push("category_id = ?", "position = ?");
            params.push(categoryId, position);
        }
    }

    params.push(slug);

    const [res] = await pool.query(
        `UPDATE books SET ${sets.join(", ")} WHERE slug = ?`,
        params,
    );
    if ((res as { affectedRows: number }).affectedRows === 0) {
        return json({ error: "Not found" }, 404);
    }
    return json({ slug });
}

async function deleteBook(req: Request, slug: string): Promise<Response> {
    if (!isAuthorized(req, PASSWORD)) {
        return json({ error: "Unauthorized" }, 401);
    }
    const [res] = await pool.query("DELETE FROM books WHERE slug = ?", [slug]);
    if ((res as { affectedRows: number }).affectedRows === 0) {
        return json({ error: "Not found" }, 404);
    }
    return json({ deleted: slug });
}

function normalizeCategoryName(v: unknown): string | null {
    const s = typeof v === "string" ? v.trim().slice(0, 191) : "";
    return s || null;
}

async function listCategories(): Promise<Response> {
    const [rows] = await pool.query(
        "SELECT id, name, position FROM categories ORDER BY position ASC, id ASC",
    );
    return json(rows);
}

async function createCategory(req: Request): Promise<Response> {
    if (!isAuthorized(req, PASSWORD)) {
        return json({ error: "Unauthorized" }, 401);
    }
    const body = (await req.json().catch(() => null)) as {
        name?: unknown;
    } | null;
    const name = normalizeCategoryName(body?.name);
    if (!name) {
        return json({ error: "Нужно название" }, 400);
    }
    const [posRows] = await pool.query(
        "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM categories",
    );
    const position = (posRows as { pos: number }[])[0].pos;
    const [res] = await pool.query(
        "INSERT INTO categories (name, position) VALUES (?, ?)",
        [name, position],
    );
    const id = (res as { insertId: number }).insertId;
    return json({ id, name, position }, 201);
}

async function updateCategory(req: Request, id: number): Promise<Response> {
    if (!isAuthorized(req, PASSWORD)) {
        return json({ error: "Unauthorized" }, 401);
    }
    const body = (await req.json().catch(() => null)) as {
        name?: unknown;
    } | null;
    const name = normalizeCategoryName(body?.name);
    if (!name) {
        return json({ error: "Нужно название" }, 400);
    }
    const [res] = await pool.query(
        "UPDATE categories SET name = ? WHERE id = ?",
        [name, id],
    );
    if ((res as { affectedRows: number }).affectedRows === 0) {
        return json({ error: "Not found" }, 404);
    }
    return json({ id, name });
}

async function deleteCategory(req: Request, id: number): Promise<Response> {
    if (!isAuthorized(req, PASSWORD)) {
        return json({ error: "Unauthorized" }, 401);
    }
    const [countRows] = await pool.query(
        "SELECT COUNT(*) AS c FROM books WHERE category_id = ?",
        [id],
    );
    if ((countRows as { c: number }[])[0].c > 0) {
        return json({ error: "В категории ещё есть книги" }, 409);
    }
    const [res] = await pool.query("DELETE FROM categories WHERE id = ?", [
        id,
    ]);
    if ((res as { affectedRows: number }).affectedRows === 0) {
        return json({ error: "Not found" }, 404);
    }
    return json({ deleted: id });
}

interface OrderGroup {
    categoryId: number;
    slugs: string[];
}

async function reorderBooks(req: Request): Promise<Response> {
    if (!isAuthorized(req, PASSWORD)) {
        return json({ error: "Unauthorized" }, 401);
    }
    const body = (await req.json().catch(() => null)) as {
        groups?: unknown;
    } | null;
    const groups = body?.groups;
    if (!Array.isArray(groups)) {
        return json({ error: "Bad request" }, 400);
    }
    for (const g of groups) {
        const group = g as { categoryId?: unknown; slugs?: unknown };
        if (
            typeof group !== "object" || group === null ||
            !Number.isFinite(group.categoryId) ||
            !Array.isArray(group.slugs) ||
            !group.slugs.every((s) => typeof s === "string")
        ) {
            return json({ error: "Bad request" }, 400);
        }
    }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (const g of groups as OrderGroup[]) {
            for (let i = 0; i < g.slugs.length; i++) {
                await conn.query(
                    "UPDATE books SET category_id = ?, position = ? WHERE slug = ?",
                    [g.categoryId, i, g.slugs[i]],
                );
            }
        }
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
    return json({ ok: true });
}

async function seedCategories(): Promise<void> {
    const [countRows] = await pool.query(
        "SELECT COUNT(*) AS c FROM categories",
    );
    if ((countRows as { c: number }[])[0].c > 0) return;
    const [insertRes] = await pool.query(
        "INSERT INTO categories (name, position) VALUES ('Без категории', 0)",
    );
    const categoryId = (insertRes as { insertId: number }).insertId;
    const [bookRows] = await pool.query(
        "SELECT id FROM books ORDER BY id ASC",
    );
    const books = bookRows as { id: number }[];
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (let i = 0; i < books.length; i++) {
            await conn.query(
                "UPDATE books SET category_id = ?, position = ? WHERE id = ?",
                [categoryId, i, books[i].id],
            );
        }
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

await waitForDb();
await pool.query(SCHEMA);
await pool.query(CATEGORIES_SCHEMA);
await pool.query(IMAGES_SCHEMA);
await pool
    .query("ALTER TABLE books ADD COLUMN spine_ratio DECIMAL(5, 3) NULL")
    .catch(() => {});
await pool
    .query("ALTER TABLE books ADD COLUMN category_id INT UNSIGNED NULL")
    .catch(() => {});
await pool
    .query(
        "ALTER TABLE books ADD COLUMN position INT UNSIGNED NOT NULL DEFAULT 0",
    )
    .catch(() => {});
await pool
    .query(
        "ALTER TABLE books ADD KEY idx_books_category (category_id, position)",
    )
    .catch(() => {});
await seedCategories();

Bun.serve({
    port: PORT,
    async fetch(req) {
        const { pathname } = new URL(req.url);
        try {
            if (pathname === "/api/login" && req.method === "POST") {
                return await login(req);
            }
            if (pathname === "/api/me") {
                return json({ authorized: isAuthorized(req, PASSWORD) });
            }
            if (pathname === "/api/books") {
                if (req.method === "POST") {
                    return await createBook(req);
                }
                return await listBooks();
            }
            if (pathname === "/api/books/order" && req.method === "PUT") {
                return await reorderBooks(req);
            }
            if (pathname === "/api/categories") {
                if (req.method === "POST") {
                    return await createCategory(req);
                }
                return await listCategories();
            }
            const cat = pathname.match(/^\/api\/categories\/(\d+)$/);
            if (cat && req.method === "PUT") {
                return await updateCategory(req, Number(cat[1]));
            }
            if (cat && req.method === "DELETE") {
                return await deleteCategory(req, Number(cat[1]));
            }
            if (pathname === "/api/images" && req.method === "POST") {
                return await uploadImage(req);
            }
            const img = pathname.match(/^\/api\/images\/(\d+)$/);
            if (img && req.method === "GET") {
                return await serveUploadedImage(Number(img[1]));
            }
            const one = pathname.match(/^\/api\/books\/([^/]+)$/);
            if (one && req.method === "PUT") {
                return await updateBook(req, decodeURIComponent(one[1]));
            }
            if (one && req.method === "DELETE") {
                return await deleteBook(req, decodeURIComponent(one[1]));
            }
            if (one && req.method === "GET") {
                return await getBook(decodeURIComponent(one[1]));
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
