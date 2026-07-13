import type { Metadata } from "next";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";
import { DisplayPreferencesProvider } from "@/features/settings/components/display-preferences-provider";
import "./globals.css";

export const metadata: Metadata = {
    title: "BetterAINote",
    description:
        "Private self-hosted workspace for multi-platform voice record aggregation and unified management",
};

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
                    <ConfirmDialogProvider>
                        {children}
                        <Toaster />
                    </ConfirmDialogProvider>
                </DisplayPreferencesProvider>
            </body>
        </html>
    );
}
