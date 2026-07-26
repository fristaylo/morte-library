import { type RefObject, useEffect, useRef, useState } from "react";
import type { Book } from "../../api/api";
import { spineWidth } from "../../api/api";
import BookSpine from "../BookSpine/BookSpine";
import Inkwell from "../Inkwell/Inkwell";
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
            <Inkwell
                onClick={() => {
                    window.location.hash = "#/add";
                }}
            />
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
