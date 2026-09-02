export interface Book {
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
    hasCover: boolean;
    hasSpineImage: boolean;
    spineRatio: number | null;
    dateRead: string | null;
    updatedAt: string;
    categoryId: number;
    position: number;
}

export interface BookDetail extends Book {
    synopsis: string | null;
    review: string | null;
}

export interface Category {
    id: number;
    name: string;
    position: number;
}

export interface OrderGroup {
    categoryId: number;
    slugs: string[];
}

export async function fetchBooks(): Promise<Book[]> {
    const res = await fetch("/api/books");
    if (!res.ok) throw new Error(`API: ${res.status}`);
    return res.json();
}

export async function fetchBook(slug: string): Promise<BookDetail> {
    const res = await fetch(`/api/books/${encodeURIComponent(slug)}`);
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

export async function fetchCategories(): Promise<Category[]> {
    const res = await fetch("/api/categories");
    if (!res.ok) throw new Error(`API: ${res.status}`);
    return res.json();
}

export async function createCategory(name: string): Promise<Category> {
    const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Не получилось создать категорию.");
    }
    return res.json();
}

export async function renameCategory(id: number, name: string): Promise<void> {
    const res = await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
            data?.error ?? "Не получилось переименовать категорию.",
        );
    }
}

export async function deleteCategory(id: number): Promise<void> {
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Не получилось удалить категорию.");
    }
}

export async function saveBookOrder(groups: OrderGroup[]): Promise<void> {
    const res = await fetch("/api/books/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups }),
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
    return `/api/books/${book.slug}/cover?v=${encodeURIComponent(book.updatedAt)}`;
}

export function spineImageUrl(book: Book): string {
    return `/api/books/${book.slug}/spine?v=${encodeURIComponent(book.updatedAt)}`;
}

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 350;
const MIN_WIDTH = 22;
const MAX_WIDTH = 60;
const DEFAULT_RATIO = 7;
const DEFAULT_PAGES = 300;

export interface SpineBox {
    width: number;
    height: number;
}

export function spineBox(book: Book): SpineBox {
    const pages = book.pages ?? DEFAULT_PAGES;
    const ratio = book.spineRatio ?? DEFAULT_RATIO;
    let width = 22 + pages / 16;
    let height = width * ratio;

    const grow = Math.max(MIN_WIDTH / width, MIN_HEIGHT / height);
    if (grow > 1) {
        width *= grow;
        height *= grow;
    }

    const shrink = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
    if (shrink < 1) {
        width *= shrink;
        height *= shrink;
    }

    height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, height));
    width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));

    return {
        width: Math.round(width),
        height: Math.round(height),
    };
}

export function spineWidth(book: Book): number {
    return spineBox(book).width;
}

export function spineHeight(book: Book): number {
    return spineBox(book).height;
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
    length: number;
    z: number;
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
    ["#f6f0e0", "#e2d6ba"],
    ["#f3ecda", "#dccdac"],
    ["#f9f4e9", "#e7ddc6"],
    ["#efe5cf", "#d3c4a0"],
    ["#f5efdd", "#ddd0b2"],
    ["#f1ead4", "#d6c7a4"],
];
export interface BookLook {
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
