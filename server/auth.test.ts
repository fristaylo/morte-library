import { expect, test } from "bun:test";
import { isAuthorized, makeToken, verifyToken } from "./auth";

const SECRET = "morte";

function withCookie(value: string): Request {
    return new Request("http://x/api/books", {
        headers: { cookie: `theme=dark; session=${value}` },
    });
}

test("свежий токен проходит", () => {
    expect(verifyToken(SECRET, makeToken(SECRET))).toBe(true);
    expect(isAuthorized(withCookie(makeToken(SECRET)), SECRET)).toBe(true);
});

test("чужой секрет, подделка и мусор не проходят", () => {
    const token = makeToken(SECRET);
    expect(verifyToken("other", token)).toBe(false);
    expect(verifyToken(SECRET, `${token}0`)).toBe(false);
    expect(verifyToken(SECRET, `${Date.now() + 1000}.deadbeef`)).toBe(false);
    expect(verifyToken(SECRET, undefined)).toBe(false);
});

test("протухший токен не проходит", () => {
    expect(verifyToken(SECRET, makeToken(SECRET, Date.now() - 1))).toBe(false);
});

test("без куки нет доступа", () => {
    expect(isAuthorized(new Request("http://x/api/books"), SECRET)).toBe(false);
});
