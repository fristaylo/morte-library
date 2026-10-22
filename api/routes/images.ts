import { db } from "../db";
import { isAuthorized, PASSWORD } from "../auth";
import { json } from "../http";

const pool = db.$client;

export async function uploadImage(req: Request): Promise<Response> {
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

export async function serveUploadedImage(id: number): Promise<Response> {
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

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
