import {
    type ReactNode,
    StrictMode,
    useCallback,
    useEffect,
    useState,
} from "react";
import { createRoot } from "react-dom/client";
import { type Book, fetchBooks } from "./api/api";
import Bookcase from "./components/Bookcase/Bookcase";
import "./main.scss";
import AddPage from "./pages/AddPage/AddPage";
import ReviewPage from "./pages/ReviewPage/ReviewPage";

let shelfScroll = 0;

const isShelf = (hash: string) => hash === "" || hash === "#/";

function useHash() {
    const [hash, setHash] = useState(window.location.hash);
    useEffect(() => {
        const onChange = () => {
            if (!isShelf(window.location.hash)) {
                shelfScroll = window.scrollY;
            }
            setHash(window.location.hash);
        };
        window.addEventListener("hashchange", onChange);
        return () => window.removeEventListener("hashchange", onChange);
    }, []);
    return hash;
}

function plural(n: number, [one, few, many]: [string, string, string]) {
    const d10 = n % 10;
    const d100 = n % 100;
    if (d10 === 1 && d100 !== 11) return one;
    if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return few;
    return many;
}

function SiteHeader({ right }: { right?: ReactNode }) {
    return (
        <header className="topbar">
            <a className="topbar-brand" href="#/">
                <svg
                    width="26"
                    height="26"
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
            {right}
        </header>
    );
}

function App() {
    const hash = useHash();
    const [books, setBooks] = useState<Book[]>([]);
    const [error, setError] = useState(false);

    const reload = useCallback(
        () => fetchBooks().then(setBooks, () => setError(true)),
        [],
    );

    useEffect(() => {
        reload();
    }, [reload]);

    const slug = hash.match(/^#\/book\/(.+)$/)?.[1];
    const book = slug
        ? books.find((b) => b.slug === decodeURIComponent(slug))
        : undefined;

    useEffect(() => {
        window.scrollTo({
            top: isShelf(hash) ? shelfScroll : 0,
            behavior: "instant",
        });
    }, [hash]);

    if (hash === "#/add") {
        return (
            <>
                <SiteHeader
                    right={
                        <a className="topbar-chip" href="#/">
                            ← в шкаф
                        </a>
                    }
                />
                <AddPage onAdded={reload} />
            </>
        );
    }

    if (book) {
        return (
            <>
                <SiteHeader
                    right={
                        <a className="topbar-chip" href="#/">
                            ← в шкаф
                        </a>
                    }
                />
                <ReviewPage book={book} />
            </>
        );
    }

    return (
        <>
            <SiteHeader
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
                    <p className="hero-eyebrow">книжная полка среди облаков</p>
                    <h1 className="hero-title">Библиотека Морте</h1>
                    <p className="hero-sub">
                        Всё прочитанное стоит здесь, на белых полках между
                        горами и туманом, — и под каждой обложкой спрятан
                        честный отзыв.
                    </p>
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
                            onClick={() => {
                                const pick =
                                    books[
                                        Math.floor(Math.random() * books.length)
                                    ];
                                window.location.hash = `#/book/${pick.slug}`;
                            }}
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
                        <Bookcase books={books} />
                    )}
                </section>
            </main>
            <footer className="site-foot">
                Библиотека Морте · среди гор и туманов
            </footer>
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
