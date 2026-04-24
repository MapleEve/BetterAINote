"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/icons/logo";
import { useLanguage } from "@/components/language-provider";

export function Footer() {
    const currentYear = new Date().getFullYear();
    const { t } = useLanguage();

    return (
        <footer className="border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 py-6 max-w-7xl">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col items-center md:items-start gap-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-mono">
                                {t("footer.madeWith")}
                            </span>
                            <Heart className="w-4 h-4 text-destructive fill-destructive animate-pulse" />
                        </div>
                        <div className="flex flex-col items-center md:items-start gap-1">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground/80 font-mono">
                                <Logo className="size-4" />
                                <span>
                                    © {currentYear}{" "}
                                    <Link
                                        href="/"
                                        className="text-primary hover:text-primary/80 transition-colors"
                                    >
                                        BetterAINote
                                    </Link>
                                    . Licensed under the{" "}
                                    <Link
                                        href="https://github.com/MapleEve/BetterAINote/blob/main/LICENSE"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:text-primary/80 transition-colors underline decoration-dotted underline-offset-2"
                                    >
                                        BetterAINote custom license based on
                                        Apache License 2.0
                                    </Link>
                                    .
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-border/20">
                    <div className="flex items-center justify-center gap-3">
                        <div className="flex gap-1">
                            {[...Array(3)].map((_, i) => (
                                <div
                                    // biome-ignore lint/suspicious/noArrayIndexKey: screw key
                                    key={i}
                                    className="w-1 h-1 rounded-full bg-muted-foreground/30"
                                />
                            ))}
                        </div>
                        <div className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-wider">
                            {t("footer.community")}
                        </div>
                        <div className="flex gap-1">
                            {[...Array(3)].map((_, i) => (
                                <div
                                    // biome-ignore lint/suspicious/noArrayIndexKey: screw key
                                    key={i}
                                    className="w-1 h-1 rounded-full bg-muted-foreground/30"
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
