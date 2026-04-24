"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/icons/logo";
import { Panel } from "@/components/panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "@/lib/auth-client";
import {
    navigateAndRefreshBrowserRoute,
    useBrowserRouteController,
} from "@/lib/platform/browser-router";
import { useLanguage } from "../language-provider";
import { MetalButton } from "../metal-button";

export function RegisterForm() {
    const { t } = useLanguage();
    const router = useBrowserRouteController();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);

        try {
            const result = await signUp.email({
                name,
                email,
                password,
            });

            if (result.error) {
                toast.error(result.error.message || t("auth.signUpFailed"));
                return;
            }

            toast.success(t("auth.signUpSuccess"));
            navigateAndRefreshBrowserRoute(router, "/dashboard");
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : t("auth.signUpFailed"),
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Panel className="w-full max-w-md space-y-6">
            <div className="flex items-center gap-3">
                <Logo className="size-10 shrink-0" />
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        BetterAINote
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t("auth.createFirstAccount")}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">{t("auth.name")}</Label>
                    <Input
                        id="name"
                        type="text"
                        placeholder="BetterAINote Admin"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                        disabled={isLoading}
                    />
                </div>

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
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password">{t("auth.password")}</Label>
                    <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        disabled={isLoading}
                    />
                </div>

                <MetalButton
                    type="submit"
                    className="w-full"
                    variant="cyan"
                    disabled={isLoading}
                >
                    {isLoading ? t("auth.signingUp") : t("auth.signUp")}
                </MetalButton>
            </form>

            <div className="text-center text-sm">
                <span className="text-muted-foreground">
                    {t("auth.alreadyHaveAccount")}{" "}
                </span>
                <Link
                    href="/login"
                    className="text-accent-cyan hover:underline"
                >
                    {t("auth.signIn")}
                </Link>
            </div>
        </Panel>
    );
}
