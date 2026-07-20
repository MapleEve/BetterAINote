import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

type CapturedButtonProps = {
    "aria-busy"?: boolean;
    "aria-label"?: string;
    children?: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    type?: "button" | "submit" | "reset";
};

type AlertProps = {
    "aria-live"?: "polite";
    children?: ReactNode;
    className?: string;
    role?: "alert" | "status";
};

let capturedButtons: CapturedButtonProps[] = [];

async function loadSystemBanner() {
    vi.resetModules();
    const React = await import("react");

    vi.doMock("@/components/language-provider", () => ({
        useLanguage: () => ({ language: "en-US" }),
    }));
    vi.doMock("@/lib/platform/runtime", () => ({
        hasBrowserWindow: () => true,
    }));
    vi.doMock("@/components/ui/alert", () => ({
        Alert: ({
            "aria-live": ariaLive,
            children,
            className,
            role,
        }: AlertProps) =>
            React.createElement(
                "div",
                { "aria-live": ariaLive, className, role },
                children,
            ),
        AlertDescription: ({ children }: { children?: ReactNode }) =>
            React.createElement("p", null, children),
        AlertTitle: ({ children }: { children?: ReactNode }) =>
            React.createElement("h2", null, children),
    }));
    vi.doMock("@/components/ui/button", () => ({
        Button: (props: CapturedButtonProps) => {
            capturedButtons.push(props);
            return React.createElement(
                "button",
                {
                    "aria-busy": props["aria-busy"],
                    "aria-label": props["aria-label"],
                    disabled: props.disabled,
                    onClick: props.onClick,
                    type: props.type,
                },
                props.children,
            );
        },
    }));
    vi.doMock("@/components/ui/progress", () => ({
        Progress: ({ value }: { value?: number | null }) =>
            React.createElement("div", {
                "aria-valuemax": 100,
                "aria-valuemin": 0,
                "aria-valuenow": value ?? undefined,
                role: "progressbar",
            }),
    }));

    const { renderToStaticMarkup } = await import("react-dom/server");
    const { SystemBanner } = await import(
        "@/features/dashboard/components/system-banner"
    );

    return { React, SystemBanner, renderToStaticMarkup };
}

function installBrowserStubs() {
    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: { onLine: false },
    });
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
            dispatchEvent: vi.fn(),
            location: { reload: vi.fn() },
        },
    });
}

afterEach(() => {
    capturedButtons = [];
    vi.doUnmock("@/components/language-provider");
    vi.doUnmock("@/lib/platform/runtime");
    vi.doUnmock("@/components/ui/alert");
    vi.doUnmock("@/components/ui/button");
    vi.doUnmock("@/components/ui/progress");
    vi.resetModules();
    delete (globalThis as { navigator?: unknown }).navigator;
    delete (globalThis as { window?: unknown }).window;
});

describe("system banner UI regression", () => {
    it("keeps the offline message semantically exposed", async () => {
        installBrowserStubs();
        const { React, SystemBanner, renderToStaticMarkup } =
            await loadSystemBanner();

        const html = renderToStaticMarkup(React.createElement(SystemBanner));

        expect(html).toContain('role="status"');
        expect(html).toContain('aria-live="polite"');
        expect(html).toContain("<h2>Offline</h2>");
        expect(html).toContain(
            "Downloaded recordings and transcripts remain readable.",
        );
        expect(html).toMatch(/<button[^>]*type="button"[^>]*>Retry<\/button>/);
        expect(html).toMatch(
            /<button[^>]*aria-label="Dismiss"[^>]*type="button"[^>]*>/,
        );
    });

    it("dispatches the retry action and runs the dismiss interaction", async () => {
        installBrowserStubs();
        const { React, SystemBanner, renderToStaticMarkup } =
            await loadSystemBanner();

        renderToStaticMarkup(React.createElement(SystemBanner));

        const retry = capturedButtons.find(
            (button) => button.children === "Retry",
        );
        const dismiss = capturedButtons.find(
            (button) => button["aria-label"] === "Dismiss",
        );
        expect(retry).toBeDefined();
        expect(dismiss).toBeDefined();

        retry?.onClick?.();
        const dispatchEvent = (
            globalThis.window as unknown as {
                dispatchEvent: ReturnType<typeof vi.fn>;
            }
        ).dispatchEvent;
        expect(dispatchEvent).toHaveBeenCalledOnce();
        expect(dispatchEvent.mock.calls[0]?.[0]).toMatchObject({
            type: "betterainote:system-banner-action",
        });
        expect(dispatchEvent.mock.calls[0]?.[0].detail).toEqual({
            action: "retry",
            id: "offline",
            role: "primary",
            state: "offline",
        });

        dismiss?.onClick?.();
        expect(dispatchEvent).toHaveBeenCalledOnce();
    });
});
