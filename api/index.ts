import { isAuthorized, login, PASSWORD } from "./auth";
import { db, migrate } from "./db";
import { json } from "./http";
import {
    createBook,
    deleteBook,
    getBook,
    listBooks,
    reorderBooks,
    serveImage,
    updateBook,
} from "./routes/books";
import {
    createCategory,
    deleteCategory,
    listCategories,
    seedCategories,
    updateCategory,
} from "./routes/categories";
import { serveUploadedImage, uploadImage } from "./routes/images";

const PORT = 3001;

const pool = db.$client;

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

await waitForDb();
await migrate();
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
