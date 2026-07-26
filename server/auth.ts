import { createHmac, timingSafeEqual } from "node:crypto";

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
