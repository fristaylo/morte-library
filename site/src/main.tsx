import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
    createBrowserRouter,
    createRoutesFromElements,
    RouterProvider,
} from "react-router";
import Background from "./components/Background/Background";
import "./main.scss";
import { DefaultRoutes } from "./routes";

const router = createBrowserRouter(createRoutesFromElements(DefaultRoutes));

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
    <StrictMode>
        <Background />
        <RouterProvider router={router} />
    </StrictMode>,
);
