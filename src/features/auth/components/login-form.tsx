"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
                variant="authSurface"
                data-sot-card="auth"
                data-sot-surface={surfaceName}
                data-sot-ready={isMounted ? "true" : "false"}
                data-sot-state={surfaceState}
            >
                <form onSubmit={handleSubmit}>
                    <CardHeader variant="authHeader">
                        <CardTitle
                            variant="authHeaderTitle"
                            data-sot-part="card-heading"
                        >
                            {cardHeading}
                        </CardTitle>
                        <CardDescription
                            variant="authHeaderDescription"
                            data-sot-part="card-sub"
                        >
                            邮箱 + 链接 · 不要密码
                        </CardDescription>
                    </CardHeader>
                    <CardContent variant="authFrame" data-sot-frame="auth">
                        <img
                            data-sot-part="auth-logo-mark"
                            src="/assets/logo-mark-steel.svg"
                            alt=""
                        />{" "}
                        <CardTitle
                            variant="authFrameTitle"
                            data-sot-part="auth-heading"
                        >
                            {title}
                        </CardTitle>
                        <CardDescription
                            variant="authFrameDescription"
                            data-sot-part="auth-description"
                        >
                            {subtitle}
                        </CardDescription>
                        <FieldGroup variant="authCompact">
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
                                    variant="authEmail"
                                    controlSize="authEmail"
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
                            <Field variant="authAction">
                                <Button
                                    type="submit"
                                    disabled={!isMounted || isLoading}
                                    aria-busy={isLoading}
                                    size="authSubmit"
                                    variant="authSubmit"
                                    data-sot-control="send-login-link"
                                >
                                    {isLoading ? "发送中..." : "发送登录链接"}
                                </Button>
                                <FieldDescription data-sot-part="auth-local-choice">
                                    或{" "}
                                    <Button
                                        type="button"
                                        size="authInlineLink"
                                        disabled={!isMounted || isLocalLoading}
                                        aria-busy={isLocalLoading}
                                        variant="authInlineLink"
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
                    </CardContent>
                </form>
            </Card>
        </main>
    );
}
