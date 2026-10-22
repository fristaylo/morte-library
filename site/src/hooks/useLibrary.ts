import { useCallback } from "react";
import { useNavigate, useRouteLoaderData } from "react-router";
import { type Book, type Category, fetchBooks, fetchCategories } from "../api";

interface Library {
    books: Book[];
    categories: Category[];
}

const EMPTY: Library = { books: [], categories: [] };

export async function rootLoader(): Promise<Library> {
    const [books, categories] = await Promise.all([
        fetchBooks(),
        fetchCategories(),
    ]);
    return { books, categories };
}

export function useLibrary(): Library {
    return useRouteLoaderData<Library>("root") ?? EMPTY;
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
