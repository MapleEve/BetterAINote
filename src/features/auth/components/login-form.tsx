"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";
import {
    navigateAndRefreshBrowserRoute,
    useBrowserRouteController,
} from "@/lib/platform/browser-router";
import { cn } from "@/lib/utils";

export function LoginForm({
    intent = "login",
    registrationOpen = false,
}: {
    intent?: "login" | "setup";
    registrationOpen?: boolean;
}) {
    const router = useBrowserRouteController();
    const [isLoading, setIsLoading] = useState(false);
    const [isLocalLoading, setIsLocalLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [formState, setFormState] = useState<{
        kind: "error" | "success";
        message: string;
    } | null>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const emailValue = String(formData.get("email") ?? "").trim();
        setIsLoading(true);
        setFormState(null);

        try {
            const result = await signIn.magicLink({
                email: emailValue,
                callbackURL: "/dashboard",
                newUserCallbackURL: "/onboarding",
                errorCallbackURL: "/login",
            });
            if (result.error) {
                const message = result.error.message || "登录链接发送失败";
                setFormState({ kind: "error", message });
                toast.error(message);
                return;
            }
            const message = "登录链接已发送";
            setFormState({ kind: "success", message });
            toast.success(message);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "登录链接发送失败";
            setFormState({ kind: "error", message });
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleLocalUse() {
        setIsLocalLoading(true);
        setFormState(null);

        try {
            const result = await signIn.anonymous();
            if (result.error) {
                const message = result.error.message || "本地工作空间启动失败";
                setFormState({ kind: "error", message });
                toast.error(message);
                return;
            }
            toast.success("已进入本地工作空间");
            navigateAndRefreshBrowserRoute(router, "/dashboard");
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "本地工作空间启动失败";
            setFormState({ kind: "error", message });
            toast.error(message);
        } finally {
            setIsLocalLoading(false);
        }
    }

    const surfaceState =
        isLoading || isLocalLoading ? "loading" : (formState?.kind ?? "idle");
    const invalid = formState?.kind === "error";
    const title = intent === "setup" ? "设置同步身份" : "登录 BetterAINote";
    const cardHeading =
        intent === "setup" ? "上手 / Sign in" : "登录 / Sign in";
    const subtitle =
        intent === "setup" && registrationOpen
            ? "首次使用可发送邮箱链接创建同步身份，也可以只在本地工作空间继续。"
            : "登录是可选的，仅用于多端同步";
    const surfaceName = intent === "setup" ? "auth-register" : "auth-login";

    return (
        <main
            className="auth-sot-canvas"
            data-sot-layout="auth-workstation"
            data-sot-surface={`${intent}-workstation`}
        >
            <form
                className="card"
                data-sot-surface={surfaceName}
                data-sot-ready={isMounted ? "true" : "false"}
                data-sot-state={surfaceState}
                onSubmit={handleSubmit}
            >
                <div className="card-h">{cardHeading}</div>
                <div className="card-sub">邮箱 + 链接 · 不要密码</div>
                <div className="frame" data-sot-frame="auth">
                    <img
                        className="auth-mark"
                        src="/assets/logo-mark-steel.svg"
                        alt=""
                    />{" "}
                    <div className="auth-title">{title}</div>
                    <div className="auth-sub">{subtitle}</div>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        defaultValue=""
                        required
                        disabled={!isMounted || isLoading}
                        autoComplete="email"
                        aria-invalid={invalid}
                        className={cn(
                            "inp",
                            invalid
                                ? "error"
                                : isLoading || isLocalLoading
                                  ? "saving"
                                  : "focus",
                        )}
                        data-sot-control="auth-email"
                        placeholder="mei@example.com"
                    />
                    {formState ? (
                        <div
                            className={cn(
                                "field-help",
                                formState.kind === "error" ? "err" : "ok",
                            )}
                            role={
                                formState.kind === "error" ? "alert" : "status"
                            }
                            data-auth-form-state={formState.kind}
                        >
                            {formState.message}
                        </div>
                    ) : null}
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={!isMounted || isLoading}
                        aria-busy={isLoading}
                        data-sot-control="send-login-link"
                    >
                        {isLoading ? "发送中..." : "发送登录链接"}
                    </Button>
                    <div className="auth-local-row">
                        或{" "}
                        <button
                            type="button"
                            className="auth-local-link"
                            disabled={!isMounted || isLocalLoading}
                            aria-busy={isLocalLoading}
                            data-sot-control="local-only"
                            onClick={() => void handleLocalUse()}
                        >
                            {isLocalLoading ? "启动中..." : "仅本地使用"}
                        </button>
                    </div>
                </div>
            </form>
        </main>
    );
}
