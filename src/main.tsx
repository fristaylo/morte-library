import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./main.scss";

function App() {
    return <h1>morte-library</h1>;
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
