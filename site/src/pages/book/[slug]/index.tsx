import { useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import type { Book } from "../../../api";
import { coverUrl } from "../../../api";
import LoginDialog from "../../../components/Dialogs/LoginDialog/LoginDialog";
import { useAuth } from "../../../hooks/useAuth";
import { EditIcon } from "../../../icons";
import { sanitizeHtml } from "../../../lib/sanitizeHtml";
import type loader from "./loader";
import "./index.scss";

export default function ReviewPage() {
    const book = useLoaderData<typeof loader>();
    const navigate = useNavigate();
    const dateRead = formatDateRead(book);
    const coverWidth = book.widthPx ?? 200;
    const rating = Math.min(10, Math.max(0, Math.round(book.rating)));
    const { authorized } = useAuth();
    const [loginOpen, setLoginOpen] = useState(false);

    const openEdit = () => {
        navigate(`/book/${book.slug}/edit`);
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
                    <EditIcon size={22} />
                </button>
                <div className="review-hero">
                    <div className="review-cover-wrap">
                        {book.hasCover ? (
                            <img
                                className="review-cover"
                                src={coverUrl(book)}
                                alt=""
                                decoding="async"
                                fetchPriority="high"
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
                        <div
                            className="review-rich"
                            // biome-ignore lint/security/noDangerouslySetInnerHtml: отзыв чистится sanitizeHtml
                            dangerouslySetInnerHTML={{
                                __html: sanitizeHtml(book.review),
                            }}
                        />
                    </section>
                )}
            </article>

            <Link className="review-back" to="/">
                ← вернуться к шкафу
            </Link>
        </main>
    );
}

function formatDateRead(book: Book): string | null {
    if (!book.dateRead) return null;
    const d = new Date(book.dateRead);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("ru", {
        month: "long",
        year: "numeric",
    }).format(d);
}
