import { db } from "../db";
import { isAuthorized, PASSWORD } from "../auth";
import { json } from "../http";

const pool = db.$client;

export async function listCategories(): Promise<Response> {
    const [rows] = await pool.query(
        "SELECT id, name, position FROM categories ORDER BY position ASC, id ASC",
    );
    return json(rows);
}

export async function createCategory(req: Request): Promise<Response> {
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

export async function updateCategory(
    req: Request,
    id: number,
): Promise<Response> {
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

export async function deleteCategory(
    req: Request,
    id: number,
): Promise<Response> {
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

export async function seedCategories(): Promise<void> {
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

function normalizeCategoryName(v: unknown): string | null {
    const s = typeof v === "string" ? v.trim().slice(0, 191) : "";
    return s || null;
}
