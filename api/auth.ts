import { createHmac, timingSafeEqual } from "node:crypto";
import { json } from "./http";

export const USER = env("USER");
export const PASSWORD = env("PASSWORD");

export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

export function equals(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function makeToken(secret: string, exp = Date.now() + SESSION_TTL) {
    const mac = createHmac("sha256", secret).update(String(exp)).digest("hex");
    return `${exp}.${mac}`;
}

export function verifyToken(secret: string, token: string | undefined): boolean {
    const exp = Number(token?.split(".")[0]);
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    return equals(token as string, makeToken(secret, exp));
}

export function isAuthorized(req: Request, secret: string): boolean {
    const token = req.headers
        .get("cookie")
        ?.split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("session="))
        ?.slice("session=".length);
    return verifyToken(secret, token);
}

export async function login(req: Request): Promise<Response> {
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

function env(name: string): string {
    const value = process.env[name];
    if (!value) {
        console.error(`Missing required env variable: ${name}`);
        process.exit(1);
    }
    return value;
}
