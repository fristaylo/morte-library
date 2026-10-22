import {
    type ChangeEvent,
    type ClipboardEvent,
    memo,
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { uploadImage } from "../../api";
import {
    BulletListIcon,
    ImageIcon,
    LineIcon,
    LinkIcon,
    NumberedListIcon,
    QuoteIcon,
} from "../../icons";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import { toAvif } from "../../lib/toAvif";
import "./RichEditor.scss";

type ActiveState = Record<string, boolean>;

type ToolItem =
    | { kind: "sep"; key: string }
    | {
          kind: "btn";
          key: string;
          title: string;
          aria?: string;
          command: string;
          arg?: string;
          activeKey?: string;
          icon: ReactNode;
      };

const TOOLS: ToolItem[] = [
    {
        kind: "btn",
        key: "bold",
        title: "Жирный (Ctrl+B)",
        aria: "Жирный",
        command: "bold",
        activeKey: "bold",
        icon: <span style={{ fontWeight: 700 }}>B</span>,
    },
    {
        kind: "btn",
        key: "italic",
        title: "Курсив (Ctrl+I)",
        aria: "Курсив",
        command: "italic",
        activeKey: "italic",
        icon: <span style={{ fontStyle: "italic" }}>I</span>,
    },
    {
        kind: "btn",
        key: "strikeThrough",
        title: "Зачёркнутый",
        command: "strikeThrough",
        activeKey: "strikeThrough",
        icon: <span style={{ textDecoration: "line-through" }}>S</span>,
    },
    { kind: "sep", key: "sep-1" },
    {
        kind: "btn",
        key: "p",
        title: "Обычный текст",
        command: "formatBlock",
        arg: "p",
        icon: <span aria-hidden="true">¶</span>,
    },
    {
        kind: "btn",
        key: "h3",
        title: "Заголовок 2 уровня",
        command: "formatBlock",
        arg: "h3",
        icon: <span style={{ fontWeight: 700 }}>H2</span>,
    },
    {
        kind: "btn",
        key: "h4",
        title: "Заголовок 3 уровня",
        command: "formatBlock",
        arg: "h4",
        icon: <span style={{ fontWeight: 700 }}>H3</span>,
    },
    { kind: "sep", key: "sep-2" },
    {
        kind: "btn",
        key: "quote",
        title: "Цитата",
        command: "formatBlock",
        arg: "blockquote",
        icon: <QuoteIcon size={18} />,
    },
    {
        kind: "btn",
        key: "ul",
        title: "Маркированный список",
        command: "insertUnorderedList",
        activeKey: "insertUnorderedList",
        icon: <BulletListIcon size={18} />,
    },
    {
        kind: "btn",
        key: "ol",
        title: "Нумерованный список",
        command: "insertOrderedList",
        activeKey: "insertOrderedList",
        icon: <NumberedListIcon size={18} />,
    },
    {
        kind: "btn",
        key: "hr",
        title: "Разделительная линия",
        command: "insertHorizontalRule",
        icon: <LineIcon size={18} />,
    },
    { kind: "sep", key: "sep-3" },
    {
        kind: "btn",
        key: "link",
        title: "Ссылка",
        command: "link",
        icon: <LinkIcon size={18} />,
    },
];

const EMPTY_ACTIVE: ActiveState = {};
for (const t of TOOLS) {
    if (t.kind === "btn" && t.activeKey) EMPTY_ACTIVE[t.activeKey] = false;
}

function RichEditor({
    value,
    onChange,
    placeholder,
}: {
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
}) {
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [active, setActive] = useState<ActiveState>(EMPTY_ACTIVE);
    const editorRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const initialValueRef = useRef(value);

    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.innerHTML = sanitizeHtml(initialValueRef.current);
        }
        document.execCommand("defaultParagraphSeparator", false, "p");
    }, []);

    const readActive = useCallback((): ActiveState | null => {
        if (
            !editorRef.current?.contains(
                document.getSelection()?.anchorNode ?? null,
            )
        ) {
            return null;
        }
        const result: ActiveState = {};
        for (const key of Object.keys(EMPTY_ACTIVE)) {
            result[key] = document.queryCommandState(key);
        }
        return result;
    }, []);

    useEffect(() => {
        function handleSelectionChange() {
            setActive(readActive() ?? EMPTY_ACTIVE);
        }
        document.addEventListener("selectionchange", handleSelectionChange);
        return () =>
            document.removeEventListener(
                "selectionchange",
                handleSelectionChange,
            );
    }, [readActive]);

    function emitChange() {
        const el = editorRef.current;
        if (!el) return;
        const empty = !el.textContent?.trim() && !el.querySelector("img");
        onChange(empty ? "" : el.innerHTML);
    }

    function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
    }

    function handleKeyDown() {
        setTimeout(() => setActive(readActive() ?? EMPTY_ACTIVE), 0);
    }

    function run(command: string, value?: string) {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
        emitChange();
    }

    function insertLink() {
        const selection = document.getSelection();
        if (!selection || selection.isCollapsed) return;
        const url = window.prompt("Адрес ссылки", "https://");
        if (!url) return;
        run("createLink", url);
    }

    function handleToolClick(t: Extract<ToolItem, { kind: "btn" }>) {
        if (t.command === "link") {
            insertLink();
            return;
        }
        run(t.command, t.arg);
    }

    async function handleImagePick(e: ChangeEvent<HTMLInputElement>) {
        const input = e.target;
        const file = input.files?.[0];
        if (!file) return;
        setUploading(true);
        setUploadError(null);
        try {
            const packed = await toAvif(file, { maxW: 1920, maxH: 1920 });
            const url = await uploadImage(packed);
            editorRef.current?.focus();
            document.execCommand(
                "insertHTML",
                false,
                `<img src="${url}" alt="">`,
            );
            emitChange();
        } catch {
            setUploadError(
                "Не получилось загрузить картинку — попробуйте ещё раз.",
            );
        } finally {
            setUploading(false);
            input.value = "";
        }
    }

    const btnClass = (on: boolean) => (on ? "rte-btn rte-btn--on" : "rte-btn");

    return (
        <div className="rte-editor">
            <div className="rte-toolbar">
                {TOOLS.map((t) =>
                    t.kind === "sep" ? (
                        <span
                            key={t.key}
                            className="rte-sep"
                            aria-hidden="true"
                        />
                    ) : (
                        <button
                            key={t.key}
                            type="button"
                            className={btnClass(
                                t.activeKey ? active[t.activeKey] : false,
                            )}
                            title={t.title}
                            aria-label={t.aria ?? t.title}
                            aria-pressed={
                                t.activeKey ? active[t.activeKey] : undefined
                            }
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleToolClick(t)}
                        >
                            {t.icon}
                        </button>
                    ),
                )}
                <button
                    type="button"
                    className="rte-btn"
                    title="Картинка"
                    aria-label="Картинка"
                    disabled={uploading}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => fileRef.current?.click()}
                >
                    {uploading ? (
                        <span className="rte-spin" aria-hidden="true" />
                    ) : (
                        <ImageIcon size={18} />
                    )}
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleImagePick}
                />
            </div>
            <div
                ref={editorRef}
                className="rte-input review-rich"
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                tabIndex={0}
                aria-multiline="true"
                aria-label="Текст отзыва"
                onInput={emitChange}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                data-placeholder={placeholder}
            />
            {uploadError && <p className="rte-error">{uploadError}</p>}
        </div>
    );
}

export default memo(RichEditor);
