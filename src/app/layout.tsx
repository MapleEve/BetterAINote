import type { Metadata } from "next";
import {
    ConfirmDialogProvider,
    type ConfirmDialogSlotProps,
} from "@/components/ui/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";
import { DisplayPreferencesProvider } from "@/features/settings/components/display-preferences-provider";
import "./globals.css";

export const metadata: Metadata = {
    title: "BetterAINote",
    description:
        "Private self-hosted workspace for multi-platform voice record aggregation and unified management",
};

const confirmDialogSotSlotProps = {
    content: { "data-sot-content": "confirm-dialog" },
    overlay: { "data-sot-overlay": "confirm-dialog" },
    portalWrapper: { "data-sot-panel": "confirm-dialog" },
    header: { "data-sot-part": "confirm-head" },
    title: { "data-sot-part": "confirm-title" },
    body: { "data-sot-part": "confirm-body" },
    description: { "data-sot-part": "confirm-description" },
    extra: { "data-sot-part": "confirm-extra" },
    detailsList: { "data-sot-list": "confirm-dialog-details" },
    detailItem: { "data-sot-item": "confirm-dialog-detail" },
    warning: { "data-sot-part": "confirm-warning" },
    footer: { "data-sot-part": "confirm-foot" },
    cancelButton: { "data-sot-control": "confirm-dialog-cancel" },
    confirmButton: { "data-sot-control": "confirm-dialog-confirm" },
} satisfies ConfirmDialogSlotProps;

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-CN" suppressHydrationWarning>
            <body suppressHydrationWarning>
                <DisplayPreferencesProvider
                    attribute="data-theme"
                    defaultTheme="dark"
                    enableColorScheme={false}
                    enableSystem
                    disableTransitionOnChange
                >
                    <ConfirmDialogProvider
                        slotProps={confirmDialogSotSlotProps}
                    >
                        {children}
                        <Toaster />
                    </ConfirmDialogProvider>
                </DisplayPreferencesProvider>
            </body>
        </html>
    );
}
