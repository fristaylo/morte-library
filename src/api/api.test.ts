import { expect, test } from "bun:test";
import {
    type Book,
    bookPlace,
    MAX_LENGTH,
    MIN_LENGTH,
    SHELF_DEPTH,
} from "./api";

function book(slug: string, widthPx: number | null = null): Book {
    return {
        id: 1,
        slug,
        title: slug,
        author: "a",
        synopsis: null,
        review: null,
        rating: 3,
        pages: null,
        widthPx,
        heightPx: null,
        spineColor: "#000",
        spineTextColor: "#fff",
        hasCover: false,
        hasSpineImage: false,
        spineRatio: null,
        dateRead: null,
        updatedAt: "2026-07-26 00:00:00",
    };
}

test("длина из паттернов, книга стоит у задней стенки", () => {
    for (let i = 0; i < 200; i++) {
        const p = bookPlace(book(`book-${i}`));
        expect(p.length).toBeGreaterThanOrEqual(MIN_LENGTH);
        expect(p.length).toBeLessThanOrEqual(MAX_LENGTH);
        expect(p.z).toBe(SHELF_DEPTH - p.length);
        expect(p.back).toBe(p.z / SHELF_DEPTH);
    }
});

test("длина книги не меняется между рендерами", () => {
    const first = Array.from({ length: 50 }, (_, i) =>
        bookPlace(book(`stable-${i}`)),
    );
    for (const [i, p] of first.entries()) {
        expect(bookPlace(book(`stable-${i}`))).toEqual(p);
    }
});

test("реальная ширина обложки важнее паттерна", () => {
    expect(bookPlace(book("krolik", 200)).length).toBe(210);
    expect(bookPlace(book("krolik", 400)).length).toBe(MAX_LENGTH);
    expect(bookPlace(book("krolik", 20)).length).toBe(MIN_LENGTH);
});

test("паттерны дают разные длины", () => {
    const seen = new Set(
        Array.from({ length: 300 }, (_, i) => bookPlace(book(`s${i}`)).length),
    );
    expect(seen.size).toBeGreaterThan(3);
});
