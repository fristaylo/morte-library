import { db } from "../db";
import { isAuthorized, PASSWORD } from "../auth";
import { json } from "../http";

const pool = db.$client;

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

interface OrderGroup {
    categoryId: number;
    slugs: string[];
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

export async function listBooks(): Promise<Response> {
    const [rows] = await pool.query(
        `SELECT ${BOOK_COLUMNS} FROM books ORDER BY position ASC, id ASC`,
    );
    return json((rows as BookRow[]).map(normalizeBook));
}

export async function getBook(slug: string): Promise<Response> {
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

export async function serveImage(
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

export async function createBook(req: Request): Promise<Response> {
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

export async function updateBook(
    req: Request,
    slug: string,
): Promise<Response> {
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

export async function deleteBook(
    req: Request,
    slug: string,
): Promise<Response> {
    if (!isAuthorized(req, PASSWORD)) {
        return json({ error: "Unauthorized" }, 401);
    }
    const [res] = await pool.query("DELETE FROM books WHERE slug = ?", [slug]);
    if ((res as { affectedRows: number }).affectedRows === 0) {
        return json({ error: "Not found" }, 404);
    }
    return json({ deleted: slug });
}

export async function reorderBooks(req: Request): Promise<Response> {
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

function normalizeBook<T extends BookRow>(r: T) {
    return {
        ...r,
        hasCover: Boolean(r.hasCover),
        hasSpineImage: Boolean(r.hasSpineImage),
        spineRatio: r.spineRatio === null ? null : Number(r.spineRatio),
    };
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
