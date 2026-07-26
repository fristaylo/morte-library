import { useEffect, useSyncExternalStore } from "react";
import { fetchMe, login } from "../api/api";

let authorized: boolean | null = null;
let checking = false;
const listeners = new Set<() => void>();

function set(value: boolean) {
    authorized = value;
    for (const notify of listeners) notify();
}

function subscribe(notify: () => void) {
    listeners.add(notify);
    return () => {
        listeners.delete(notify);
    };
}

export function useAuth() {
    const value = useSyncExternalStore(subscribe, () => authorized);

    useEffect(() => {
        if (authorized !== null || checking) return;
        checking = true;
        fetchMe()
            .then(set, () => set(false))
            .finally(() => {
                checking = false;
            });
    }, []);

    return {
        authorized: value === true,
        loading: value === null,
        async signIn(user: string, password: string) {
            const error = await login(user, password);
            if (!error) set(true);
            return error;
        },
    };
}
