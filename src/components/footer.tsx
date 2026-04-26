"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { Github } from "@/components/icons/icons";
import { useLanguage } from "@/components/language-provider";

export function Footer() {
    const currentYear = new Date().getFullYear();
    const { t } = useLanguage();

    return (
        <footer className="border-t border-white/10 bg-background/55 backdrop-blur-xl supports-[backdrop-filter]:bg-background/35">
            <div className="container mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 py-4 text-center text-xs text-muted-foreground sm:text-sm">
                <span className="flex items-center gap-2 font-medium text-foreground/80">
                    {t("footer.madeWith")}
                    <Heart className="h-3.5 w-3.5 fill-destructive text-destructive" />
                </span>
                <span className="hidden h-3 w-px bg-border/70 sm:block" />
                <span>
                    © {currentYear} BetterAINote. {t("footer.copyright")}
                </span>
                <span className="hidden h-3 w-px bg-border/70 sm:block" />
                <Link
                    href="https://github.com/MapleEve/BetterAINote"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("footer.github")}
                    className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                    <Github className="size-4" />
                </Link>
            </div>
        </footer>
    );
}
