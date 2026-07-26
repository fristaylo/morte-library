import { type RefObject, useEffect, useRef, useState } from "react";
import type { Book } from "../api";
import { spineWidth } from "../api";
import BookSpine from "./BookSpine";
import "./Bookcase.scss";

const BOOK_GAP = 7;
const MIN_SHELVES = 6;
const DEFAULT_SHELF_WIDTH = 936;

function packShelves(books: Book[], shelfWidth: number): Book[][] {
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

function shelfYaws(shelf: Book[], shelfWidth: number): number[] {
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

function useShelfWidth(ref: RefObject<HTMLElement | null>): number {
    const [width, setWidth] = useState(DEFAULT_SHELF_WIDTH);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const measure = () => {
            const cs = getComputedStyle(el);
            const pad =
                parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
            const inner = el.clientWidth - pad;
            if (inner > 0) setWidth(Math.max(160, inner));
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [ref]);
    return width;
}

export default function Bookcase({ books }: { books: Book[] }) {
    const rowRef = useRef<HTMLDivElement>(null);
    const shelfWidth = useShelfWidth(rowRef);
    const shelves = packShelves(books, shelfWidth);
    return (
        <section className="bookcase" aria-label="Книжный шкаф">
            <button
                type="button"
                className="bookcase-inkwell"
                aria-label="Добавить книгу"
                onClick={() => {
                    window.location.hash = "#/add";
                }}
            >
                <span className="inkwell-quill" aria-hidden="true">
                    <svg
                        width="48"
                        height="185"
                        viewBox="0 0 26 100"
                        fill="none"
                        role="img"
                        aria-label="Перо"
                    >
                        <path
                            d="M22.5 5 C 22.5 5, 6 22, 4 52 C 3 69, 6 81, 9.5 89"
                            stroke="var(--ink-soft)"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <path
                            d="M21.5 8 C 13 16, 6 30, 4 48 C 11.5 42, 18 27, 21.5 13 Z"
                            fill="#8fa6bd"
                            opacity="0.9"
                        />
                        <path
                            d="M19 24 C 11 32, 5.5 45, 3.5 60 C 11 54, 16 41, 19 29 Z"
                            fill="#a8bacc"
                            opacity="0.85"
                        />
                        <path
                            d="M16 39 C 9 47, 4.5 58, 3.5 71 C 9.5 65, 13.5 54, 16 43 Z"
                            fill="#c6d3e1"
                            opacity="0.8"
                        />
                        <path
                            d="M8.5 89.4 C 9.2 88.4, 10 88.2, 10.6 88.6 L 12.4 96.4 Z"
                            fill="#2f3a52"
                        />
                    </svg>
                    <span className="inkwell-drop" aria-hidden="true" />
                </span>
                <span className="inkwell-pot" aria-hidden="true" />
            </button>
            <div className="bookcase-top" aria-hidden="true" />
            <div className="bookcase-body">
                <span
                    className="bookcase-wall bookcase-wall-left"
                    aria-hidden="true"
                />
                <span
                    className="bookcase-wall bookcase-wall-right"
                    aria-hidden="true"
                />
                {shelves.map((shelf, i) => {
                    const yaws = shelfYaws(shelf, shelfWidth);
                    return (
                        <div className="bookcase-shelf" key={i}>
                            <div
                                className="bookcase-books"
                                ref={i === 0 ? rowRef : undefined}
                            >
                                {shelf.map((book, j) => (
                                    <BookSpine
                                        key={book.slug}
                                        book={book}
                                        yaw={yaws[j]}
                                        rank={
                                            shelf.length -
                                            Math.round(
                                                Math.abs(
                                                    j - (shelf.length - 1) / 2,
                                                ),
                                            )
                                        }
                                    />
                                ))}
                            </div>
                            <div
                                className="bookcase-board"
                                aria-hidden="true"
                            />
                        </div>
                    );
                })}
            </div>
            <div className="bookcase-plinth" aria-hidden="true" />
        </section>
    );
}
