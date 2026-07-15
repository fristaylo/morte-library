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

export default function AddPage({ onAdded }: { onAdded: () => Promise<void> }) {
    const [fields, setFields] = useState(EMPTY);
    const [cover, setCover] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [spine, setSpine] = useState<File | null>(null);
    const [spinePreview, setSpinePreview] = useState<string | null>(null);
    const [spineMeta, setSpineMeta] = useState<{
        color: string;
        ratio: number;
    } | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const spineRef = useRef<HTMLInputElement>(null);

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

    async function pickSpine(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setSpine(file);
        setSpinePreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
        });
        try {
            setSpineMeta(await analyzeSpine(file));
        } catch {
            setSpineMeta(null);
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
