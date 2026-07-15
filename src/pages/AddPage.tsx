import { type FormEvent, useRef, useState } from "react";
import { createBook } from "../api";
import "./ReviewPage.scss";
import "./AddPage.scss";

const EMPTY = {
    title: "",
    author: "",
    rating: "",
    pages: "",
    dateRead: "",
    synopsis: "",
    review: "",
};

export default function AddPage({ onAdded }: { onAdded: () => Promise<void> }) {
    const [fields, setFields] = useState(EMPTY);
    const [cover, setCover] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const set = (key: keyof typeof EMPTY) => (value: string) =>
        setFields((f) => ({ ...f, [key]: value }));

    function pickCover(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setCover(file);
        setCoverPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
        });
    }

    async function submit(e: FormEvent) {
        e.preventDefault();
        if (!fields.title.trim() || !fields.author.trim()) {
            setError("Впишите хотя бы название и автора.");
            return;
        }
        setSaving(true);
        setError(null);
        const data = new FormData();
        for (const [key, value] of Object.entries(fields)) data.set(key, value);
        if (cover) data.set("cover", cover);
        try {
            await createBook(data);
            await onAdded();
            window.location.hash = "#/";
        } catch {
            setError("Не удалось поставить книгу на полку — попробуйте позже.");
            setSaving(false);
        }
    }

    return (
        <main className="review-page">
            <form className="review-card add-card" onSubmit={submit}>
                <div className="review-hero">
                    <div className="review-cover-wrap">
                        <button
                            type="button"
                            className="review-cover add-cover"
                            style={
                                coverPreview
                                    ? {
                                          backgroundImage: `url(${coverPreview})`,
                                      }
                                    : undefined
                            }
                            onClick={() => fileRef.current?.click()}
                            aria-label="Загрузить обложку"
                        >
                            {!coverPreview && (
                                <span
                                    className="add-cover-plus"
                                    aria-hidden="true"
                                >
                                    +
                                </span>
                            )}
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={pickCover}
                        />
                    </div>

                    <div className="review-info">
                        <input
                            className="review-title add-input"
                            placeholder="Название книги"
                            value={fields.title}
                            onChange={(e) => set("title")(e.target.value)}
                        />
                        <input
                            className="review-author add-input"
                            placeholder="Автор"
                            value={fields.author}
                            onChange={(e) => set("author")(e.target.value)}
                        />
                        <div className="review-meta">
                            <label className="review-chip add-chip">
                                <input
                                    type="number"
                                    min="0"
                                    max="5"
                                    placeholder="Оценка 0–5"
                                    value={fields.rating}
                                    onChange={(e) =>
                                        set("rating")(e.target.value)
                                    }
                                />
                            </label>
                            <label className="review-chip add-chip">
                                <input
                                    type="number"
                                    min="1"
                                    placeholder="Страниц"
                                    value={fields.pages}
                                    onChange={(e) =>
                                        set("pages")(e.target.value)
                                    }
                                />
                            </label>
                            <label className="review-chip add-chip">
                                <input
                                    type="date"
                                    value={fields.dateRead}
                                    onChange={(e) =>
                                        set("dateRead")(e.target.value)
                                    }
                                />
                            </label>
                        </div>
                    </div>
                </div>

                <section className="review-synopsis add-section">
                    <h2>О книге</h2>
                    <textarea
                        placeholder="Короткое описание книги…"
                        value={fields.synopsis}
                        onChange={(e) => set("synopsis")(e.target.value)}
                    />
                </section>

                <section className="review-body add-section">
                    <h2>Мой отзыв</h2>
                    <textarea
                        placeholder="Что вы думаете об этой книге…"
                        value={fields.review}
                        onChange={(e) => set("review")(e.target.value)}
                    />
                </section>

                {error && <p className="add-error">{error}</p>}

                <button
                    type="submit"
                    className="btn btn-dark add-submit"
                    disabled={saving}
                >
                    {saving ? "Ставим на полку…" : "Положить в шкаф"}
                </button>
            </form>
        </main>
    );
}
