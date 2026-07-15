import type { CSSProperties } from "react";
import type { Book } from "../api";
import {
    bookDepth,
    bookLook,
    spineHeight,
    spineImageUrl,
    spineWidth,
} from "../api";
import "./BookSpine.scss";

export default function BookSpine({ book }: { book: Book }) {
    const width = spineWidth(book);
    const height = spineHeight(book);
    const depth = bookDepth(book);
    const look = bookLook(book);
    const style = {
        width,
        height,
        "--book-depth": `${depth}px`,
        "--page-a": look.pageA,
        "--page-b": look.pageB,
        "--cover": book.spineColor,
    } as CSSProperties;

    const spineStyle: CSSProperties = {
        backgroundColor: book.spineColor,
        color: book.spineTextColor,
    };
    if (book.hasSpineImage) {
        spineStyle.backgroundImage = `url(${spineImageUrl(book)})`;
    }

    return (
        <button
            type="button"
            className="book"
            style={style}
            aria-label={`${book.title} — ${book.author}`}
            onClick={() => {
                window.location.hash = `#/book/${book.slug}`;
            }}
        >
            <span
                className={
                    book.hasSpineImage
                        ? "book-face book-spine book-spine-image"
                        : "book-face book-spine"
                }
                style={spineStyle}
            >
                {!book.hasSpineImage && (
                    <>
                        <span className="spine-title">{book.title}</span>
                        <span className="spine-author">{book.author}</span>
                    </>
                )}
            </span>
            <span className="book-face book-top" aria-hidden="true" />
        </button>
    );
}
