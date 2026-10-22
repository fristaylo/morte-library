import { type ComponentType, useEffect, useLayoutEffect, useRef } from "react";
import { type LoaderFunction, Outlet, Route, useLocation } from "react-router";
import ErrorElement, { NotFound } from "./components/ErrorElement/ErrorElement";
import Header from "./components/Header/Header";
import { rootLoader } from "./hooks/useLibrary";
import HomePage from "./pages/index";

const pages = import.meta.glob<{ default: ComponentType }>([
    "./pages/**/index.tsx",
    "!./pages/index.tsx",
]);
const loaders = import.meta.glob<{ default: LoaderFunction }>(
    "./pages/**/loader.ts",
);

const pageError = (
    <ErrorElement message="Не получилось открыть книгу — попробуйте позже." />
);

const pageRoutes = Object.entries(pages).map(([file, loadPage]) => {
    const dir = file.slice("./pages".length, -"/index.tsx".length);
    const path = dir.replace(/\[(.+?)\]/g, ":$1").slice(1);
    const loadLoader = loaders[`./pages${dir}/loader.ts`];
    return (
        <Route
            key={file}
            path={path}
            lazy={async () => {
                const [page, loader] = await Promise.all([
                    loadPage(),
                    loadLoader?.(),
                ]);
                return { Component: page.default, loader: loader?.default };
            }}
            errorElement={pageError}
        />
    );
});

export const DefaultRoutes = (
    <Route
        id="root"
        element={<Layout />}
        loader={rootLoader}
        errorElement={<RootError />}
        HydrateFallback={Header}
    >
        <Route index element={<HomePage />} errorElement={pageError} />
        {pageRoutes}
        <Route path="*" element={<NotFound />} />
    </Route>
);

function Layout() {
    return (
        <>
            <Header />
            <Outlet />
            <ScrollRestore />
        </>
    );
}

function RootError() {
    return (
        <>
            <Header />
            <ErrorElement message="Не получилось достать книги с полки — загляните позже." />
        </>
    );
}

function ScrollRestore() {
    const { pathname } = useLocation();
    const saved = useRef(0);

    useEffect(() => {
        if (pathname !== "/") return;
        const onScroll = () => {
            if (window.location.pathname === "/")
                saved.current = window.scrollY;
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [pathname]);

    useLayoutEffect(() => {
        window.scrollTo({
            top: pathname === "/" ? saved.current : 0,
            behavior: "instant",
        });
    }, [pathname]);

    return null;
}
