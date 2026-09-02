import {
    DndContext,
    type DragEndEvent,
    type DragMoveEvent,
    DragOverlay,
    type DragStartEvent,
    type DropAnimation,
    MeasuringStrategy,
    MouseSensor,
    pointerWithin,
    TouchSensor,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import {
    memo,
    type ReactNode,
    type RefObject,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    type Book,
    type Category,
    createCategory,
    deleteCategory,
    type OrderGroup,
    renameCategory,
    saveBookOrder,
} from "../../api/api";
import { useAuth } from "../../hooks/useAuth";
import { navigate } from "../../router";
import BookSpine, { BookSpinePreview } from "../BookSpine/BookSpine";
import Dialog from "../Dialogs/Dialog";
import LoginDialog from "../Dialogs/LoginDialog/LoginDialog";
import Inkwell from "../Inkwell/Inkwell";
import {
    packRows,
    type Row,
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

const DROP_MS = 250;
const DROP_EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";

function translate(t: { x: number; y: number }): string {
    return `translate3d(${t.x}px, ${t.y}px, 0)`;
}

const dropAnimation: DropAnimation = {
    duration: DROP_MS,
    easing: DROP_EASE,
    keyframes: ({ active, dragOverlay, transform: { initial, final } }) => {
        const flying =
            dragOverlay.node.querySelector<HTMLElement>(".book--overlay");
        if (!flying) {
            return [
                { transform: translate(initial) },
                { transform: translate(final) },
            ];
        }
        const from = getComputedStyle(flying).transform;
        flying.classList.add("book--landing");
        const to = getComputedStyle(flying).transform;
        const landed = flying.getBoundingClientRect();
        flying.classList.remove("book--landing");
        flying.animate([{ transform: from }, { transform: to }], {
            duration: DROP_MS,
            easing: DROP_EASE,
            fill: "forwards",
        });
        const ghost = active.node.getBoundingClientRect();
        return [
            { transform: translate(initial) },
            {
                transform: translate({
                    x: initial.x + ghost.left - landed.left,
                    y: initial.y + ghost.top - landed.top,
                }),
            },
        ];
    },
    sideEffects: ({ active }) => {
        active.node.classList.add("book--ghost");
        return () => active.node.classList.remove("book--ghost");
    },
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

function resolveDrop(
    body: HTMLElement,
    items: Book[],
    activeSlug: string,
    categories: Category[],
    cx: number,
    cy: number,
    ghostShrink: number,
): { categoryId: number; insertAt: number } | null {
    const rowEls = Array.from(
        body.querySelectorAll<HTMLElement>(".bookcase-books[data-category]"),
    );
    let rowEl: HTMLElement | undefined;
    let bestDist = Infinity;
    for (const el of rowEls) {
        const top = el.offsetTop;
        const height = el.offsetHeight;
        if (cy >= top && cy < top + height) {
            rowEl = el;
            break;
        }
        const dist = cy < top ? top - cy : cy - (top + height);
        if (dist < bestDist) {
            bestDist = dist;
            rowEl = el;
        }
    }
    if (!rowEl) return null;
    const categoryId = Number(rowEl.dataset.category);

    const rowEls2 = Array.from(
        rowEl.querySelectorAll<HTMLElement>("[data-slug]"),
    );
    const ghostIdx = rowEls2.findIndex((el) => el.dataset.slug === activeSlug);
    const shift = ghostIdx === -1 ? 0 : ghostShrink / 2;

    const rowSlugs: string[] = [];
    let k = 0;
    rowEls2.forEach((el, i) => {
        if (el.dataset.slug === activeSlug) return;
        rowSlugs.push(el.dataset.slug as string);
        const center =
            el.offsetLeft +
            el.offsetWidth / 2 +
            (i < ghostIdx ? shift : -shift);
        if (center < cx) k += 1;
    });

    const rest = items.filter((b) => b.slug !== activeSlug);
    let insertAt: number;
    if (k < rowSlugs.length) {
        insertAt = rest.findIndex((b) => b.slug === rowSlugs[k]);
    } else if (rowSlugs.length > 0) {
        insertAt =
            rest.findIndex((b) => b.slug === rowSlugs[rowSlugs.length - 1]) + 1;
    } else {
        let lastInCat = -1;
        rest.forEach((b, idx) => {
            if (b.categoryId === categoryId) lastInCat = idx;
        });
        if (lastInCat !== -1) {
            insertAt = lastInCat + 1;
        } else {
            const destPos = categories.findIndex((c) => c.id === categoryId);
            const nextIdx = rest.findIndex(
                (b) =>
                    categories.findIndex((c) => c.id === b.categoryId) >
                    destPos,
            );
            insertAt = nextIdx === -1 ? rest.length : nextIdx;
        }
    }

    return { categoryId, insertAt };
}

function CategoryGroup({
    categoryId,
    rows,
    startIndex,
    renderRow,
}: {
    categoryId: number;
    rows: Row[];
    startIndex: number;
    renderRow: (row: Row, i: number) => ReactNode;
}) {
    const { setNodeRef } = useDroppable({ id: `cat:${categoryId}` });
    return (
        <div className="bookcase-category" ref={setNodeRef}>
            <SortableContext
                items={rows.flatMap((row) => row.books.map((b) => b.slug))}
                strategy={() => null}
            >
                {rows.map((row, k) => renderRow(row, startIndex + k))}
            </SortableContext>
        </div>
    );
}

function CategoryDialog({
    mode,
    category,
    onClose,
    onChanged,
}: {
    mode: "create" | "edit";
    category?: Category;
    onClose: () => void;
    onChanged: () => Promise<void> | void;
}) {
    const [name, setName] = useState(category?.name ?? "");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            if (mode === "create") await createCategory(name);
            else if (category) await renameCategory(category.id, name);
            await onChanged();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!category) return;
        setBusy(true);
        setError(null);
        try {
            await deleteCategory(category.id);
            await onChanged();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open
            onClose={onClose}
            title={mode === "create" ? "Новая категория" : "Категория"}
        >
            <form
                className="login-form"
                onSubmit={(e) => {
                    e.preventDefault();
                    save();
                }}
            >
                <input
                    className="login-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Название"
                    autoFocus
                />
                {error && <p className="add-error">{error}</p>}
                <div className="add-confirm-actions">
                    {mode === "edit" && (
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={remove}
                            disabled={busy}
                        >
                            Удалить
                        </button>
                    )}
                    <button
                        type="submit"
                        className="btn btn-dark"
                        disabled={busy || !name.trim()}
                    >
                        {mode === "create" ? "Добавить" : "Сохранить"}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}

function Bookcase({
    books,
    categories,
    onChanged,
}: {
    books: Book[];
    categories: Category[];
    onChanged: () => Promise<void> | void;
}) {
    const rowRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const metrics = useShelfMetrics(bodyRef, rowRef);
    const { authorized } = useAuth();
    const [loginOpen, setLoginOpen] = useState(false);
    const [range, setRange] = useState<[number, number]>([0, -1]);

    const [local, setLocal] = useState<{
        base: Book[];
        items: Book[];
    } | null>(null);
    const items = local && local.base === books ? local.items : books;
    const setOrder = (next: Book[]) => setLocal({ base: books, items: next });
    const itemsRef = useRef(items);
    itemsRef.current = items;

    const [activeSlug, setActiveSlug] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [categoryDialog, setCategoryDialog] = useState<{
        mode: "create" | "edit";
        category?: Category;
    } | null>(null);
    const snapshotRef = useRef<Book[] | null>(null);
    const posRef = useRef(new Map<string, { x: number; y: number }>());
    const startCenterRef = useRef<{ x: number; y: number } | null>(null);
    const ghostShrinkRef = useRef(0);
    const lastTargetRef = useRef<{
        categoryId: number;
        insertAt: number;
    } | null>(null);

    const rows = useMemo(
        () => packRows(categories, items, metrics.width, authorized),
        [categories, items, metrics.width, authorized],
    );
    const layout = useMemo(() => shelfLayout(rows, metrics), [rows, metrics]);
    const activeYaw = useMemo(() => {
        if (!activeSlug) return 0;
        for (const row of rows) {
            const j = row.books.findIndex((b) => b.slug === activeSlug);
            if (j !== -1) return shelfYaws(row.books, metrics.width)[j];
        }
        return 0;
    }, [rows, activeSlug, metrics.width]);

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

    useLayoutEffect(() => {
        if (!activeSlug) return;
        const body = bodyRef.current;
        if (!body) return;
        const els = Array.from(
            body.querySelectorAll<HTMLElement>("[data-slug]"),
        );
        const next = new Map<string, { x: number; y: number }>();
        for (const el of els) {
            const slug = el.dataset.slug;
            if (!slug) continue;
            const row = el.offsetParent as HTMLElement | null;
            const x = el.offsetLeft + (row?.offsetLeft ?? 0);
            const y = el.offsetTop + (row?.offsetTop ?? 0);
            next.set(slug, { x, y });
            const prev = posRef.current.get(slug);
            if (!prev) continue;
            const dx = prev.x - x;
            const dy = prev.y - y;
            if (dx === 0 && dy === 0) continue;
            el.style.transition = "none";
            el.style.translate = `${dx}px ${dy}px`;
        }
        posRef.current = next;
        const id = requestAnimationFrame(() => {
            for (const el of els) {
                el.style.transition = "";
                el.style.translate = "";
            }
        });
        return () => cancelAnimationFrame(id);
    });

    const mouseSensor = useSensor(MouseSensor, {
        activationConstraint: { distance: 5 },
    });
    const touchSensor = useSensor(TouchSensor, {
        activationConstraint: { delay: 400, tolerance: 8 },
    });
    const activeSensors = useSensors(mouseSensor, touchSensor);
    const noSensors = useSensors();
    const sensors = authorized ? activeSensors : noSensors;

    const onDragStart = (event: DragStartEvent) => {
        const activeSlugStr = String(event.active.id);
        setActiveSlug(activeSlugStr);
        snapshotRef.current = itemsRef.current;
        posRef.current.clear();
        lastTargetRef.current = null;
        const body = bodyRef.current;
        const el = body?.querySelector<HTMLElement>(
            `[data-slug="${CSS.escape(activeSlugStr)}"]`,
        );
        if (el) {
            const row = el.offsetParent as HTMLElement | null;
            startCenterRef.current = {
                x: el.offsetLeft + (row?.offsetLeft ?? 0) + el.offsetWidth / 2,
                y: el.offsetTop + (row?.offsetTop ?? 0) + el.offsetHeight / 2,
            };
            const marginLeft = parseFloat(getComputedStyle(el).marginLeft);
            ghostShrinkRef.current =
                el.offsetWidth + (Number.isNaN(marginLeft) ? 0 : marginLeft);
        } else {
            startCenterRef.current = null;
        }
    };

    const onDragMove = (event: DragMoveEvent) => {
        const body = bodyRef.current;
        const start = startCenterRef.current;
        const activeSlugStr = String(event.active.id);
        if (!body || !start) return;
        const target = resolveDrop(
            body,
            itemsRef.current,
            activeSlugStr,
            categories,
            start.x + event.delta.x,
            start.y + event.delta.y,
            ghostShrinkRef.current,
        );
        if (!target) return;
        const prev = lastTargetRef.current;
        if (
            prev &&
            prev.categoryId === target.categoryId &&
            prev.insertAt === target.insertAt
        ) {
            return;
        }
        lastTargetRef.current = target;
        const active = itemsRef.current.find((b) => b.slug === activeSlugStr);
        if (!active) return;
        const rest = itemsRef.current.filter((b) => b.slug !== activeSlugStr);
        const next = rest.slice();
        next.splice(target.insertAt, 0, {
            ...active,
            categoryId: target.categoryId,
        });
        setOrder(next);
    };

    const onDragCancel = () => {
        setActiveSlug(null);
        posRef.current.clear();
        lastTargetRef.current = null;
        if (snapshotRef.current) setOrder(snapshotRef.current);
    };

    const onDragEnd = async (event: DragEndEvent) => {
        setActiveSlug(null);
        posRef.current.clear();
        lastTargetRef.current = null;
        const snapshot = snapshotRef.current;
        const activeSlugStr = String(event.active.id);
        const sourceBook = snapshot?.find((b) => b.slug === activeSlugStr);
        const currentBook = itemsRef.current.find(
            (b) => b.slug === activeSlugStr,
        );
        if (!snapshot || !sourceBook || !currentBook) return;
        const sameOrder =
            snapshot.map((b) => b.slug).join() ===
            itemsRef.current.map((b) => b.slug).join();
        if (sameOrder && sourceBook.categoryId === currentBook.categoryId) {
            return;
        }
        const affected = new Set([
            sourceBook.categoryId,
            currentBook.categoryId,
        ]);
        const groups: OrderGroup[] = [...affected].map((categoryId) => ({
            categoryId,
            slugs: itemsRef.current
                .filter((b) => b.categoryId === categoryId)
                .map((b) => b.slug),
        }));
        setSaveError(null);
        try {
            await saveBookOrder(groups);
            await onChanged();
        } catch (err) {
            setOrder(snapshot);
            setSaveError(
                err instanceof Error
                    ? err.message
                    : "Не получилось сохранить порядок.",
            );
        }
    };

    const openAdd = () => {
        navigate("/add");
    };
    const openCreateCategory = () => setCategoryDialog({ mode: "create" });
    const openEditCategory = (id: number) =>
        setCategoryDialog({
            mode: "edit",
            category: categories.find((c) => c.id === id),
        });

    const first = Math.max(0, Math.min(range[0], rows.length - 1));
    const last =
        rows.length === 0
            ? -1
            : Math.max(first, Math.min(range[1], rows.length - 1));
    const topSpacer = layout.tops[first] ?? 0;
    const bottomSpacer = Math.max(
        0,
        layout.total - ((layout.tops[last] ?? 0) + (layout.heights[last] ?? 0)),
    );
    const activeBook = activeSlug
        ? (items.find((b) => b.slug === activeSlug) ?? null)
        : null;

    const renderRow = (row: Row, i: number): ReactNode => {
        const yaws = shelfYaws(row.books, metrics.width);
        const isAdd = row.categoryId === null;
        const categoryId = row.categoryId;
        const hasPlate = categoryId !== null;
        return (
            <div
                className={
                    isAdd
                        ? "bookcase-shelf bookcase-shelf--add"
                        : "bookcase-shelf"
                }
                key={i}
                style={{ height: layout.heights[i] }}
            >
                <div
                    className="bookcase-books"
                    ref={i === first ? rowRef : undefined}
                    data-row={i}
                    data-category={categoryId ?? undefined}
                >
                    {isAdd && authorized && (
                        <button
                            type="button"
                            className="shelf-add"
                            onClick={openCreateCategory}
                        >
                            +
                        </button>
                    )}
                    {row.books.map((book, j) => (
                        <BookSpine
                            key={book.slug}
                            book={book}
                            yaw={yaws[j]}
                            rank={
                                row.books.length -
                                Math.round(
                                    Math.abs(j - (row.books.length - 1) / 2),
                                )
                            }
                            sortable={authorized}
                        />
                    ))}
                    {hasPlate &&
                        (authorized ? (
                            <button
                                type="button"
                                className="shelf-plate"
                                onClick={() => openEditCategory(categoryId)}
                            >
                                {
                                    categories.find((c) => c.id === categoryId)
                                        ?.name
                                }
                            </button>
                        ) : (
                            <span className="shelf-plate">
                                {
                                    categories.find((c) => c.id === categoryId)
                                        ?.name
                                }
                            </span>
                        ))}
                </div>
                <div className="bookcase-board" aria-hidden="true" />
            </div>
        );
    };

    const visible: ReactNode[] = [];
    let i = first;
    while (i <= last) {
        const row = rows[i];
        if (row.categoryId === null) {
            visible.push(renderRow(row, i));
            i += 1;
            continue;
        }
        const categoryId = row.categoryId;
        const groupRows: Row[] = [row];
        let j = i + 1;
        while (j <= last && rows[j].categoryId === categoryId) {
            groupRows.push(rows[j]);
            j += 1;
        }
        visible.push(
            <CategoryGroup
                key={`cat:${categoryId}`}
                categoryId={categoryId}
                rows={groupRows}
                startIndex={i}
                renderRow={renderRow}
            />,
        );
        i = j;
    }

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
            {categoryDialog && (
                <CategoryDialog
                    mode={categoryDialog.mode}
                    category={categoryDialog.category}
                    onClose={() => setCategoryDialog(null)}
                    onChanged={onChanged}
                />
            )}
            {saveError && <p className="load-error">{saveError}</p>}
            <div className="bookcase-top" aria-hidden="true" />
            <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                measuring={{
                    droppable: { strategy: MeasuringStrategy.WhileDragging },
                }}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                onDragCancel={onDragCancel}
            >
                <div
                    className={
                        activeSlug
                            ? "bookcase-body bookcase-body--dragging"
                            : "bookcase-body"
                    }
                    ref={bodyRef}
                >
                    <span
                        className="bookcase-wall bookcase-wall-left"
                        aria-hidden="true"
                    />
                    <span
                        className="bookcase-wall bookcase-wall-right"
                        aria-hidden="true"
                    />
                    <div style={{ height: topSpacer }} aria-hidden="true" />
                    {visible}
                    <div style={{ height: bottomSpacer }} aria-hidden="true" />
                </div>
                <DragOverlay dropAnimation={dropAnimation}>
                    {activeBook ? (
                        <BookSpinePreview book={activeBook} yaw={activeYaw} />
                    ) : null}
                </DragOverlay>
            </DndContext>
            <div className="bookcase-plinth" aria-hidden="true" />
        </section>
    );
}

export default memo(Bookcase);
