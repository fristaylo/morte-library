import type { Book } from "../../api";

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
