import { useState } from "react";
import type { Book } from "../../api/api";
import { coverUrl, formatDateRead } from "../../api/api";
import LoginDialog from "../../components/Dialogs/LoginDialog/LoginDialog";
import { useAuth } from "../../hooks/useAuth";
import "./ReviewPage.scss";

export default function ReviewPage({ book }: { book: Book }) {
    const dateRead = formatDateRead(book);
    const coverWidth = book.widthPx ?? 200;
    const rating = Math.min(10, Math.max(0, Math.round(book.rating)));
    const { authorized } = useAuth();
    const [loginOpen, setLoginOpen] = useState(false);

    const openEdit = () => {
        window.location.hash = `#/book/${book.slug}/edit`;
    };

    return (
        <main className="review-page">
            <LoginDialog
                open={loginOpen}
                onClose={() => setLoginOpen(false)}
                onSuccess={() => {
                    setLoginOpen(false);
                    openEdit();
                }}
            />
            <article className="review-card">
                <button
                    type="button"
                    className="review-edit"
                    aria-label="Редактировать книгу"
                    onClick={() =>
                        authorized ? openEdit() : setLoginOpen(true)
                    }
                >
                    <svg
                        width="22"
                        height="22"
                        viewBox="0 0 64 64"
                        aria-hidden="true"
                    >
                        <path
                            d="M59.5 7c-.16-.09-11.93-6.6-27.01-.41-.39.84-.67 1.69-.87 2.5-.83 3.36-.32 6.2-.31 6.24.222 1.305-1.69 1.661-1.96.38-.03-.15-.46-2.44-.01-5.44.12-.8.3-1.64.57-2.51-4.23 2.1-8.68 5.25-13.17 9.82-.15.16-.25.36-.28.58l-1.06 8.66c-.65-.97-1.32-2.3-1.46-3.82-.046-.819-1.14-1.215-1.7-.62-.11.1-10.11 10.28-4.28 23.89.41-.76.83-1.5 1.28-2.24 9.34-15.39 27.81-27.19 28.83-27.82 1.103-.694 2.162.965 1.07 1.69-1.34.42-27.696 19.15-31.99 35.41-.61 2.02-1.02 4.07-1.16 6.14a1 1 0 0 0 1 1.07c.52 0 .96-.41.99-.93.27-3.96 1.6-7.89 3.58-11.65 3.729.647 8.303.712 12.21-.88.861-.333.797-1.664-.11-1.89-.03-.01-2.48-.73-3.51-2.5 2.135.762 6.38 1.476 10.64-.52l11.12-9.02c.35-.28.47-.77.28-1.18-.19-.42-.63-.65-1.07-.58-.03 0-2.33.35-4.63-1.37 2.4-.04 5.98-.37 8.24-1.75 2.3-1.4 6.92-6.25 10.57-11.45-1.856.41-7.473-.116-7.7-.3-1.288-.262-.883-2.2.39-1.96.05.01 3.08.59 6.19.36.91-.07 1.83-.21 2.68-.46 1.37-2.18 2.48-4.35 3.09-6.27A.99.99 0 0 0 59.5 7"
                            fill="currentColor"
                        />
                    </svg>
                </button>
                <div className="review-hero">
                    <div className="review-cover-wrap">
                        {book.hasCover ? (
                            <img
                                className="review-cover"
                                src={coverUrl(book)}
                                alt=""
                                style={{ width: coverWidth }}
                            />
                        ) : (
                            <div
                                className="review-cover review-cover--drawn"
                                style={{
                                    width: coverWidth,
                                    background: book.spineColor,
                                    color: book.spineTextColor,
                                }}
                            >
                                <span>{book.title}</span>
                            </div>
                        )}
                    </div>

                    <div className="review-info">
                        <h1 className="review-title">{book.title}</h1>
                        <p className="review-author">{book.author}</p>
                        <div className="review-meta">
                            <span
                                className="review-chip review-stars"
                                role="img"
                                aria-label={`оценка: ${rating} из 10`}
                            >
                                <span
                                    className="review-stars-filled"
                                    aria-hidden="true"
                                >
                                    {"★".repeat(rating)}
                                </span>
                                <span aria-hidden="true">
                                    {"★".repeat(10 - rating)}
                                </span>
                            </span>
                            {book.pages !== null && (
                                <span className="review-chip">
                                    {book.pages} стр.
                                </span>
                            )}
                            {dateRead && (
                                <span className="review-chip">{dateRead}</span>
                            )}
                        </div>
                    </div>
                </div>

                {book.synopsis && (
                    <section className="review-synopsis">
                        <h2>О книге</h2>
                        <p>{book.synopsis}</p>
                    </section>
                )}

                {book.review && (
                    <section className="review-body">
                        <h2>Мой отзыв</h2>
                        {book.review.split("\n\n").map((paragraph, i) => (
                            // статичный текст, порядок не меняется
                            // biome-ignore lint/suspicious/noArrayIndexKey: см. выше
                            <p key={i}>{paragraph}</p>
                        ))}
                    </section>
                )}
            </article>

            <a className="review-back" href="#/">
                ← вернуться к шкафу
            </a>
        </main>
    );
}
