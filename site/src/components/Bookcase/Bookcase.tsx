import {
    type CSSProperties,
    memo,
    type PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useNavigate } from "react-router";
import {
    type Book,
    type Category,
    createCategory,
    deleteCategory,
    type OrderGroup,
    renameCategory,
    saveBookOrder,
} from "../../api";
import { useAuth } from "../../hooks/useAuth";
import { useHour } from "../../hooks/useHour";
import BookCard from "../BookCard/BookCard";
import Dialog from "../Dialogs/Dialog";
import LoginDialog from "../Dialogs/LoginDialog/LoginDialog";
import Inkwell from "../Inkwell/Inkwell";
import { DialFace, fmt } from "../TimeDial/TimeDial";
import {
    type Box,
    type ClockFace,
    createShelfScene,
    type Hit,
    type SceneInfo,
    type ShelfScene,
    type Slot,
    spineSize,
} from "./shelfScene";
import "./Bookcase.scss";

const MOUSE_DISTANCE = 5;
const TOUCH_DELAY = 400;
const TOUCH_TOLERANCE = 8;
const SCROLL_EDGE = 60;
const SCROLL_SPEED = 20;
const MIN_TAP = 44;
const CLOCK_FADE_MS = 200;

interface Press {
    slug: string;
    pointerId: number;
    touch: boolean;
    startX: number;
    startY: number;
    x: number;
    y: number;
    active: boolean;
    timer: number;
}

interface ShelfHandlers {
    toggle(slug: string): void;
    edit(id: number): void;
    focus(slug: string): void;
    blur(): void;
}

interface DropTarget {
    categoryId: number;
    insertAt: number;
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
    const navigate = useNavigate();
    const { authorized } = useAuth();
    const bodyRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const hitRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneRef = useRef<ShelfScene | null>(null);
    const pressRef = useRef<Press | null>(null);
    const snapshotRef = useRef<Book[] | null>(null);
    const lastTargetRef = useRef<DropTarget | null>(null);
    const frameRef = useRef(0);
    const suppressClickRef = useRef(false);
    const [flat, setFlat] = useState(false);
    const [scene, setScene] = useState<ShelfScene | null>(null);
    const [info, setInfo] = useState<SceneInfo | null>(null);
    const [size, setSize] = useState({ width: 1024, cw: 1024, ch: 800 });
    const [loginOpen, setLoginOpen] = useState(false);
    const [clockOpen, setClockOpen] = useState(false);
    const [picked, setPicked] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [categoryDialog, setCategoryDialog] = useState<{
        mode: "create" | "edit";
        category?: Category;
    } | null>(null);

    const [local, setLocal] = useState<{
        base: Book[];
        items: Book[];
    } | null>(null);
    const items = local && local.base === books ? local.items : books;
    const live = useRef({ books, items, categories, onChanged });
    live.current = { books, items, categories, onChanged };

    const bodyH =
        info && scene
            ? Math.ceil(info.height / scene.worldPerPx(size.width))
            : 0;
    const labels = useMemo(
        () => new Map(books.map((b) => [b.slug, `${b.title} — ${b.author}`])),
        [books],
    );

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const next = createShelfScene(canvas);
        if (!next) {
            setFlat(true);
            return;
        }
        sceneRef.current = next;
        setScene(next);
        return () => {
            next.dispose();
            sceneRef.current = null;
            setScene(null);
        };
    }, []);

    useLayoutEffect(() => {
        if (scene) setInfo(scene.setLibrary(items, categories, authorized));
    }, [scene, items, categories, authorized]);

    useLayoutEffect(() => {
        const body = bodyRef.current;
        const canvas = canvasRef.current;
        if (!body || !canvas) return;
        const measure = () => {
            const width = Math.floor(body.clientWidth);
            const { clientWidth: cw, clientHeight: ch } = canvas;
            if (width === 0 || cw === 0 || ch === 0) return;
            setSize((prev) =>
                prev.width === width && prev.cw === cw && prev.ch === ch
                    ? prev
                    : { width, cw, ch },
            );
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(body);
        observer.observe(canvas);
        window.addEventListener("resize", measure);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, []);

    const syncScroll = useCallback(() => {
        const body = bodyRef.current;
        if (body) sceneRef.current?.setTop(body.getBoundingClientRect().top);
    }, []);

    const place = useCallback(() => {
        const layer = overlayRef.current;
        const current = sceneRef.current;
        if (!layer || !current) return;
        const view = current.project();
        const w = layer.clientWidth;
        const h = layer.clientHeight;
        for (const el of layer.querySelectorAll<HTMLElement>("[data-slug]")) {
            put(el, view.books.get(el.dataset.slug ?? ""), w, h, 0);
        }
        for (const el of layer.querySelectorAll<HTMLElement>("[data-row]")) {
            put(el, view.plates[Number(el.dataset.row)], w, h, 0);
        }
        for (const el of layer.querySelectorAll<HTMLElement>("[data-add]")) {
            put(el, view.add, w, h, MIN_TAP);
        }
        for (const el of layer.querySelectorAll<HTMLElement>("[data-ink]")) {
            put(el, view.ink, w, h, 0);
        }
        for (const el of layer.querySelectorAll<HTMLElement>("[data-clock]")) {
            put(el, view.clock, w, h, 0);
        }
    }, []);

    useLayoutEffect(() => {
        if (!scene) return;
        setInfo(scene.resize(size.cw, size.ch, size.width));
        syncScroll();
    }, [scene, size.cw, size.ch, size.width, syncScroll]);

    useLayoutEffect(place);

    useLayoutEffect(() => {
        if (!scene) return;
        const onScroll = () => {
            syncScroll();
            place();
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [scene, syncScroll, place]);

    useEffect(() => {
        if (!scene) return;
        const root = document.documentElement;
        let prev = "";
        const apply = () => {
            const style = getComputedStyle(root);
            const read = (name: string) => style.getPropertyValue(name).trim();
            const case1 = read("--case-1");
            const case2 = read("--case-2");
            const dial = {
                edge: read("--case-edge"),
                line: read("--line"),
                faint: read("--ink-faint"),
                gold: read("--gold"),
                soft: read("--ink-soft"),
            };
            const key = `${case1}|${case2}|${Object.values(dial).join("|")}`;
            if (key === prev) return;
            prev = key;
            scene.setCaseColors(case1, case2);
            scene.setClockColors(dial);
        };
        apply();
        const observer = new MutationObserver(apply);
        observer.observe(root, {
            attributes: true,
            attributeFilter: ["style"],
        });
        return () => observer.disconnect();
    }, [scene]);

    useEffect(() => {
        scene?.setPicked(picked);
    }, [scene, picked]);

    const hoverAt = (hit: Hit | null) => {
        sceneRef.current?.setHover(hit?.kind === "book" ? hit.slug : null);
        if (hitRef.current) {
            hitRef.current.style.cursor =
                hit && (hit.kind !== "plate" || authorized) ? "pointer" : "";
        }
    };

    const setOrder = (next: Book[]) =>
        setLocal({ base: live.current.books, items: next });

    const reorderAt = (press: Press): Book[] | null => {
        const slot = sceneRef.current?.slotAt(press.x, press.y, press.slug);
        if (!slot) return null;
        const target = insertTarget(
            live.current.items,
            live.current.categories,
            press.slug,
            slot,
        );
        const prev = lastTargetRef.current;
        if (
            prev?.categoryId === target.categoryId &&
            prev.insertAt === target.insertAt
        ) {
            return null;
        }
        lastTargetRef.current = target;
        return reorder(live.current.items, press.slug, target);
    };

    const follow = (press: Press) => {
        syncScroll();
        sceneRef.current?.dragTo(press.x, press.y);
        const next = reorderAt(press);
        if (next) setOrder(next);
    };

    const autoScroll = () => {
        const press = pressRef.current;
        if (!press?.active) return;
        const bottom = window.innerHeight - SCROLL_EDGE;
        const speed =
            press.y < SCROLL_EDGE
                ? (press.y - SCROLL_EDGE) / SCROLL_EDGE
                : press.y > bottom
                  ? (press.y - bottom) / SCROLL_EDGE
                  : 0;
        if (speed !== 0) {
            window.scrollBy({
                top: Math.max(-1, Math.min(1, speed)) * SCROLL_SPEED,
                behavior: "instant",
            });
            follow(press);
        }
        frameRef.current = requestAnimationFrame(autoScroll);
    };

    const startDrag = (press: Press) => {
        if (pressRef.current !== press || press.active) return;
        window.clearTimeout(press.timer);
        press.active = true;
        snapshotRef.current = live.current.items;
        lastTargetRef.current = null;
        setPicked(null);
        hoverAt(null);
        sceneRef.current?.beginDrag(press.slug, press.x, press.y);
        if (hitRef.current) hitRef.current.style.cursor = "grabbing";
        follow(press);
        frameRef.current = requestAnimationFrame(autoScroll);
    };

    const release = () => {
        window.clearTimeout(pressRef.current?.timer);
        cancelAnimationFrame(frameRef.current);
        pressRef.current = null;
        sceneRef.current?.endDrag();
    };

    const cancelDrag = () => {
        const snapshot = snapshotRef.current;
        const wasActive = pressRef.current?.active;
        release();
        if (wasActive) suppressClickRef.current = true;
        if (wasActive && snapshot) setOrder(snapshot);
    };

    const drop = async (press: Press) => {
        const next = reorderAt(press);
        const final = next ?? live.current.items;
        if (next) setOrder(next);
        release();
        const snapshot = snapshotRef.current;
        const sourceBook = snapshot?.find((b) => b.slug === press.slug);
        const currentBook = final.find((b) => b.slug === press.slug);
        if (!snapshot || !sourceBook || !currentBook) return;
        const sameOrder =
            snapshot.map((b) => b.slug).join() ===
            final.map((b) => b.slug).join();
        if (sameOrder && sourceBook.categoryId === currentBook.categoryId) {
            return;
        }
        const affected = new Set([
            sourceBook.categoryId,
            currentBook.categoryId,
        ]);
        const groups: OrderGroup[] = [...affected].map((categoryId) => ({
            categoryId,
            slugs: final
                .filter((b) => b.categoryId === categoryId)
                .map((b) => b.slug),
        }));
        setSaveError(null);
        try {
            await saveBookOrder(groups);
            await live.current.onChanged();
        } catch (err) {
            setOrder(snapshot);
            setSaveError(
                err instanceof Error
                    ? err.message
                    : "Не получилось сохранить порядок.",
            );
        }
    };

    const cancelRef = useRef(cancelDrag);
    cancelRef.current = cancelDrag;

    useEffect(() => {
        const hit = hitRef.current;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && pressRef.current?.active) {
                cancelRef.current();
            }
        };
        const blockScroll = (e: TouchEvent) => {
            if (pressRef.current?.active) e.preventDefault();
        };
        window.addEventListener("keydown", onKey);
        hit?.addEventListener("touchmove", blockScroll, { passive: false });
        return () => {
            window.removeEventListener("keydown", onKey);
            hit?.removeEventListener("touchmove", blockScroll);
            window.clearTimeout(pressRef.current?.timer);
            cancelAnimationFrame(frameRef.current);
        };
    }, []);

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        suppressClickRef.current = false;
        if (!authorized || e.button !== 0) return;
        const hit = sceneRef.current?.pick(e.clientX, e.clientY);
        if (hit?.kind !== "book") return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const press: Press = {
            slug: hit.slug,
            pointerId: e.pointerId,
            touch: e.pointerType === "touch",
            startX: e.clientX,
            startY: e.clientY,
            x: e.clientX,
            y: e.clientY,
            active: false,
            timer: 0,
        };
        if (press.touch) {
            press.timer = window.setTimeout(
                () => startDrag(press),
                TOUCH_DELAY,
            );
        }
        pressRef.current = press;
    };

    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        const press = pressRef.current;
        if (!press) {
            if (e.pointerType !== "touch") {
                hoverAt(sceneRef.current?.pick(e.clientX, e.clientY) ?? null);
            }
            return;
        }
        if (press.pointerId !== e.pointerId) return;
        press.x = e.clientX;
        press.y = e.clientY;
        if (press.active) {
            follow(press);
            return;
        }
        const moved = Math.hypot(
            e.clientX - press.startX,
            e.clientY - press.startY,
        );
        if (press.touch) {
            if (moved > TOUCH_TOLERANCE) release();
        } else if (moved > MOUSE_DISTANCE) {
            startDrag(press);
        }
    };

    const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
        const press = pressRef.current;
        if (!press || press.pointerId !== e.pointerId) return;
        if (!press.active) {
            release();
            return;
        }
        suppressClickRef.current = true;
        setTimeout(() => {
            suppressClickRef.current = false;
        }, 0);
        drop(press);
    };

    const closeCard = () => {
        if (picked && document.activeElement?.closest(".book-card")) {
            document
                .querySelector<HTMLElement>(
                    `.book-btn[data-slug="${CSS.escape(picked)}"]`,
                )
                ?.focus({ preventScroll: true });
        }
        setPicked(null);
    };

    const toggle = (slug: string | null) => {
        if (slug && slug !== picked) setPicked(slug);
        else closeCard();
    };

    const anchor = useCallback(() => {
        if (!picked) return null;
        if (sceneRef.current) return sceneRef.current.bookRect(picked);
        return (
            document
                .querySelector(`.book-btn[data-slug="${CSS.escape(picked)}"]`)
                ?.getBoundingClientRect() ?? null
        );
    }, [picked]);

    const cardBook = picked ? books.find((b) => b.slug === picked) : undefined;

    const openAdd = () => {
        navigate("/book/add");
    };
    const onInk = () => (authorized ? openAdd() : setLoginOpen(true));
    const openCreateCategory = () => setCategoryDialog({ mode: "create" });
    const openEditCategory = (id: number) =>
        setCategoryDialog({
            mode: "edit",
            category: categories.find((c) => c.id === id),
        });

    const onBookFocus = (slug: string) => {
        sceneRef.current?.setHover(slug);
        const dy = sceneRef.current?.scrollFor(slug);
        if (dy != null) window.scrollBy({ top: dy, behavior: "instant" });
    };

    const latest = useRef({
        toggle,
        edit: openEditCategory,
        focus: onBookFocus,
    });
    latest.current = { toggle, edit: openEditCategory, focus: onBookFocus };
    const on = useMemo<ShelfHandlers>(
        () => ({
            toggle: (slug) => latest.current.toggle(slug),
            edit: (id) => latest.current.edit(id),
            focus: (slug) => latest.current.focus(slug),
            blur: () => sceneRef.current?.setHover(null),
        }),
        [],
    );

    return (
        <section
            className={flat ? "bookcase bookcase--flat" : "bookcase"}
            aria-label="Книжный шкаф"
        >
            {flat && <Inkwell onClick={onInk} />}
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
            {scene && <ClockSync scene={scene} />}
            {scene && clockOpen && (
                <ClockView
                    scene={scene}
                    size={size}
                    onClosed={() => setClockOpen(false)}
                />
            )}
            {saveError && <p className="load-error">{saveError}</p>}
            {flat ? (
                <div className="bookcase-flat">
                    {categories.map((category) => (
                        <div className="flat-shelf" key={category.id}>
                            {authorized ? (
                                <button
                                    type="button"
                                    className="flat-name"
                                    onClick={() =>
                                        openEditCategory(category.id)
                                    }
                                >
                                    {category.name}
                                </button>
                            ) : (
                                <span className="flat-name">
                                    {category.name}
                                </span>
                            )}
                            {items
                                .filter((b) => b.categoryId === category.id)
                                .map((book) => {
                                    const { w, h } = spineSize(book);
                                    return (
                                        <button
                                            type="button"
                                            className="book-btn"
                                            key={book.slug}
                                            data-slug={book.slug}
                                            aria-label={`${book.title} — ${book.author}`}
                                            style={{
                                                width: w,
                                                height: h,
                                                background: book.spineColor,
                                                color: book.spineTextColor,
                                            }}
                                            onClick={() => toggle(book.slug)}
                                        >
                                            <span>{book.title}</span>
                                        </button>
                                    );
                                })}
                        </div>
                    ))}
                    {authorized && (
                        <button
                            type="button"
                            className="shelf-add shelf-add--flat"
                            aria-label="Добавить категорию"
                            onClick={openCreateCategory}
                        >
                            +
                        </button>
                    )}
                </div>
            ) : (
                <div
                    className="bookcase-body"
                    ref={bodyRef}
                    style={{ height: bodyH }}
                >
                    <canvas className="bookcase-canvas" ref={canvasRef} />
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: клавиатурный доступ через book-btn */}
                    {/* biome-ignore lint/a11y/useKeyWithClickEvents: клавиатурный доступ через book-btn */}
                    <div
                        className="bookcase-hit"
                        ref={hitRef}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={cancelDrag}
                        onPointerLeave={() =>
                            !pressRef.current && hoverAt(null)
                        }
                        onContextMenu={(e) =>
                            pressRef.current && e.preventDefault()
                        }
                        onClick={(e) => {
                            if (suppressClickRef.current) {
                                suppressClickRef.current = false;
                                return;
                            }
                            const hit = sceneRef.current?.pick(
                                e.clientX,
                                e.clientY,
                            );
                            if (hit?.kind === "book") {
                                toggle(hit.slug);
                                return;
                            }
                            closeCard();
                            if (hit?.kind === "plate" && authorized) {
                                openEditCategory(hit.categoryId);
                            }
                        }}
                    />
                    <div className="bookcase-overlay" ref={overlayRef}>
                        <button
                            type="button"
                            className="ink-btn"
                            data-ink
                            aria-label="Добавить книгу"
                            onPointerEnter={() =>
                                sceneRef.current?.setInkHover(true)
                            }
                            onPointerLeave={() =>
                                sceneRef.current?.setInkHover(false)
                            }
                            onFocus={() => sceneRef.current?.setInkHover(true)}
                            onBlur={() => sceneRef.current?.setInkHover(false)}
                            onClick={onInk}
                        />
                        <button
                            type="button"
                            className="clock-btn"
                            data-clock
                            aria-label="Часы: время суток"
                            aria-haspopup="dialog"
                            onPointerEnter={() =>
                                sceneRef.current?.setClockHover(true)
                            }
                            onPointerLeave={() =>
                                sceneRef.current?.setClockHover(false)
                            }
                            onFocus={(e) =>
                                sceneRef.current?.setClockHover(
                                    e.currentTarget.matches(":focus-visible"),
                                )
                            }
                            onBlur={() =>
                                sceneRef.current?.setClockHover(false)
                            }
                            onClick={() => setClockOpen(true)}
                        />
                        {info?.rows.map((row, i) => {
                            const id = row.categoryId;
                            if (id === null) {
                                return (
                                    authorized && (
                                        <button
                                            type="button"
                                            className="shelf-add"
                                            key="add"
                                            data-add
                                            aria-label="Добавить категорию"
                                            onClick={openCreateCategory}
                                        >
                                            +
                                        </button>
                                    )
                                );
                            }
                            const name = categories.find(
                                (c) => c.id === id,
                            )?.name;
                            return (
                                <Shelf
                                    // biome-ignore lint/suspicious/noArrayIndexKey: ряд определяется позицией
                                    key={`${id}:${i}`}
                                    index={i}
                                    id={id}
                                    name={name}
                                    slugs={row.slugs}
                                    labels={labels}
                                    authorized={authorized}
                                    on={on}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
            {cardBook && (
                <BookCard
                    key={cardBook.slug}
                    book={cardBook}
                    anchor={anchor}
                    onFrame={scene?.onFrame}
                    onClose={closeCard}
                />
            )}
        </section>
    );
}

export default memo(Bookcase);

const Shelf = memo(function Shelf({
    index,
    id,
    name,
    slugs,
    labels,
    authorized,
    on,
}: {
    index: number;
    id: number;
    name: string | undefined;
    slugs: string[];
    labels: Map<string, string>;
    authorized: boolean;
    on: ShelfHandlers;
}) {
    return (
        <>
            {authorized ? (
                <button
                    type="button"
                    className="plate-btn"
                    data-row={index}
                    onClick={() => on.edit(id)}
                >
                    {name}
                </button>
            ) : (
                <span className="plate-label">{name}</span>
            )}
            {slugs.map((slug) => {
                const label = labels.get(slug);
                return (
                    label && (
                        <button
                            type="button"
                            className="book-btn"
                            key={slug}
                            data-slug={slug}
                            aria-label={label}
                            onFocus={() => on.focus(slug)}
                            onBlur={on.blur}
                            onClick={() => on.toggle(slug)}
                        />
                    )
                );
            })}
        </>
    );
});

function ClockSync({ scene }: { scene: ShelfScene }) {
    const { hour } = useHour();
    useEffect(() => {
        scene.setClockHour(hour);
    }, [scene, hour]);
    return null;
}

function ClockView({
    scene,
    size,
    onClosed,
}: {
    scene: ShelfScene;
    size: object;
    onClosed: () => void;
}) {
    const { hour, isOverride, setOverride } = useHour();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const faceRef = useRef<SVGSVGElement>(null);
    const stage = useRef<"opening" | "open" | "closing">("opening");
    const [face, setFace] = useState<ClockFace | null>(null);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const root = document.documentElement;
        root.style.overflow = "hidden";
        root.style.scrollbarGutter = "stable";
        root.classList.add("clock-zoom");
        const items = Array.from(
            document.querySelectorAll<HTMLElement>("[data-scene-follow]"),
            (el) => {
                const { left, top } = el.getBoundingClientRect();
                el.style.transformOrigin = "0 0";
                return { el, left, top };
            },
        );
        scene.onPose(() => {
            const h = scene.homography();
            for (const { el, left, top } of items) {
                el.style.transform = `translate(${-left}px, ${-top}px) ${h} translate(${left}px, ${top}px)`;
            }
        });
        dialog.showModal();
        dialog.getBoundingClientRect();
        dialog.classList.add("is-on");
        scene.openClock(() => {
            stage.current = "open";
            setFace(scene.clockFace());
            setShown(true);
        });
        return () => {
            scene.onPose(null);
            for (const { el } of items) {
                el.style.transform = "";
                el.style.transformOrigin = "";
            }
            root.classList.remove("clock-zoom");
            root.style.overflow = "";
            root.style.scrollbarGutter = "";
            dialog.classList.remove("is-on");
            if (dialog.open) dialog.close();
        };
    }, [scene]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: пересчёт при смене размера холста
    useEffect(() => {
        if (stage.current === "open") setFace(scene.clockFace());
    }, [scene, size]);

    useEffect(() => {
        if (shown) faceRef.current?.focus({ preventScroll: true });
    }, [shown]);

    const close = () => {
        const dialog = dialogRef.current;
        if (stage.current !== "open" || !dialog) return;
        stage.current = "closing";
        setShown(false);
        dialog.classList.remove("is-on");
        const finish = () => {
            dialog.close();
            document
                .querySelector<HTMLElement>("[data-clock]")
                ?.focus({ preventScroll: true });
            onClosed();
        };
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
        scene.closeClock(() =>
            reduce ? setTimeout(finish, CLOCK_FADE_MS) : finish(),
        );
    };

    return (
        <dialog
            ref={dialogRef}
            className="clock-view"
            aria-label="Часы: время суток"
            style={
                {
                    "--clock-r": `${face?.r ?? scene.clockRadius()}px`,
                } as CSSProperties
            }
            onKeyDown={(e) => {
                if (e.key === "Escape") {
                    e.preventDefault();
                    close();
                }
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) close();
            }}
        >
            <div
                className={shown ? "clock-ui is-shown" : "clock-ui"}
                inert={!shown}
            >
                {face && (
                    <>
                        <DialFace
                            ref={faceRef}
                            hour={hour}
                            onChange={setOverride}
                            style={{
                                left: face.x - face.r,
                                top: face.y - face.r,
                                width: 2 * face.r,
                                height: 2 * face.r,
                            }}
                        />
                        <div
                            className="clock-panel"
                            style={{ left: face.x, top: face.y + face.r + 8 }}
                        >
                            <p className="time-readout clock-readout">
                                {fmt(hour)}
                            </p>
                            <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={!isOverride}
                                onClick={() => setOverride(null)}
                            >
                                Вернуть текущее время
                            </button>
                        </div>
                    </>
                )}
                <button
                    type="button"
                    className="clock-close"
                    aria-label="Закрыть"
                    onClick={close}
                >
                    ×
                </button>
            </div>
        </dialog>
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

function put(
    el: HTMLElement,
    box: Box | null | undefined,
    w: number,
    h: number,
    min: number,
) {
    if (!box) {
        el.style.display = "none";
        return;
    }
    let { x, y, w: bw, h: bh } = box;
    if (bw < min) {
        x -= (min - bw) / 2;
        bw = min;
    }
    if (bh < min) {
        y -= (min - bh) / 2;
        bh = min;
    }
    if (x + bw <= 0 || x >= w || y + bh <= 0 || y >= h) {
        x = Math.min(Math.max(x, 0), w - 1);
        y = Math.min(Math.max(y, 0), h - 1);
        bw = bh = 1;
    }
    el.style.display = "";
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.width = `${bw}px`;
    el.style.height = `${bh}px`;
}

function insertTarget(
    items: Book[],
    categories: Category[],
    activeSlug: string,
    slot: Slot,
): DropTarget {
    const { categoryId, slugs, index: k } = slot;
    const rest = items.filter((b) => b.slug !== activeSlug);
    let insertAt: number;
    if (k < slugs.length) {
        insertAt = rest.findIndex((b) => b.slug === slugs[k]);
    } else if (slugs.length > 0) {
        insertAt =
            rest.findIndex((b) => b.slug === slugs[slugs.length - 1]) + 1;
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

function reorder(
    items: Book[],
    slug: string,
    target: DropTarget,
): Book[] | null {
    const active = items.find((b) => b.slug === slug);
    if (!active) return null;
    const next = items.filter((b) => b.slug !== slug);
    next.splice(target.insertAt, 0, {
        ...active,
        categoryId: target.categoryId,
    });
    return next;
}
