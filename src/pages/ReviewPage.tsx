import type { Book } from "../api";
import { coverUrl, formatDateRead } from "../api";
import "./ReviewPage.scss";

export default function ReviewPage({ book }: { book: Book }) {
    const dateRead = formatDateRead(book);
    const coverWidth = book.widthPx ?? 200;
    const rating = Math.min(10, Math.max(0, Math.round(book.rating)));

    return (
        <main className="review-page">
            <article className="review-card">
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
