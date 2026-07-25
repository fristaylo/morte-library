import { type RefObject, useEffect, useRef, useState } from "react";
import type { Book } from "../api";
import { spineWidth } from "../api";
import BookSpine from "./BookSpine";
import "./Bookcase.scss";

const BOOK_GAP = 6;
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

function useShelfWidth(ref: RefObject<HTMLElement | null>): number {
    const [width, setWidth] = useState(DEFAULT_SHELF_WIDTH);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const measure = () => {
            const cs = getComputedStyle(el);
            const pad =
                parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
            setWidth(Math.max(160, el.clientWidth - pad));
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [ref]);
    return width;
}

export default function Bookcase({ books }: { books: Book[] }) {
    const bodyRef = useRef<HTMLDivElement>(null);
    const shelfWidth = useShelfWidth(bodyRef);
    const shelves = packShelves(books, shelfWidth);
    const firstEmpty = shelves.findIndex((shelf) => shelf.length === 0);
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
                        width="24"
                        height="58"
                        viewBox="0 0 24 58"
                        fill="none"
                        role="img"
                        aria-label="Перо"
                    >
                        <path
                            d="M21 3 C 21 3, 6 12, 4 30 C 3 40, 6 47, 9 52 L 11 55"
                            stroke="var(--ink-soft)"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                        />
                        <path
                            d="M20 6 C 14 10, 9 18, 7 27 C 12 24, 17 17, 20 9 Z"
                            fill="#8fa6bd"
                            opacity="0.9"
                        />
                        <path
                            d="M18 15 C 12 19, 8 26, 6 34 C 11 31, 15 25, 18 18 Z"
                            fill="#a8bacc"
                            opacity="0.85"
                        />
                        <path
                            d="M15 24 C 10 28, 7 34, 6 41 C 10 38, 13 32, 15 26 Z"
                            fill="#c6d3e1"
                            opacity="0.8"
                        />
                        <path d="M9 52 L 11 55 L 12.5 51 Z" fill="#2f3a52" />
                    </svg>
                </span>
                <span className="inkwell-drop" aria-hidden="true" />
                <span className="inkwell-pot" aria-hidden="true" />
            </button>
            <div className="bookcase-top" aria-hidden="true" />
            <div className="bookcase-body" ref={bodyRef}>
                {shelves.map((shelf, i) => (
                    <div
                        className="bookcase-shelf"
                        key={shelf[0]?.slug ?? `empty-${i}`}
                    >
                        <div className="bookcase-books">
                            {shelf.map((book) => (
                                <BookSpine key={book.slug} book={book} />
                            ))}
                            {i === firstEmpty && (
                                <div
                                    className="bookcase-candle"
                                    aria-hidden="true"
                                />
                            )}
                        </div>
                        <div className="bookcase-board" aria-hidden="true" />
                    </div>
                ))}
            </div>
            <div className="bookcase-plinth" aria-hidden="true" />
        </section>
    );
}
