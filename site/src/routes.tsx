import { type ComponentType, useEffect, useLayoutEffect, useRef } from "react";
import { type LoaderFunction, Outlet, Route, useLocation } from "react-router";
import ErrorElement, { NotFound } from "./components/ErrorElement/ErrorElement";
import Header from "./components/Header/Header";
import { rootLoader } from "./hooks/useLibrary";

const pages = import.meta.glob<{ default: ComponentType }>(
    "./pages/**/index.tsx",
    { eager: true },
);
const loaders = import.meta.glob<{ default: LoaderFunction }>(
    "./pages/**/loader.ts",
    { eager: true },
);

const pageRoutes = Object.entries(pages).map(([file, { default: Page }]) => {
    const dir = file.slice("./pages".length, -"/index.tsx".length);
    const path = dir.replace(/\[(.+?)\]/g, ":$1").slice(1);
    return (
        <Route
            key={file}
            index={path === ""}
            path={path || undefined}
            element={<Page />}
            loader={loaders[`./pages${dir}/loader.ts`]?.default}
            errorElement={
                <ErrorElement message="Не получилось открыть книгу — попробуйте позже." />
            }
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
