"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    formMessage: "text-left",
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

    const invalid = formState?.kind === "error";
    const title = intent === "setup" ? "设置同步身份" : "登录 BetterAINote";
    const cardHeading =
        intent === "setup" ? "上手 / Sign in" : "登录 / Sign in";
    const subtitle =
        intent === "setup" && registrationOpen
            ? "首次使用可发送邮箱链接创建同步身份，也可以只在本地工作空间继续。"
            : "登录是可选的，仅用于多端同步";
    return (
        <main className={authLoginClassNames.layout}>
            <Card className={authLoginClassNames.surface}>
                <form onSubmit={handleSubmit}>
                    <CardHeader>
                        <CardTitle>{cardHeading}</CardTitle>
                        <CardDescription>
                            邮箱 + 链接 · 不要密码
                        </CardDescription>
                    </CardHeader>
                    <CardContent className={authLoginClassNames.frame}>
                        <Image
                            className={authLoginClassNames.logoMark}
                            src="/assets/logo-mark-steel.svg"
                            alt=""
                            width={36}
                            height={36}
                        />{" "}
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>{subtitle}</CardDescription>
                        <FieldGroup className={authLoginClassNames.fieldGroup}>
                            <Field>
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
                                    aria-describedby={
                                        formState
                                            ? "auth-form-message"
                                            : undefined
                                    }
                                    placeholder="mei@example.com"
                                />
                                {formState ? (
                                    <Alert
                                        id="auth-form-message"
                                        className={
                                            authLoginClassNames.formMessage
                                        }
                                        role={
                                            formState.kind === "success"
                                                ? "status"
                                                : "alert"
                                        }
                                        aria-live={
                                            formState.kind === "success"
                                                ? "polite"
                                                : "assertive"
                                        }
                                        variant={
                                            formState.kind === "error"
                                                ? "statusError"
                                                : "default"
                                        }
                                    >
                                        <AlertDescription>
                                            {formState.message}
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                            </Field>
                            <Field className={authLoginClassNames.actionField}>
                                <Button
                                    type="submit"
                                    disabled={!isMounted || isLoading}
                                    aria-busy={isLoading}
                                    variant="default"
                                    className="w-full"
                                >
                                    {isLoading ? (
                                        <>
                                            <Spinner aria-hidden="true" />
                                            发送中...
                                        </>
                                    ) : (
                                        "发送登录链接"
                                    )}
                                </Button>
                                <FieldDescription
                                    className={authLoginClassNames.footer}
                                >
                                    或{" "}
                                    <Button
                                        type="button"
                                        disabled={!isMounted || isLocalLoading}
                                        aria-busy={isLocalLoading}
                                        variant="link"
                                        onClick={() => void handleLocalUse()}
                                    >
                                        {isLocalLoading ? (
                                            <>
                                                <Spinner aria-hidden="true" />
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
