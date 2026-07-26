export interface Book {
    id: number;
    slug: string;
    title: string;
    author: string;
    synopsis: string | null;
    /** абзацы разделены пустой строкой */
    review: string | null;
    /** 0–10 */
    rating: number;
    pages: number | null;
    /** ширина обложки, px (для страницы отзыва) */
    widthPx: number | null;
    /** высота книги на полке, px */
    heightPx: number | null;
    spineColor: string;
    spineTextColor: string;
    hasCover: boolean;
    hasSpineImage: boolean;
    /** высота фото корешка / его ширина */
    spineRatio: number | null;
    /** ISO-дата YYYY-MM-DD или null */
    dateRead: string | null;
}

export async function fetchBooks(): Promise<Book[]> {
    const res = await fetch("/api/books");
    if (!res.ok) throw new Error(`API: ${res.status}`);
    return res.json();
}

export async function createBook(data: FormData): Promise<{ slug: string }> {
    const res = await fetch("/api/books", { method: "POST", body: data });
    if (!res.ok) throw new Error(`API: ${res.status}`);
    return res.json();
}

export async function updateBook(slug: string, data: FormData): Promise<void> {
    const res = await fetch(`/api/books/${encodeURIComponent(slug)}`, {
        method: "PUT",
        body: data,
    });
    if (!res.ok) throw new Error(`API: ${res.status}`);
}

export async function deleteBook(slug: string): Promise<void> {
    const res = await fetch(`/api/books/${encodeURIComponent(slug)}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error(`API: ${res.status}`);
}

export async function fetchMe(): Promise<boolean> {
    const res = await fetch("/api/me");
    if (!res.ok) return false;
    return (await res.json()).authorized === true;
}

export async function login(
    user: string,
    password: string,
): Promise<string | null> {
    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.error ?? "Не получилось войти — попробуйте позже.";
}

export function coverUrl(book: Book): string {
    return `/api/books/${book.slug}/cover`;
}

export function spineImageUrl(book: Book): string {
    return `/api/books/${book.slug}/spine`;
}

export function spineWidth(book: Book): number {
    const pages = book.pages ?? 300;
    return Math.round(Math.min(88, Math.max(40, 26 + pages / 12)));
}

export function spineHeight(book: Book): number {
    if (book.spineRatio) {
        return Math.round(
            Math.min(470, Math.max(240, spineWidth(book) * book.spineRatio)),
        );
    }
    return Math.round(
        Math.min(300, Math.max(240, (book.heightPx ?? 250) * 1.35)),
    );
}

export const SHELF_DEPTH = 190;
export const MIN_LENGTH = SHELF_DEPTH;
export const MAX_LENGTH = 260;

function slugHash(slug: string): number {
    let h = 0;
    for (let i = 0; i < slug.length; i++) {
        h = (h * 31 + slug.charCodeAt(i)) >>> 0;
    }
    return h;
}

function rollLength(slug: string): number {
    return MIN_LENGTH + (slugHash(slug) % (MAX_LENGTH - MIN_LENGTH + 1));
}

export interface BookPlace {
    /** размер книги вглубь полки, px */
    length: number;
    /** от переднего края полки до фасада книги, px */
    z: number;
    /** доля пути до задней стенки, 0–1 */
    back: number;
}

export function bookPlace(book: Book): BookPlace {
    const length = book.widthPx
        ? Math.round(
              Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, book.widthPx * 1.05)),
          )
        : rollLength(book.slug);
    const z = SHELF_DEPTH - length;
    return { length, z, back: z / SHELF_DEPTH };
}

const PAGE_TONES: readonly [string, string][] = [
    ["#f6f0e0", "#e2d6ba"], // cream
    ["#f3ecda", "#dccdac"], // warm
    ["#f9f4e9", "#e7ddc6"], // bright ivory
    ["#efe5cf", "#d3c4a0"], // aged
    ["#f5efdd", "#ddd0b2"], // sand
    ["#f1ead4", "#d6c7a4"], // oat
];
export interface BookLook {
    /** page-block tones (near/far) */
    pageA: string;
    pageB: string;
    gap: number;
}

export function bookLook(book: Book): BookLook {
    const h = slugHash(book.slug);
    const [pageA, pageB] = PAGE_TONES[h % PAGE_TONES.length];
    return { pageA, pageB, gap: 4 + ((h >>> 3) % 7) };
}

export function formatDateRead(book: Book): string | null {
    if (!book.dateRead) return null;
    const d = new Date(book.dateRead);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("ru", {
        month: "long",
        year: "numeric",
    }).format(d);
}
