"use client";

import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
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
    const [formState, setFormState] = useState<{
        kind: "error" | "success";
        message: string;
    } | null>(null);
    const router = useBrowserRouteController();

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);
        setFormState(null);

        try {
            const result = await signIn.email({
                email,
                password,
            });

            if (result.error) {
                const message =
                    result.error.message || t("auth.invalidCredentials");
                setFormState({ kind: "error", message });
                toast.error(message);
                return;
            }

            setFormState({ kind: "success", message: t("auth.loginSuccess") });
            toast.success(t("auth.loginSuccess"));
            navigateAndRefreshBrowserRoute(router, "/dashboard");
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : t("auth.invalidCredentials");
            setFormState({ kind: "error", message });
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
                    {formState ? (
                        <div
                            role={
                                formState.kind === "error" ? "alert" : "status"
                            }
                            data-auth-form-state={formState.kind}
                            className={
                                formState.kind === "error"
                                    ? "glass-surface-subtle flex items-start gap-2 rounded-xl border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                                    : "glass-surface-subtle flex items-start gap-2 rounded-xl border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-200"
                            }
                        >
                            {formState.kind === "error" ? (
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            ) : (
                                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            )}
                            <span>{formState.message}</span>
                        </div>
                    ) : null}

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
                            aria-invalid={formState?.kind === "error"}
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
                            aria-invalid={formState?.kind === "error"}
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={isLoading}
                        aria-busy={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t("auth.signingIn")}
                            </>
                        ) : (
                            t("auth.signIn")
                        )}
                    </Button>
                </form>

                <div className="glass-surface-subtle rounded-2xl px-4 py-3 text-center text-sm text-muted-foreground">
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
