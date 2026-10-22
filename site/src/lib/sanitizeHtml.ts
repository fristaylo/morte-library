const ALLOWED_TAGS = new Set([
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "del",
    "strike",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "blockquote",
    "a",
    "img",
    "code",
    "hr",
]);

const REMOVE_ENTIRELY = new Set([
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "svg",
]);

const BLOCK_TAGS = new Set(["p", "h3", "h4", "ul", "ol", "blockquote", "hr"]);

function isSafeUrl(url: string): boolean {
    const trimmed = url.trim();
    return (
        trimmed.startsWith("/") ||
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://")
    );
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function sanitizePlainText(input: string): string {
    if (!input.trim()) {
        return "";
    }
    return input
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
        .join("");
}

function sanitizeChildren(parent: Node): void {
    for (const node of [...parent.childNodes]) {
        if (node.nodeType !== Node.ELEMENT_NODE) {
            continue;
        }
        const el = node as Element;
        const tag = el.tagName.toLowerCase();

        if (REMOVE_ENTIRELY.has(tag)) {
            el.remove();
            continue;
        }

        if (!ALLOWED_TAGS.has(tag)) {
            sanitizeChildren(el);
            el.replaceWith(...el.childNodes);
            continue;
        }

        if (tag === "a") {
            const href = el.getAttribute("href");
            if (!href || !isSafeUrl(href)) {
                sanitizeChildren(el);
                el.replaceWith(...el.childNodes);
                continue;
            }
        }

        if (tag === "img") {
            const src = el.getAttribute("src");
            if (!src || !isSafeUrl(src)) {
                el.remove();
                continue;
            }
        }

        const href = tag === "a" ? el.getAttribute("href") : null;
        const src = tag === "img" ? el.getAttribute("src") : null;
        const alt = tag === "img" ? el.getAttribute("alt") : null;

        for (const name of [...el.attributes].map((a) => a.name)) {
            el.removeAttribute(name);
        }

        if (tag === "a" && href) {
            el.setAttribute("href", href);
            el.setAttribute("target", "_blank");
            el.setAttribute("rel", "noreferrer");
        }
        if (tag === "img" && src) {
            el.setAttribute("src", src);
            if (alt) {
                el.setAttribute("alt", alt);
            }
        }

        sanitizeChildren(el);
    }
}

function wrapLooseTopLevelNodes(root: Element): void {
    const doc = root.ownerDocument;
    const children = [...root.childNodes];
    let group: Node[] = [];

    const flushGroup = (before: Node | null) => {
        const hasContent = group.some(
            (n) =>
                n.nodeType !== Node.TEXT_NODE ||
                (n.textContent ?? "").trim() !== "",
        );
        if (hasContent) {
            const p = doc.createElement("p");
            for (const n of group) {
                p.appendChild(n);
            }
            root.insertBefore(p, before);
        }
        group = [];
    };

    for (const node of children) {
        const isBlock =
            node.nodeType === Node.ELEMENT_NODE &&
            BLOCK_TAGS.has((node as Element).tagName.toLowerCase());
        if (isBlock) {
            flushGroup(node);
        } else {
            group.push(node);
        }
    }
    flushGroup(null);
}

export function sanitizeHtml(input: string): string {
    if (!/<[a-z!/]|&[a-z#]\w*;/i.test(input)) {
        return sanitizePlainText(input);
    }
    const doc = new DOMParser().parseFromString(input, "text/html");
    sanitizeChildren(doc.body);
    wrapLooseTopLevelNodes(doc.body);
    return doc.body.innerHTML;
}
