import {
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
} from "./api";
import Background from "./components/Background/Background";
import Header from "./components/Header/Header";
import TimeDial from "./components/TimeDial/TimeDial";
import "./main.scss";
import { linkProps, navigate, savedScroll, usePath } from "./lib/router";
import HomePage from "./pages";
import AddPage from "./pages/add";
import ReviewPage from "./pages/review";

const HOUR_KEY = "morte:hour";

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

    const isForm = path === "/add" || (editing && book);
    const right = isForm ? (
        <a
            className="topbar-chip"
            {...linkProps(book ? `/book/${book.slug}` : "/")}
        >
            ← {book ? "к отзыву" : "в шкаф"}
        </a>
    ) : book ? (
        <a className="topbar-chip" {...linkProps("/")}>
            ← в шкаф
        </a>
    ) : books.length > 0 ? (
        <span className="topbar-chip">
            {books.length} {plural(books.length, ["книга", "книги", "книг"])}
        </span>
    ) : undefined;

    return (
        <>
            <Background hour={hour} drift={dialOpen} />
            <Header clock={clock} onRandom={onRandom} right={right} />
            {isForm ? (
                editing && !detail ? (
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
                )
            ) : book ? (
                <ReviewPage book={book} detail={detail} />
            ) : (
                <HomePage
                    books={books}
                    categories={categories}
                    error={error}
                    onRandom={goRandom}
                    onChanged={reload}
                />
            )}
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

function nowHour() {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
}

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
