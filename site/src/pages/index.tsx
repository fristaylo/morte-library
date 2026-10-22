import type { Book, Category } from "../api";
import Bookcase from "../components/Bookcase/Bookcase";
import "./index.scss";

export default function HomePage({
    books,
    categories,
    error,
    onRandom,
    onChanged,
}: {
    books: Book[];
    categories: Category[];
    error: boolean;
    onRandom: () => void;
    onChanged: () => Promise<void> | void;
}) {
    return (
        <main>
            <section className="hero">
                <h1 className="hero-title">Библиотека Морте</h1>
                <div className="hero-actions">
                    <button
                        type="button"
                        className="btn btn-dark"
                        onClick={() =>
                            document.getElementById("shelf")?.scrollIntoView()
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
                        onClick={onRandom}
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
                        Не получилось достать книги с полки — загляните позже.
                    </p>
                ) : (
                    <Bookcase
                        books={books}
                        categories={categories}
                        onChanged={onChanged}
                    />
                )}
            </section>
        </main>
    );
}
