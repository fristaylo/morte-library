import { useCallback, useSyncExternalStore } from "react";
import { useNavigate, useRouteError, useRouteLoaderData } from "react-router";
import { type Book, type Category, fetchBooks, fetchCategories } from "../api";

interface Library {
    books: Book[];
    categories: Category[];
}

interface LoaderData {
    library: Promise<Library>;
}

type Result = { data: Library } | { error: unknown };

const EMPTY: Library = { books: [], categories: [] };

const results = new WeakMap<Promise<Library>, Result>();
const listeners = new Set<() => void>();
let latest: Library = EMPTY;
let loaded = false;

export async function rootLoader(): Promise<LoaderData> {
    const library = load();
    if (loaded) await library;
    loaded = true;
    return { library };
}

export function useLibrary(): Library {
    const library = useRouteLoaderData<LoaderData>("root")?.library;
    const routeError = useRouteError();
    const result = useSyncExternalStore(
        subscribe,
        () => library && results.get(library),
    );
    if (result && "error" in result) {
        if (!routeError) throw result.error;
        return latest;
    }
    return result?.data ?? latest;
}

export function useRandomBook(): (() => void) | undefined {
    const { books } = useLibrary();
    const navigate = useNavigate();
    const goRandom = useCallback(() => {
        const pick = books[Math.floor(Math.random() * books.length)];
        if (pick) navigate(`/book/${pick.slug}`);
    }, [books, navigate]);
    return books.length > 0 ? goRandom : undefined;
}

function load(): Promise<Library> {
    const library = Promise.all([fetchBooks(), fetchCategories()]).then(
        ([books, categories]) => ({ books, categories }),
    );
    library.then(
        (data) => {
            latest = data;
            settle(library, { data });
        },
        (error: unknown) => settle(library, { error }),
    );
    return library;
}

function settle(library: Promise<Library>, result: Result): void {
    results.set(library, result);
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
