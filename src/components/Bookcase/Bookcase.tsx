import {
    memo,
    type RefObject,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { Book } from "../../api/api";
import { useAuth } from "../../hooks/useAuth";
import { navigate } from "../../router";
import BookSpine from "../BookSpine/BookSpine";
import LoginDialog from "../Dialogs/LoginDialog/LoginDialog";
import Inkwell from "../Inkwell/Inkwell";
import {
    packShelves,
    type ShelfMetrics,
    shelfLayout,
    shelfYaws,
    visibleRange,
} from "./layout";
import "./Bookcase.scss";

const DEFAULT_SHELF_WIDTH = 936;
const DEFAULT_METRICS: ShelfMetrics = {
    width: DEFAULT_SHELF_WIDTH,
    padY: 55,
    minHeight: 290,
    board: 9,
    borderBox: true,
};

function metricsEqual(a: ShelfMetrics, b: ShelfMetrics): boolean {
    return (
        a.width === b.width &&
        a.padY === b.padY &&
        a.minHeight === b.minHeight &&
        a.board === b.board &&
        a.borderBox === b.borderBox
    );
}

function useShelfMetrics(
    bodyRef: RefObject<HTMLElement | null>,
    rowRef: RefObject<HTMLElement | null>,
): ShelfMetrics {
    const [metrics, setMetrics] = useState<ShelfMetrics>(DEFAULT_METRICS);
    useLayoutEffect(() => {
        const body = bodyRef.current;
        if (!body) return;
        const measure = () => {
            const el = rowRef.current;
            if (!el) return;
            const cs = getComputedStyle(el);
            const pad =
                parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
            const inner = el.clientWidth - pad;
            if (inner <= 0) return;
            const padY =
                parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
            const minHeightRaw = parseFloat(cs.minHeight);
            const boardEl =
                el.parentElement?.querySelector<HTMLElement>(".bookcase-board");
            const marginTop = boardEl
                ? parseFloat(getComputedStyle(boardEl).marginTop)
                : NaN;
            const board = boardEl
                ? boardEl.offsetHeight +
                  (Number.isNaN(marginTop) ? 0 : marginTop)
                : 9;
            const next: ShelfMetrics = {
                width: Math.max(160, inner),
                padY,
                minHeight: Number.isNaN(minHeightRaw) ? 290 : minHeightRaw,
                board,
                borderBox: cs.boxSizing === "border-box",
            };
            setMetrics((prev) => (metricsEqual(prev, next) ? prev : next));
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(body);
        return () => ro.disconnect();
    }, [bodyRef, rowRef]);
    return metrics;
}

function Bookcase({ books }: { books: Book[] }) {
    const rowRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const metrics = useShelfMetrics(bodyRef, rowRef);
    const { authorized } = useAuth();
    const [loginOpen, setLoginOpen] = useState(false);
    const [range, setRange] = useState<[number, number]>([0, -1]);

    const layout = useMemo(() => {
        const shelves = packShelves(books, metrics.width);
        return { shelves, ...shelfLayout(shelves, metrics) };
    }, [books, metrics]);

    useLayoutEffect(() => {
        let rafId: number | null = null;
        const update = () => {
            rafId = null;
            const body = bodyRef.current;
            if (!body) return;
            const containerTop =
                body.getBoundingClientRect().top + window.scrollY;
            const scrollTop = window.scrollY - containerTop;
            const viewportH = window.innerHeight;
            const buffer = window.innerHeight;
            const next = visibleRange(
                layout.tops,
                layout.heights,
                scrollTop,
                viewportH,
                buffer,
            );
            setRange((prev) =>
                prev[0] === next[0] && prev[1] === next[1] ? prev : next,
            );
        };
        const schedule = () => {
            if (rafId !== null) return;
            rafId = requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        return () => {
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, [layout]);

    const openAdd = () => {
        navigate("/add");
    };

    const first = Math.max(0, Math.min(range[0], layout.shelves.length - 1));
    const last = Math.max(first, Math.min(range[1], layout.shelves.length - 1));
    const topSpacer = layout.tops[first] ?? 0;
    const bottomSpacer = Math.max(
        0,
        layout.total - (layout.tops[last] + layout.heights[last]),
    );

    return (
        <section className="bookcase" aria-label="Книжный шкаф">
            <Inkwell
                onClick={() => (authorized ? openAdd() : setLoginOpen(true))}
            />
            <LoginDialog
                open={loginOpen}
                onClose={() => setLoginOpen(false)}
                onSuccess={() => {
                    setLoginOpen(false);
                    openAdd();
                }}
            />
            <div className="bookcase-top" aria-hidden="true" />
            <div className="bookcase-body" ref={bodyRef}>
                <span
                    className="bookcase-wall bookcase-wall-left"
                    aria-hidden="true"
                />
                <span
                    className="bookcase-wall bookcase-wall-right"
                    aria-hidden="true"
                />
                <div style={{ height: topSpacer }} aria-hidden="true" />
                {layout.shelves.slice(first, last + 1).map((shelf, k) => {
                    const i = first + k;
                    const yaws = shelfYaws(shelf, metrics.width);
                    return (
                        <div
                            className="bookcase-shelf"
                            key={i}
                            style={{ height: layout.heights[i] }}
                        >
                            <div
                                className="bookcase-books"
                                ref={i === first ? rowRef : undefined}
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
                <div style={{ height: bottomSpacer }} aria-hidden="true" />
            </div>
            <div className="bookcase-plinth" aria-hidden="true" />
        </section>
    );
}

export default memo(Bookcase);
