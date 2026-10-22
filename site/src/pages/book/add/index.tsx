import { useRevalidator } from "react-router";
import { useLibrary } from "../../../hooks/useLibrary";
import ReviewEditor from "../_components/ReviewEditor/ReviewEditor";

export default function AddBookPage() {
    const { categories } = useLibrary();
    const { revalidate } = useRevalidator();
    return <ReviewEditor categories={categories} onSaved={revalidate} />;
}
