import { type ReactNode, useEffect, useRef } from "react";
import "./Dialog.scss";

export default function Dialog({
    open,
    onClose,
    title,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (open && !el.open) el.showModal();
        if (!open && el.open) el.close();
    }, [open]);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const onBackdrop = (e: MouseEvent) => {
            if (e.target === el) el.close();
        };
        el.addEventListener("click", onBackdrop);
        return () => el.removeEventListener("click", onBackdrop);
    }, []);

    return (
        <dialog ref={ref} className="dialog" onClose={onClose}>
            <div className="dialog-body">
                <header className="dialog-head">
                    <h2 className="dialog-title">{title}</h2>
                    <button
                        type="button"
                        className="dialog-close"
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        ×
                    </button>
                </header>
                {children}
            </div>
        </dialog>
    );
}
