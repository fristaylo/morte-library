import { Link, useMatch } from "react-router";
import { useLibrary, useRandomBook } from "../../hooks/useLibrary";
import { LogoIcon } from "../../icons";
import TimeDial from "../TimeDial/TimeDial";
import "./Header.scss";

export default function Header() {
    const { books } = useLibrary();
    const onRandom = useRandomBook();
    const isHome = useMatch("/");
    const editMatch = useMatch("/book/:slug/edit");

    return (
        <header className="topbar">
            <Link className="topbar-brand" to="/">
                <LogoIcon size={40} />
                <span>Библиотека Морте</span>
            </Link>
            <div className="topbar-actions">
                <TimeDial />
                {onRandom && (
                    <button
                        type="button"
                        className="topbar-chip"
                        onClick={onRandom}
                    >
                        Случайное
                    </button>
                )}
                {isHome ? (
                    books.length > 0 && (
                        <span className="topbar-chip">
                            {books.length}{" "}
                            {plural(books.length, ["книга", "книги", "книг"])}
                        </span>
                    )
                ) : editMatch ? (
                    <Link
                        className="topbar-chip"
                        to={`/book/${editMatch.params.slug}`}
                    >
                        ← к отзыву
                    </Link>
                ) : (
                    <Link className="topbar-chip" to="/">
                        ← в шкаф
                    </Link>
                )}
            </div>
        </header>
    );
}

function plural(n: number, [one, few, many]: [string, string, string]) {
    const d10 = n % 10;
    const d100 = n % 100;
    if (d10 === 1 && d100 !== 11) return one;
    if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return few;
    return many;
}
