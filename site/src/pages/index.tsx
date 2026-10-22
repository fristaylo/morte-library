import { lazy, Suspense } from "react";
import { useRevalidator } from "react-router";
import RibbonTitle from "../components/RibbonTitle/RibbonTitle";
import { useLibrary, useRandomBook } from "../hooks/useLibrary";
import { LogoIcon } from "../icons";
import "./index.scss";

const Bookcase = lazy(() => import("../components/Bookcase/Bookcase"));

export default function HomePage() {
    const { books, categories } = useLibrary();
    const onRandom = useRandomBook();
    const { revalidate } = useRevalidator();

    return (
        <main>
            <section className="hero" data-scene-follow>
                <LogoIcon className="hero-logo" size={128} />
                <RibbonTitle />
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
                <Suspense fallback={null}>
                    <Bookcase
                        books={books}
                        categories={categories}
                        onChanged={revalidate}
                    />
                </Suspense>
            </section>
        </main>
    );
}
