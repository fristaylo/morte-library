import type { Book } from "../api";
import { spineWidth } from "../api";
import BookSpine from "./BookSpine";
import "./Bookcase.scss";

/*
 * Inner shelf width budget, px — must match Bookcase.scss:
 * min(680px, 94vw) cabinet − 2 × (24px wall + 18px inner padding).
 * ponytail: packing assumes the 680px case; under 680px the spines
 * flex-shrink slightly instead of re-packing per viewport.
 */
const SHELF_WIDTH = 596;
const BOOK_GAP = 5;
const MIN_SHELVES = 6;

function packShelves(books: Book[]): Book[][] {
    const shelves: Book[][] = [];
    let row: Book[] = [];
    let used = 0;
    for (const book of books) {
        const w = spineWidth(book);
        if (row.length > 0 && used + BOOK_GAP + w > SHELF_WIDTH) {
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

export default function Bookcase({ books }: { books: Book[] }) {
    const shelves = packShelves(books);
    const firstEmpty = shelves.findIndex((shelf) => shelf.length === 0);
    return (
        <section className="bookcase" aria-label="Книжный шкаф">
            <div className="bookcase-top" aria-hidden="true" />
            <div className="bookcase-body">
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
