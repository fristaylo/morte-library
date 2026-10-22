import { useRouteError } from "react-router";
import { ApiError } from "../../api";

export default function ErrorElement({ message }: { message: string }) {
    const error = useRouteError();
    const notFound = error instanceof ApiError && error.status === 404;
    if (notFound) return <NotFound />;
    return (
        <main className="review-page">
            <p className="load-error">{message}</p>
        </main>
    );
}

export function NotFound() {
    return (
        <main className="review-page">
            <p className="load-error">Такой страницы на полках нет.</p>
        </main>
    );
}
