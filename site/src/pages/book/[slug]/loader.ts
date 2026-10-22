import type { LoaderFunctionArgs } from "react-router";
import { fetchBook } from "../../../api";

export default function loader({ params }: LoaderFunctionArgs) {
    return fetchBook(params.slug ?? "");
}
