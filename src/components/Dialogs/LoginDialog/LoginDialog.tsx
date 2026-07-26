import { type FormEvent, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import Dialog from "../Dialog";
import "./LoginDialog.scss";

export default function LoginDialog({
    open,
    onClose,
    onSuccess,
}: {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}) {
    const { signIn } = useAuth();
    const [user, setUser] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function submit(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        const failure = await signIn(user, password);
        setBusy(false);
        setError(failure);
        if (!failure) {
            setPassword("");
            onSuccess?.();
        }
    }

    return (
        <Dialog open={open} onClose={onClose} title="Авторизация">
            <form className="login-form" onSubmit={submit}>
                <input
                    className="login-input"
                    placeholder="Имя"
                    autoComplete="username"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                />
                <input
                    className="login-input"
                    type="password"
                    placeholder="Пароль"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                {error && <p className="login-error">{error}</p>}
                <button
                    type="submit"
                    className="btn btn-dark login-submit"
                    disabled={busy}
                >
                    {busy ? "Проверяем…" : "Войти"}
                </button>
            </form>
        </Dialog>
    );
}
