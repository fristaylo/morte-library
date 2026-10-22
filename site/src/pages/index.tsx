import { useRevalidator } from "react-router";
import Bookcase from "../components/Bookcase/Bookcase";
import { useLibrary, useRandomBook } from "../hooks/useLibrary";
import "./index.scss";

export default function HomePage() {
    const { books, categories } = useLibrary();
    const onRandom = useRandomBook();
    const { revalidate } = useRevalidator();

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
                        disabled={!onRandom}
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
                <Bookcase
                    books={books}
                    categories={categories}
                    onChanged={revalidate}
                />
            </section>
        </main>
    );
}
