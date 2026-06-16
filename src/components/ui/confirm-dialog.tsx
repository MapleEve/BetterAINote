"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

interface ConfirmDialogOptions {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    details?: string[];
    warning?: string;
}

type ConfirmDialogState = ConfirmDialogOptions & {
    resolve: (confirmed: boolean) => void;
};

const ConfirmDialogContext = createContext<{
    confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
} | null>(null);

export function ConfirmDialogProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [state, setState] = useState<ConfirmDialogState | null>(null);
    const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);

    const close = useCallback(
        (confirmed: boolean) => {
            if (!state) return;
            const returnTarget = returnFocusRef.current;
            returnFocusRef.current = null;
            state.resolve(confirmed);
            setState(null);
            window.setTimeout(() => {
                if (returnTarget && document.contains(returnTarget)) {
                    returnTarget.focus({ preventScroll: true });
                }
            }, 0);
        },
        [state],
    );

    useEffect(() => {
        if (!state) return;
        const timer = window.setTimeout(() => {
            cancelButtonRef.current?.focus();
        }, 30);
        return () => window.clearTimeout(timer);
    }, [state]);

    useEffect(() => {
        if (!state) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopImmediatePropagation();
                close(false);
            }
        };
        document.addEventListener("keydown", handleKeyDown, { capture: true });
        return () =>
            document.removeEventListener("keydown", handleKeyDown, {
                capture: true,
            });
    }, [close, state]);

    const confirm = useCallback((options: ConfirmDialogOptions) => {
        return new Promise<boolean>((resolve) => {
            returnFocusRef.current =
                document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : null;
            setState({ ...options, resolve });
        });
    }, []);

    const value = useMemo(() => ({ confirm }), [confirm]);

    return (
        <ConfirmDialogContext.Provider value={value}>
            {children}
            {state ? (
                // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: SOT scrim owns backdrop click; document-level Escape owns keyboard dismissal.
                <div
                    className="scrim"
                    data-open="true"
                    data-sot-panel="confirm-dialog"
                    aria-hidden="false"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) {
                            close(false);
                        }
                    }}
                >
                    <div
                        className="confirm-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="confirm-title"
                        aria-describedby="confirm-desc"
                    >
                        <header className="confirm-head">
                            <h3 id="confirm-title">{state.title}</h3>
                        </header>
                        <div className="confirm-body">
                            <p id="confirm-desc">{state.description}</p>
                            {state.details?.length ? (
                                <ul className="retx-modal-list">
                                    {state.details.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            ) : null}
                            {state.warning ? (
                                <p className="confirm-warn">{state.warning}</p>
                            ) : null}
                        </div>
                        <footer className="confirm-foot">
                            <button
                                className="btn ghost btn-sm"
                                type="button"
                                ref={cancelButtonRef}
                                onClick={() => close(false)}
                            >
                                {state.cancelLabel}
                            </button>
                            <button
                                className="btn danger btn-sm"
                                type="button"
                                onClick={() => close(true)}
                            >
                                {state.confirmLabel}
                            </button>
                        </footer>
                    </div>
                </div>
            ) : null}
        </ConfirmDialogContext.Provider>
    );
}

export function useConfirmDialog() {
    const context = useContext(ConfirmDialogContext);
    if (!context) {
        throw new Error(
            "useConfirmDialog must be used inside ConfirmDialogProvider",
        );
    }
    return context.confirm;
}
