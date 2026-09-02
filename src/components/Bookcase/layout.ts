import type { Book, Category } from "../../api/api";
import { spineHeight, spineWidth } from "../../api/api";

const BOOK_GAP = 7;

export interface Row {
    categoryId: number | null;
    books: Book[];
}

function packCategory(books: Book[], shelfWidth: number): Book[][] {
    const rows: Book[][] = [];
    let row: Book[] = [];
    let used = 0;
    for (const book of books) {
        const w = spineWidth(book);
        if (row.length > 0 && used + BOOK_GAP + w > shelfWidth) {
            rows.push(row);
            row = [];
            used = 0;
        }
        used += (row.length > 0 ? BOOK_GAP : 0) + w;
        row.push(book);
    }
    if (row.length > 0 || rows.length === 0) rows.push(row);
    return rows;
}

export function packRows(
    categories: Category[],
    books: Book[],
    shelfWidth: number,
    withAddRow: boolean,
): Row[] {
    const byCategory = new Map<number, Book[]>();
    for (const category of categories) byCategory.set(category.id, []);
    const orphans: Book[] = [];
    for (const book of books) {
        const group = byCategory.get(book.categoryId);
        if (group) group.push(book);
        else orphans.push(book);
    }
    if (categories[0]) byCategory.get(categories[0].id)?.push(...orphans);

    const rows: Row[] = [];
    for (const category of categories) {
        const categoryRows = packCategory(
            byCategory.get(category.id) ?? [],
            shelfWidth,
        );
        categoryRows.forEach((rowBooks) => {
            rows.push({ categoryId: category.id, books: rowBooks });
        });
    }
    if (withAddRow) rows.push({ categoryId: null, books: [] });
    return rows;
}

export function shelfYaws(shelf: Book[], shelfWidth: number): number[] {
    const widths = shelf.map(spineWidth);
    const total =
        widths.reduce((a, b) => a + b, 0) +
        BOOK_GAP * Math.max(0, shelf.length - 1);
    let x = 0;
    return widths.map((w) => {
        const offset = x + w / 2 - total / 2;
        x += w + BOOK_GAP;
        return Math.max(-1, Math.min(1, offset / (shelfWidth / 2)));
    });
}

export interface ShelfMetrics {
    width: number;
    padY: number;
    minHeight: number;
    board: number;
    borderBox: boolean;
}

export function shelfLayout(
    rows: Row[],
    m: ShelfMetrics,
): { heights: number[]; tops: number[]; total: number } {
    const heights = rows.map((row) => {
        const maxSpine = row.books.reduce(
            (max, book) => Math.max(max, spineHeight(book)),
            0,
        );
        return m.borderBox
            ? Math.max(m.minHeight, maxSpine + m.padY) + m.board
            : Math.max(m.minHeight, maxSpine) + m.padY + m.board;
    });
    const tops: number[] = [];
    let acc = 0;
    for (const h of heights) {
        tops.push(acc);
        acc += h;
    }
    return { heights, tops, total: acc };
}

export function visibleRange(
    tops: number[],
    heights: number[],
    scrollTop: number,
    viewportH: number,
    buffer: number,
): [number, number] {
    const n = tops.length;
    if (n === 0) return [0, -1];
    const lo = scrollTop - buffer;
    const hi = scrollTop + viewportH + buffer;
    let first = -1;
    let last = -1;
    for (let i = 0; i < n; i++) {
        if (tops[i] + heights[i] > lo && tops[i] < hi) {
            if (first === -1) first = i;
            last = i;
        }
    }
    if (first === -1) {
        first = last = hi <= tops[0] ? 0 : n - 1;
    }
    return [first, last];
}
