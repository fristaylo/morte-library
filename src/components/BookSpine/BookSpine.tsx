import type {
    DraggableAttributes,
    DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { type CSSProperties, type Ref, useRef } from "react";
import type { Book } from "../../api/api";
import {
    bookLook,
    bookPlace,
    spineHeight,
    spineImageUrl,
    spineWidth,
} from "../../api/api";
import { navigate } from "../../router";
import "./BookSpine.scss";

function Spine({
    book,
    yaw = 0,
    rank = 0,
    className,
    onClick,
    elementRef,
    attributes,
    listeners,
}: {
    book: Book;
    yaw?: number;
    rank?: number;
    className: string;
    onClick?: () => void;
    elementRef?: Ref<HTMLButtonElement>;
    attributes?: DraggableAttributes;
    listeners?: DraggableSyntheticListeners;
}) {
    const width = spineWidth(book);
    const height = spineHeight(book);
    const place = bookPlace(book);
    const look = bookLook(book);
    const style = {
        width,
        height,
        zIndex: rank,
        "--rest-tilt": `${6 + height / 60}deg`,
        "--book-length": `${place.length}px`,
        "--z": `${place.z}px`,
        "--rest-yaw": yaw,
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

    const side = Math.abs(yaw) < 0.15 ? null : yaw < 0 ? "right" : "left";

    return (
        <button
            ref={elementRef}
            type="button"
            className={className}
            style={style}
            data-slug={book.slug}
            aria-label={`${book.title} — ${book.author}`}
            onClick={onClick}
            {...attributes}
            {...listeners}
        >
            <span className="book-face book-spine" style={spineStyle}>
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
            {side && (
                <span
                    className={`book-face book-side book-side-${side}`}
                    aria-hidden="true"
                />
            )}
            <span className="book-face book-top" aria-hidden="true">
                <span className="book-pages" />
            </span>
        </button>
    );
}

export default function BookSpine({
    book,
    yaw = 0,
    rank = 0,
    sortable = false,
}: {
    book: Book;
    yaw?: number;
    rank?: number;
    sortable?: boolean;
}) {
    const { attributes, listeners, setNodeRef, isDragging } = useSortable({
        id: book.slug,
        disabled: !sortable,
    });
    const draggedRef = useRef(false);
    if (isDragging) draggedRef.current = true;

    const className = `book${sortable ? " book--sortable" : ""}${
        isDragging ? " book--ghost" : ""
    }`;

    return (
        <Spine
            book={book}
            yaw={yaw}
            rank={rank}
            className={className}
            elementRef={setNodeRef}
            attributes={sortable ? attributes : undefined}
            listeners={sortable ? listeners : undefined}
            onClick={() => {
                if (draggedRef.current) {
                    draggedRef.current = false;
                    return;
                }
                navigate(`/book/${book.slug}`);
            }}
        />
    );
}

export function BookSpinePreview({
    book,
    yaw = 0,
    rank = 0,
}: {
    book: Book;
    yaw?: number;
    rank?: number;
}) {
    return (
        <Spine
            book={book}
            yaw={yaw}
            rank={rank}
            className="book book--overlay"
        />
    );
}
