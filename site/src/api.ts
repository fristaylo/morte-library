export class ApiError extends Error {
    constructor(readonly status: number) {
        super(`API: ${status}`);
    }
}

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
    if (!res.ok) throw new ApiError(res.status);
    return res.json();
}

export async function fetchBook(slug: string): Promise<BookDetail> {
    const res = await fetch(`/api/books/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new ApiError(res.status);
    return res.json();
}

export async function createBook(data: FormData): Promise<{ slug: string }> {
    const res = await fetch("/api/books", { method: "POST", body: data });
    if (!res.ok) throw new ApiError(res.status);
    return res.json();
}

export async function updateBook(slug: string, data: FormData): Promise<void> {
    const res = await fetch(`/api/books/${encodeURIComponent(slug)}`, {
        method: "PUT",
        body: data,
    });
    if (!res.ok) throw new ApiError(res.status);
}

export async function deleteBook(slug: string): Promise<void> {
    const res = await fetch(`/api/books/${encodeURIComponent(slug)}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new ApiError(res.status);
}

export async function uploadImage(file: File): Promise<string> {
    const data = new FormData();
    data.set("image", file);
    const res = await fetch("/api/images", { method: "POST", body: data });
    if (!res.ok) throw new ApiError(res.status);
    return (await res.json()).url as string;
}

export async function fetchCategories(): Promise<Category[]> {
    const res = await fetch("/api/categories");
    if (!res.ok) throw new ApiError(res.status);
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
    if (!res.ok) throw new ApiError(res.status);
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

export function formatDateRead(book: Book): string | null {
    if (!book.dateRead) return null;
    const d = new Date(book.dateRead);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("ru", {
        month: "long",
        year: "numeric",
    }).format(d);
}
