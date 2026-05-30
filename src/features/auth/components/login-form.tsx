"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/icons/logo";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";
import {
    navigateAndRefreshBrowserRoute,
    useBrowserRouteController,
} from "@/lib/platform/browser-router";

type LoginFormProps = {
    registrationOpen?: boolean;
};

export function LoginForm({ registrationOpen = false }: LoginFormProps) {
    const { t } = useLanguage();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useBrowserRouteController();

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);

        try {
            const result = await signIn.email({
                email,
                password,
            });

            if (result.error) {
                toast.error(
                    result.error.message || t("auth.invalidCredentials"),
                );
                return;
            }

            toast.success(t("auth.loginSuccess"));
            navigateAndRefreshBrowserRoute(router, "/dashboard");
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : t("auth.invalidCredentials");
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card
            className="w-full max-w-md rounded-[1.5rem]"
            data-auth-surface="login"
        >
            <CardContent className="space-y-6 p-6 sm:p-7">
                <div className="flex items-start gap-3">
                    <div className="glass-control flex size-11 shrink-0 items-center justify-center rounded-2xl text-primary">
                        <Logo className="size-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                            BetterAINote
                        </p>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                            {t("auth.signIn")}
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {t("auth.singleUserPanel")}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">{t("auth.email")}</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            disabled={isLoading}
                            autoComplete="email"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">{t("auth.password")}</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            required
                            disabled={isLoading}
                            autoComplete="current-password"
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={isLoading}
                    >
                        {isLoading ? t("auth.signingIn") : t("auth.signIn")}
                    </Button>
                </form>

                <div className="rounded-2xl border border-border/55 bg-background/22 px-4 py-3 text-center text-sm text-muted-foreground backdrop-blur-xl">
                    {registrationOpen ? (
                        <span>
                            {t("auth.noAccountYet")}{" "}
                            <Link
                                href="/register"
                                className="font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                            >
                                {t("auth.goToRegister")}
                            </Link>
                        </span>
                    ) : (
                        t("auth.registrationDisabled")
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
