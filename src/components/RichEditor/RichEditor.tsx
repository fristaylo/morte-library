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
import { uploadImage } from "../../api/api";
import { toAvif } from "../../api/toAvif";
import { sanitizeHtml } from "../../html";
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

const ICON_PROPS = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
} as const;

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
        icon: (
            <svg {...ICON_PROPS} aria-hidden="true">
                <path d="M7 7h4v4c0 2.2-1.8 4-4 4" />
                <path d="M15 7h4v4c0 2.2-1.8 4-4 4" />
            </svg>
        ),
    },
    {
        kind: "btn",
        key: "ul",
        title: "Маркированный список",
        command: "insertUnorderedList",
        activeKey: "insertUnorderedList",
        icon: (
            <svg {...ICON_PROPS} aria-hidden="true">
                <circle
                    cx="5"
                    cy="7"
                    r="1.2"
                    fill="currentColor"
                    stroke="none"
                />
                <circle
                    cx="5"
                    cy="12"
                    r="1.2"
                    fill="currentColor"
                    stroke="none"
                />
                <circle
                    cx="5"
                    cy="17"
                    r="1.2"
                    fill="currentColor"
                    stroke="none"
                />
                <line x1="9" y1="7" x2="19" y2="7" />
                <line x1="9" y1="12" x2="19" y2="12" />
                <line x1="9" y1="17" x2="19" y2="17" />
            </svg>
        ),
    },
    {
        kind: "btn",
        key: "ol",
        title: "Нумерованный список",
        command: "insertOrderedList",
        activeKey: "insertOrderedList",
        icon: (
            <svg {...ICON_PROPS} aria-hidden="true">
                <line x1="10" y1="6" x2="20" y2="6" />
                <line x1="10" y1="12" x2="20" y2="12" />
                <line x1="10" y1="18" x2="20" y2="18" />
                <text
                    x="3"
                    y="8.5"
                    fontSize="7"
                    stroke="none"
                    fill="currentColor"
                >
                    1
                </text>
                <text
                    x="3"
                    y="14.5"
                    fontSize="7"
                    stroke="none"
                    fill="currentColor"
                >
                    2
                </text>
                <text
                    x="3"
                    y="20.5"
                    fontSize="7"
                    stroke="none"
                    fill="currentColor"
                >
                    3
                </text>
            </svg>
        ),
    },
    {
        kind: "btn",
        key: "hr",
        title: "Разделительная линия",
        command: "insertHorizontalRule",
        icon: (
            <svg {...ICON_PROPS} aria-hidden="true">
                <line x1="4" y1="12" x2="20" y2="12" />
            </svg>
        ),
    },
    { kind: "sep", key: "sep-3" },
    {
        kind: "btn",
        key: "link",
        title: "Ссылка",
        command: "link",
        icon: (
            <svg {...ICON_PROPS} aria-hidden="true">
                <path d="M9 15l6-6" />
                <path d="M10 6l1-1a4 4 0 015.5 5.5l-1.5 1.5" />
                <path d="M14 18l-1 1a4 4 0 01-5.5-5.5l1.5-1.5" />
            </svg>
        ),
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
                        <svg {...ICON_PROPS} aria-hidden="true">
                            <rect x="3" y="4" width="18" height="16" rx="2" />
                            <circle
                                cx="8.5"
                                cy="9.5"
                                r="1.5"
                                fill="currentColor"
                                stroke="none"
                            />
                            <path d="M21 16l-5.5-5.5a2 2 0 00-2.8 0L4 19" />
                        </svg>
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
