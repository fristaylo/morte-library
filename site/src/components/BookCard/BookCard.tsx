import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { type Book, coverUrl, fetchBook, formatDateRead } from "../../api";
import "./BookCard.scss";

const GAP = 16;
const MARGIN = 12;
const KEEP_OPEN = ".bookcase-hit, .book-btn";

export default function BookCard({
    book,
    anchor,
    onFrame,
    onClose,
}: {
    book: Book;
    anchor: () => DOMRect | null;
    onFrame?: (cb: (() => void) | null) => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    const titleId = useId();
    const [synopsis, setSynopsis] = useState<string | null | undefined>();
    const rating = Math.min(10, Math.max(0, Math.round(book.rating)));
    const dateRead = formatDateRead(book);

    useEffect(() => {
        let cancelled = false;
        fetchBook(book.slug).then(
            (detail) => {
                if (!cancelled) setSynopsis(detail.synopsis);
            },
            () => {
                if (!cancelled) setSynopsis(null);
            },
        );
        return () => {
            cancelled = true;
        };
    }, [book.slug]);

    useEffect(() => {
        ref.current?.querySelector("a")?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeRef.current();
        };
        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Element;
            if (!ref.current?.contains(target) && !target.closest(KEEP_OPEN)) {
                closeRef.current();
            }
        };
        window.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onPointerDown, true);
        return () => {
            window.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onPointerDown, true);
        };
    }, []);

    useLayoutEffect(() => {
        const sheet = window.matchMedia("(max-width: 640px)");
        let raf = 0;
        const place = () => {
            const el = ref.current;
            const rect = anchor();
            if (!el) return;
            if (!rect || rect.bottom <= 0 || rect.top >= window.innerHeight) {
                closeRef.current();
                return;
            }
            if (sheet.matches) {
                el.style.left = "";
                el.style.top = "";
            } else {
                const right = rect.right + GAP;
                const left =
                    right + el.offsetWidth + MARGIN <= window.innerWidth
                        ? right
                        : Math.max(MARGIN, rect.left - GAP - el.offsetWidth);
                const centered = rect.top + (rect.height - el.offsetHeight) / 2;
                const top = Math.max(
                    MARGIN,
                    Math.min(
                        centered,
                        window.innerHeight - el.offsetHeight - MARGIN,
                    ),
                );
                el.style.left = `${left}px`;
                el.style.top = `${top}px`;
            }
        };
        const schedule = () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = 0;
                place();
            });
        };
        place();
        onFrame?.(place);
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        return () => {
            onFrame?.(null);
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
            cancelAnimationFrame(raf);
        };
    }, [anchor, onFrame]);

    return (
        <div
            ref={ref}
            className="book-card"
            role="dialog"
            aria-labelledby={titleId}
        >
            <div className="book-card-head">
                {book.hasCover ? (
                    <img
                        className="book-card-cover"
                        src={coverUrl(book)}
                        alt=""
                        decoding="async"
                    />
                ) : (
                    <div
                        className="book-card-cover book-card-cover--drawn"
                        style={{
                            background: book.spineColor,
                            color: book.spineTextColor,
                        }}
                    >
                        <span>{book.title}</span>
                    </div>
                )}
                <div className="book-card-info">
                    <h2 className="book-card-title" id={titleId}>
                        {book.title}
                    </h2>
                    <p className="book-card-author">{book.author}</p>
                    <div className="book-card-meta">
                        <span
                            className="book-card-stars"
                            role="img"
                            aria-label={`оценка: ${rating} из 10`}
                        >
                            <span
                                className="book-card-stars-filled"
                                aria-hidden="true"
                            >
                                {"★".repeat(rating)}
                            </span>
                            <span aria-hidden="true">
                                {"★".repeat(10 - rating)}
                            </span>
                        </span>
                        {book.pages !== null && <span>{book.pages} стр.</span>}
                        {dateRead && <span>{dateRead}</span>}
                    </div>
                </div>
            </div>
            {synopsis !== null && (
                <p className="book-card-synopsis">{synopsis ?? "…"}</p>
            )}
            <Link className="btn btn-dark" to={`/book/${book.slug}`}>
                Перейти к книге
            </Link>
        </div>
    );
}
