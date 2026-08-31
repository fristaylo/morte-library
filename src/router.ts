import { type MouseEvent, useEffect, useState } from "react";

let shelfScroll = 0;

export function navigate(path: string) {
    if (path === window.location.pathname) return;
    if (window.location.pathname === "/") shelfScroll = window.scrollY;
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
}

export function savedScroll(path: string) {
    return path === "/" ? shelfScroll : 0;
}

export function usePath() {
    const [path, setPath] = useState(window.location.pathname);
    useEffect(() => {
        const onPop = () => setPath(window.location.pathname);
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);
    return path;
}

export function linkProps(path: string) {
    return {
        href: path,
        onClick: (e: MouseEvent<HTMLAnchorElement>) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            navigate(path);
        },
    };
}
