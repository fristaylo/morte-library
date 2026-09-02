import {
    type ReactNode,
    StrictMode,
    useCallback,
    useEffect,
    useLayoutEffect,
    useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
    type Book,
    type BookDetail,
    type Category,
    fetchBook,
    fetchBooks,
    fetchCategories,
} from "./api/api";
import Background from "./components/Background/Background";
import Bookcase from "./components/Bookcase/Bookcase";
import TimeDial from "./components/TimeDial/TimeDial";
import "./main.scss";
import AddPage from "./pages/AddPage/AddPage";
import ReviewPage from "./pages/ReviewPage/ReviewPage";
import { linkProps, navigate, savedScroll, usePath } from "./router";

function nowHour() {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
}

const HOUR_KEY = "morte:hour";

function storedHour(): number | null {
    const raw = localStorage.getItem(HOUR_KEY);
    if (raw === null) return null;
    const h = Number(raw);
    return Number.isFinite(h) && h >= 0 && h < 24 ? h : null;
}

function plural(n: number, [one, few, many]: [string, string, string]) {
    const d10 = n % 10;
    const d100 = n % 100;
    if (d10 === 1 && d100 !== 11) return one;
    if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return few;
    return many;
}

function SiteHeader({
    clock,
    onRandom,
    right,
}: {
    clock?: ReactNode;
    onRandom?: () => void;
    right?: ReactNode;
}) {
    return (
        <header className="topbar">
            <a className="topbar-brand" {...linkProps("/")}>
                <svg
                    width="30"
                    height="30"
                    viewBox="0 0 26 26"
                    aria-hidden="true"
                >
                    <circle cx="13" cy="13" r="13" fill="var(--mist-2)" />
                    <circle cx="19.5" cy="6.5" r="2.2" fill="#fff" />
                    <path d="M3 19.5 L9.5 8.5 L16 19.5 Z" fill="#fff" />
                    <path
                        d="M11 19.5 L16.5 11 L23 19.5 Z"
                        fill="var(--ridge-near)"
                    />
                </svg>
                <span>Библиотека Морте</span>
            </a>
            <div className="topbar-actions">
                {clock}
                {onRandom && (
                    <button
                        type="button"
                        className="topbar-chip"
                        onClick={onRandom}
                    >
                        Случайное
                    </button>
                )}
                {right}
            </div>
        </header>
    );
}

function App() {
    const path = usePath();
    const [books, setBooks] = useState<Book[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [details, setDetails] = useState<Record<string, BookDetail>>({});
    const [error, setError] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [hourOverride, setHourOverride] = useState<number | null>(storedHour);
    const [realHour, setRealHour] = useState(nowHour);
    const [dialOpen, setDialOpen] = useState(false);

    const changeHour = useCallback((next: number | null) => {
        setHourOverride(next);
        if (next === null) localStorage.removeItem(HOUR_KEY);
        else localStorage.setItem(HOUR_KEY, String(next));
    }, []);

    useEffect(() => {
        const tick = () => {
            if (!document.hidden) setRealHour(nowHour());
        };
        const id = setInterval(tick, 60_000);
        document.addEventListener("visibilitychange", tick);
        return () => {
            clearInterval(id);
            document.removeEventListener("visibilitychange", tick);
        };
    }, []);

    const hour = hourOverride ?? realHour;
    const clock = (
        <TimeDial
            hour={hour}
            isOverride={hourOverride !== null}
            onChange={changeHour}
            onOpenChange={setDialOpen}
        />
    );

    const reload = useCallback(() => {
        setDetails({});
        return Promise.all([fetchBooks(), fetchCategories()]).then(
            ([nextBooks, nextCategories]) => {
                setBooks(nextBooks);
                setCategories(nextCategories);
            },
            () => setError(true),
        );
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    const goRandom = useCallback(() => {
        const pick = books[Math.floor(Math.random() * books.length)];
        if (pick) navigate(`/book/${pick.slug}`);
    }, [books]);
    const onRandom = books.length > 0 ? goRandom : undefined;

    const route = path.match(/^\/book\/([^/]+)(\/edit)?$/);
    const book = route
        ? books.find((b) => b.slug === decodeURIComponent(route[1]))
        : undefined;
    const editing = Boolean(route?.[2]);
    const slug = route ? decodeURIComponent(route[1]) : null;
    const detail = slug ? details[slug] : undefined;

    useEffect(() => {
        setDetailError(null);
        if (!slug || detail) return;
        let cancelled = false;
        fetchBook(slug)
            .then((d) => {
                if (!cancelled) setDetails((p) => ({ ...p, [slug]: d }));
            })
            .catch(() => {
                if (!cancelled)
                    setDetailError(
                        "Не получилось открыть книгу — попробуйте позже.",
                    );
            });
        return () => {
            cancelled = true;
        };
    }, [slug, detail]);

    useLayoutEffect(() => {
        window.scrollTo({ top: savedScroll(path), behavior: "instant" });
    }, [path]);

    if (path === "/add" || (editing && book)) {
        return (
            <>
                <Background hour={hour} drift={dialOpen} />
                <SiteHeader
                    clock={clock}
                    onRandom={onRandom}
                    right={
                        <a
                            className="topbar-chip"
                            {...linkProps(book ? `/book/${book.slug}` : "/")}
                        >
                            ← {book ? "к отзыву" : "в шкаф"}
                        </a>
                    }
                />
                {editing && !detail ? (
                    <main className="review-page">
                        {detailError ? (
                            <p className="load-error">{detailError}</p>
                        ) : (
                            <p>Открываем книгу…</p>
                        )}
                    </main>
                ) : (
                    <AddPage
                        book={editing ? detail : undefined}
                        categories={categories}
                        onSaved={reload}
                    />
                )}
            </>
        );
    }

    if (book) {
        return (
            <>
                <Background hour={hour} drift={dialOpen} />
                <SiteHeader
                    clock={clock}
                    onRandom={onRandom}
                    right={
                        <a className="topbar-chip" {...linkProps("/")}>
                            ← в шкаф
                        </a>
                    }
                />
                <ReviewPage book={book} detail={detail} />
            </>
        );
    }

    return (
        <>
            <Background hour={hour} drift={dialOpen} />
            <SiteHeader
                clock={clock}
                onRandom={onRandom}
                right={
                    books.length > 0 ? (
                        <span className="topbar-chip">
                            {books.length}{" "}
                            {plural(books.length, ["книга", "книги", "книг"])}
                        </span>
                    ) : undefined
                }
            />
            <main>
                <section className="hero">
                    <h1 className="hero-title">Библиотека Морте</h1>
                    <div className="hero-actions">
                        <button
                            type="button"
                            className="btn btn-dark"
                            onClick={() =>
                                document
                                    .getElementById("shelf")
                                    ?.scrollIntoView()
                            }
                        >
                            К полкам
                            <span className="btn-arrow" aria-hidden="true">
                                ↓
                            </span>
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={books.length === 0}
                            onClick={goRandom}
                        >
                            Случайная книга
                        </button>
                    </div>
                </section>
                <section
                    className="shelf-page"
                    id="shelf"
                    aria-label="Полки с книгами"
                >
                    {error ? (
                        <p className="load-error">
                            Не получилось достать книги с полки — загляните
                            позже.
                        </p>
                    ) : (
                        <Bookcase
                            books={books}
                            categories={categories}
                            onChanged={reload}
                        />
                    )}
                </section>
            </main>
        </>
    );
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
