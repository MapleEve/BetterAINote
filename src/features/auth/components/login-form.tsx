"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth-client";
import {
    navigateAndRefreshBrowserRoute,
    useBrowserRouteController,
} from "@/lib/platform/browser-router";

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
            data-sot-layout="auth-workstation"
            data-sot-surface={`${intent}-workstation`}
        >
            <Card
                hasNoPadding
                data-sot-card="auth"
                data-sot-surface={surfaceName}
                data-sot-ready={isMounted ? "true" : "false"}
                data-sot-state={surfaceState}
            >
                <form onSubmit={handleSubmit}>
                    <div data-sot-part="card-heading">{cardHeading}</div>
                    <div data-sot-part="card-sub">邮箱 + 链接 · 不要密码</div>
                    <div data-sot-frame="auth">
                        <img
                            data-sot-part="auth-logo-mark"
                            src="/assets/logo-mark-steel.svg"
                            alt=""
                        />{" "}
                        <div data-sot-part="auth-heading">{title}</div>
                        <div data-sot-part="auth-description">{subtitle}</div>
                        <FieldGroup className="mx-auto max-w-[280px] gap-[10px]">
                            <Field
                                data-disabled={
                                    !isMounted || isLoading ? "true" : undefined
                                }
                                data-invalid={invalid ? "true" : undefined}
                            >
                                <FieldLabel htmlFor="email" className="sr-only">
                                    邮箱
                                </FieldLabel>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    defaultValue=""
                                    required
                                    disabled={!isMounted || isLoading}
                                    autoComplete="email"
                                    aria-invalid={invalid}
                                    className="h-[36px] w-full rounded-[9px] border-primary bg-[var(--bg-elevated)] px-[12px] py-0 !text-[13px] font-medium leading-[normal] text-foreground shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_18%,transparent)] focus-visible:border-primary focus-visible:ring-0 aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_3px_color-mix(in_oklab,var(--signal-danger)_16%,transparent)] aria-invalid:ring-0 md:!text-[13px] dark:bg-[var(--bg-elevated)]"
                                    data-sot-control="auth-email"
                                    data-sot-state={
                                        invalid
                                            ? "error"
                                            : isLoading || isLocalLoading
                                              ? "saving"
                                              : "ready"
                                    }
                                    placeholder="mei@example.com"
                                />
                                {formState?.kind === "error" ? (
                                    <FieldError
                                        data-sot-part="auth-form-message"
                                        data-sot-state={formState.kind}
                                        data-auth-form-state={formState.kind}
                                    >
                                        {formState.message}
                                    </FieldError>
                                ) : null}
                                {formState?.kind === "success" ? (
                                    <FieldDescription
                                        role="status"
                                        data-sot-part="auth-form-message"
                                        data-sot-state={formState.kind}
                                        data-auth-form-state={formState.kind}
                                    >
                                        {formState.message}
                                    </FieldDescription>
                                ) : null}
                            </Field>
                            <Field className="gap-0">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={!isMounted || isLoading}
                                    aria-busy={isLoading}
                                    className="h-[38px] w-full rounded-[8px] !border !border-solid !border-transparent !bg-[var(--accent)] px-[12px] py-0 text-[12px] font-semibold leading-[normal] !text-white shadow-none hover:!bg-[var(--accent)] focus-visible:border-primary focus-visible:ring-0"
                                    data-sot-control="send-login-link"
                                >
                                    {isLoading ? "发送中..." : "发送登录链接"}
                                </Button>
                                <FieldDescription data-sot-part="auth-local-choice">
                                    或{" "}
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        disabled={!isMounted || isLocalLoading}
                                        aria-busy={isLocalLoading}
                                        className="h-auto min-h-0 rounded-none p-0 align-baseline !text-[12px] !font-normal !leading-[normal] !text-[var(--accent)] underline !underline-offset-auto"
                                        data-sot-control="local-only"
                                        data-sot-state={
                                            isLocalLoading ? "loading" : "ready"
                                        }
                                        onClick={() => void handleLocalUse()}
                                    >
                                        {isLocalLoading
                                            ? "启动中..."
                                            : "仅本地使用"}
                                    </Button>
                                </FieldDescription>
                            </Field>
                        </FieldGroup>
                    </div>
                </form>
            </Card>
        </main>
    );
}
