import type { Book } from "../../api/api";
import { spineHeight, spineWidth } from "../../api/api";

const BOOK_GAP = 7;
const MIN_SHELVES = 6;

export function packShelves(books: Book[], shelfWidth: number): Book[][] {
    const shelves: Book[][] = [];
    let row: Book[] = [];
    let used = 0;
    for (const book of books) {
        const w = spineWidth(book);
        if (row.length > 0 && used + BOOK_GAP + w > shelfWidth) {
            shelves.push(row);
            row = [];
            used = 0;
        }
        used += (row.length > 0 ? BOOK_GAP : 0) + w;
        row.push(book);
    }
    if (row.length > 0) shelves.push(row);
    while (shelves.length < MIN_SHELVES) shelves.push([]);
    return shelves;
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
    shelves: Book[][],
    m: ShelfMetrics,
): { heights: number[]; tops: number[]; total: number } {
    const heights = shelves.map((shelf) => {
        const maxSpine = shelf.reduce(
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
