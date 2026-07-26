import { type FormEvent, memo, useRef, useState } from "react";
import {
    type Book,
    coverUrl,
    createBook,
    deleteBook,
    spineImageUrl,
    updateBook,
} from "../../api/api";
import Dialog from "../../components/Dialogs/Dialog";
import "../ReviewPage/ReviewPage.scss";
import "./AddPage.scss";

const STARS = Array.from({ length: 10 }, (_, i) => i + 1);

const EMPTY = {
    title: "",
    author: "",
    rating: "0",
    pages: "",
    dateRead: "",
    synopsis: "",
    review: "",
};

async function shrinkImage(file: File, maxWidth: number): Promise<File> {
    const url = URL.createObjectURL(file);
    const img = new Image();
    try {
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("bad image"));
            img.src = url;
        });
    } catch {
        URL.revokeObjectURL(url);
        return file;
    }
    URL.revokeObjectURL(url);
    if (!img.naturalWidth || !img.naturalHeight) return file;
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === "image/webp" ? "webp" : "png";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${ext}`, {
        type: blob.type,
    });
}

function analyzeSpine(file: File): Promise<{ color: string; ratio: number }> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            const stripH = Math.max(1, Math.round(h * 0.12));
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = stripH;
            const ctx = canvas.getContext("2d");
            URL.revokeObjectURL(url);
            if (!ctx || !w || !h) {
                reject(new Error("no canvas"));
                return;
            }
            ctx.drawImage(img, 0, 0);
            const { data } = ctx.getImageData(0, 0, w, stripH);
            let r = 0;
            let g = 0;
            let b = 0;
            const n = data.length / 4;
            for (let i = 0; i < data.length; i += 4) {
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
            }
            const hex = (v: number) =>
                Math.round(v / n)
                    .toString(16)
                    .padStart(2, "0");
            resolve({ color: `#${hex(r)}${hex(g)}${hex(b)}`, ratio: h / w });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("bad image"));
        };
        img.src = url;
    });
}

function AddPage({
    book,
    onSaved,
}: {
    book?: Book;
    onSaved: () => Promise<void>;
}) {
    const [fields, setFields] = useState(() =>
        book
            ? {
                  title: book.title,
                  author: book.author,
                  rating: String(book.rating),
                  pages: book.pages === null ? "" : String(book.pages),
                  dateRead: book.dateRead ?? "",
                  synopsis: book.synopsis ?? "",
                  review: book.review ?? "",
              }
            : EMPTY,
    );
    const [cover, setCover] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(
        book?.hasCover ? coverUrl(book) : null,
    );
    const [spine, setSpine] = useState<File | null>(null);
    const [spinePreview, setSpinePreview] = useState<string | null>(
        book?.hasSpineImage ? spineImageUrl(book) : null,
    );
    const [spineMeta, setSpineMeta] = useState<{
        color: string;
        ratio: number;
    } | null>(null);
    const [hover, setHover] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const spineRef = useRef<HTMLInputElement>(null);

    const set = (key: keyof typeof EMPTY) => (value: string) =>
        setFields((f) => ({ ...f, [key]: value }));

    const rating = Number(fields.rating) || 0;

    async function pickCover(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const packed = await shrinkImage(file, 600);
        setCover(packed);
        setCoverPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(packed);
        });
    }

    async function pickSpine(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const packed = await shrinkImage(file, 256);
        setSpine(packed);
        setSpinePreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(packed);
        });
        try {
            setSpineMeta(await analyzeSpine(packed));
        } catch {
            setSpineMeta(null);
        }
    }

    async function remove() {
        if (!book) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            await deleteBook(book.slug);
            await onSaved();
            window.location.hash = "#/";
        } catch {
            setDeleteError("Не удалось удалить книгу — попробуйте позже.");
            setDeleting(false);
        }
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
        if (spine) data.set("spine", spine);
        if (spineMeta) {
            data.set("spineColor", spineMeta.color);
            data.set("spineRatio", String(spineMeta.ratio));
        }
        try {
            if (book) {
                await updateBook(book.slug, data);
            } else {
                await createBook(data);
            }
            await onSaved();
            window.location.hash = book ? `#/book/${book.slug}` : "#/";
        } catch {
            setError(
                book
                    ? "Не удалось сохранить правки — попробуйте позже."
                    : "Не удалось поставить книгу на полку — попробуйте позже.",
            );
            setSaving(false);
        }
    }

    return (
        <main className="review-page">
            <form className="review-card add-card" onSubmit={submit}>
                <div className="review-hero">
                    <div className="review-cover-wrap add-media">
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

                        <button
                            type="button"
                            className="add-spine"
                            onClick={() => spineRef.current?.click()}
                            style={
                                spineMeta
                                    ? { borderColor: spineMeta.color }
                                    : undefined
                            }
                        >
                            {spinePreview ? (
                                <img
                                    src={spinePreview}
                                    alt=""
                                    className="add-spine-thumb"
                                />
                            ) : (
                                <span className="add-cover-plus" aria-hidden="true">
                                    +
                                </span>
                            )}
                        </button>
                        <input
                            ref={spineRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={pickSpine}
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
                            <div
                                className="review-chip add-stars"
                                onMouseLeave={() => setHover(0)}
                            >
                                {STARS.map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        className={
                                            n <= (hover || rating)
                                                ? "add-star add-star--on"
                                                : "add-star"
                                        }
                                        onMouseEnter={() => setHover(n)}
                                        onClick={() =>
                                            set("rating")(
                                                String(rating === n ? 0 : n),
                                            )
                                        }
                                        aria-label={`Оценка ${n} из 10`}
                                        aria-pressed={n <= rating}
                                    >
                                        ★
                                    </button>
                                ))}
                                <span className="add-stars-value">
                                    {hover || rating}/10
                                </span>
                            </div>
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

                <div className="add-actions">
                    {book && (
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => {
                                setDeleteError(null);
                                setConfirmDelete(true);
                            }}
                        >
                            Удалить
                        </button>
                    )}
                    <button
                        type="submit"
                        className="btn btn-dark"
                        disabled={saving}
                    >
                        {book
                            ? saving
                                ? "Сохраняем…"
                                : "Сохранить правки"
                            : saving
                              ? "Ставим на полку…"
                              : "Положить в шкаф"}
                    </button>
                </div>
            </form>

            {book && (
                <Dialog
                    open={confirmDelete}
                    onClose={() => setConfirmDelete(false)}
                    title="Удалить книгу?"
                >
                    <p className="add-confirm-text">
                        «{book.title}» исчезнет с полки вместе с отзывом,
                        обложкой и корешком. Отменить это будет нельзя.
                    </p>
                    {deleteError && <p className="add-error">{deleteError}</p>}
                    <div className="add-confirm-actions">
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setConfirmDelete(false)}
                            disabled={deleting}
                        >
                            Оставить
                        </button>
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={remove}
                            disabled={deleting}
                        >
                            {deleting ? "Удаляем…" : "Удалить навсегда"}
                        </button>
                    </div>
                </Dialog>
            )}
        </main>
    );
}

export default memo(AddPage);
