import type { CSSProperties } from "react";
import type { Book } from "../../api/api";
import {
    bookLook,
    bookPlace,
    spineHeight,
    spineImageUrl,
    spineWidth,
} from "../../api/api";
import "./BookSpine.scss";

export default function BookSpine({
    book,
    yaw = 0,
    rank = 0,
}: {
    book: Book;
    yaw?: number;
    rank?: number;
}) {
    const width = spineWidth(book);
    const height = spineHeight(book);
    const place = bookPlace(book);
    const look = bookLook(book);
    const style = {
        width,
        height,
        zIndex: rank,
        "--book-length": `${place.length}px`,
        "--z": `${place.z}px`,
        "--yaw": yaw,
        "--back": place.back,
        "--page-a": look.pageA,
        "--page-b": look.pageB,
        "--cover": book.spineColor,
        "--gap": `${look.gap}px`,
        "--tight": (10 - look.gap) / 6,
    } as CSSProperties;

    const spineStyle: CSSProperties = {
        backgroundColor: book.spineColor,
        color: book.spineTextColor,
    };

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
                {book.hasSpineImage ? (
                    <img
                        className="book-spine-img"
                        src={spineImageUrl(book)}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        alt=""
                    />
                ) : (
                    <>
                        <span className="spine-title">{book.title}</span>
                        <span className="spine-author">{book.author}</span>
                    </>
                )}
            </span>
            <span
                className="book-face book-side book-side-left"
                aria-hidden="true"
            />
            <span
                className="book-face book-side book-side-right"
                aria-hidden="true"
            />
            <span className="book-face book-top" aria-hidden="true">
                <span className="book-pages" />
            </span>
        </button>
    );
}
