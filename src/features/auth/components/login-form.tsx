"use client";

import Image from "next/image";
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
import { Spinner } from "@/components/ui/spinner";
import { signIn } from "@/lib/auth-client";
import {
    navigateAndRefreshBrowserRoute,
    useBrowserRouteController,
} from "@/lib/platform/browser-router";

const authLoginClassNames = {
    layout: "grid min-h-svh place-items-center bg-background px-6 py-10 text-foreground",
    surface: "w-full max-w-sm",
    frame: "flex flex-col items-center text-center",
    logoMark: "mb-4 size-9",
    fieldGroup: "mx-auto w-full max-w-xs",
    actionField: "gap-3",
    formMessage: "text-left data-[sot-state=success]:text-primary",
    footer: "text-center",
} as const;

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
            className={authLoginClassNames.layout}
            data-sot-layout="auth-workstation"
            data-sot-surface={`${intent}-workstation`}
        >
            <Card
                className={authLoginClassNames.surface}
                data-sot-card="auth"
                data-sot-surface={surfaceName}
                data-sot-ready={isMounted ? "true" : "false"}
                data-sot-state={surfaceState}
            >
                <form onSubmit={handleSubmit}>
                    <CardHeader>
                        <CardTitle data-sot-part="card-heading">
                            {cardHeading}
                        </CardTitle>
                        <CardDescription data-sot-part="card-sub">
                            邮箱 + 链接 · 不要密码
                        </CardDescription>
                    </CardHeader>
                    <CardContent
                        className={authLoginClassNames.frame}
                        data-sot-frame="auth"
                    >
                        <Image
                            className={authLoginClassNames.logoMark}
                            data-sot-part="auth-logo-mark"
                            src="/assets/logo-mark-steel.svg"
                            alt=""
                            width={36}
                            height={36}
                        />{" "}
                        <CardTitle data-sot-part="auth-heading">
                            {title}
                        </CardTitle>
                        <CardDescription data-sot-part="auth-description">
                            {subtitle}
                        </CardDescription>
                        <FieldGroup className={authLoginClassNames.fieldGroup}>
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
                                        className={
                                            authLoginClassNames.formMessage
                                        }
                                        data-sot-part="auth-form-message"
                                        data-sot-state={formState.kind}
                                        data-auth-form-state={formState.kind}
                                    >
                                        {formState.message}
                                    </FieldError>
                                ) : null}
                                {formState?.kind === "success" ? (
                                    <FieldDescription
                                        className={
                                            authLoginClassNames.formMessage
                                        }
                                        role="status"
                                        data-sot-part="auth-form-message"
                                        data-sot-state={formState.kind}
                                        data-auth-form-state={formState.kind}
                                    >
                                        {formState.message}
                                    </FieldDescription>
                                ) : null}
                            </Field>
                            <Field className={authLoginClassNames.actionField}>
                                <Button
                                    type="submit"
                                    disabled={!isMounted || isLoading}
                                    aria-busy={isLoading}
                                    variant="default"
                                    className="w-full"
                                    data-sot-control="send-login-link"
                                >
                                    {isLoading ? (
                                        <>
                                            <Spinner
                                                data-icon="inline-start"
                                                aria-hidden="true"
                                            />
                                            发送中...
                                        </>
                                    ) : (
                                        "发送登录链接"
                                    )}
                                </Button>
                                <FieldDescription
                                    className={authLoginClassNames.footer}
                                    data-sot-part="auth-local-choice"
                                >
                                    或{" "}
                                    <Button
                                        type="button"
                                        disabled={!isMounted || isLocalLoading}
                                        aria-busy={isLocalLoading}
                                        variant="link"
                                        data-sot-control="local-only"
                                        data-sot-state={
                                            isLocalLoading ? "loading" : "ready"
                                        }
                                        onClick={() => void handleLocalUse()}
                                    >
                                        {isLocalLoading ? (
                                            <>
                                                <Spinner
                                                    data-icon="inline-start"
                                                    aria-hidden="true"
                                                />
                                                启动中...
                                            </>
                                        ) : (
                                            "仅本地使用"
                                        )}
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
