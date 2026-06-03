import type { Metadata } from "next";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";
import { DisplayPreferencesProvider } from "@/features/settings/components/display-preferences-provider";
import "./globals.css";

export const metadata: Metadata = {
    title: "BetterAINote - Private Audio Workspace",
    description:
        "Single-user private audio workspace with source sync, transcription, speaker review, and AI rename",
    icons: {
        icon: "/icon.svg",
        shortcut: "/icon.svg",
        apple: "/icon.svg",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-CN" suppressHydrationWarning>
            <body className="antialiased">
                <DisplayPreferencesProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
                    <Toaster />
                </DisplayPreferencesProvider>
            </body>
        </html>
    );
}
