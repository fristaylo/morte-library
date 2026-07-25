export interface Book {
    id: number;
    slug: string;
    title: string;
    author: string;
    synopsis: string | null;
    /** абзацы разделены пустой строкой */
    review: string | null;
    /** 1–5 */
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
        Math.min(470, Math.max(240, (book.heightPx ?? 250) * 1.35)),
    );
}

export function bookDepth(book: Book): number {
    return Math.round(Math.min(190, Math.max(110, (book.widthPx ?? 130) * 1.05)));
}

/* ── per-book physical look, derived deterministically from the slug so a
   book always looks the same. Page tones vary slightly; some books get a
   ribbon bookmark, a stray page, or a soft vs hard binding ──────────────── */

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
}

export function bookLook(book: Book): BookLook {
    let h = 0;
    for (let i = 0; i < book.slug.length; i++) {
        h = (h * 31 + book.slug.charCodeAt(i)) >>> 0;
    }
    const [pageA, pageB] = PAGE_TONES[h % PAGE_TONES.length];
    return { pageA, pageB };
}

/** «январь 2026 г.» */
export function formatDateRead(book: Book): string | null {
    if (!book.dateRead) return null;
    const d = new Date(book.dateRead);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("ru", {
        month: "long",
        year: "numeric",
    }).format(d);
}
