import { useLoaderData, useRevalidator } from "react-router";
import { useLibrary } from "../../../../hooks/useLibrary";
import ReviewEditor from "../../_components/ReviewEditor/ReviewEditor";
import type loader from "./loader";

export default function EditBookPage() {
    const detail = useLoaderData<typeof loader>();
    const { categories } = useLibrary();
    const { revalidate } = useRevalidator();
    return (
        <ReviewEditor
            book={detail}
            categories={categories}
            onSaved={revalidate}
        />
    );
}
