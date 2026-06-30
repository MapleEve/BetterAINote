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

const authLoginClassNames = {
    layout: "grid min-h-[100svh] place-items-center bg-[var(--bg-canvas)] px-[32px] pb-[80px] pt-[28px] text-[var(--fg-primary)]",
    surface:
        "!block gap-0 w-[min(420px,100%)] min-h-[389px] overflow-visible rounded-[14px] border border-[var(--line-hairline)] bg-[var(--bg-elevated)] p-[18px] text-[var(--fg-primary)] !shadow-[var(--shadow-xs)] !backdrop-blur-none",
    header: "grid auto-rows-min gap-0 p-0",
    headerTitle:
        "mb-1 font-sans text-[13px] font-semibold leading-[normal] text-[var(--fg-primary)]",
    headerDescription:
        "mb-[14px] font-sans text-[12px] leading-[1.5] text-[var(--fg-tertiary)]",
    frame: "min-h-[292px] overflow-hidden [border-radius:12px] border border-[var(--line-hairline)] bg-[var(--bg-canvas)] !p-[28px] text-center",
    logoMark: "mb-[14px] inline [height:36px] [width:36px] align-baseline",
    frameTitle:
        "[font:600_18px_var(--font-display)] [margin-bottom:4px] leading-[normal] text-[var(--fg-primary)]",
    frameDescription:
        "[font:12px_var(--font-sans)] mb-[18px] leading-[normal] text-[var(--fg-tertiary)]",
    fieldGroup: "mx-auto max-w-[280px] gap-[10px]",
    field: "flex flex-col gap-0 [&>*]:w-full",
    actionField: "flex flex-col gap-0 [&>*]:w-full [&>.sr-only]:w-auto",
    emailInput:
        "[display:flex] h-[36px] [align-items:center] rounded-[9px] border-[var(--line-hairline)] !bg-[var(--bg-elevated)] px-[12px] py-0 [font:500_13px_var(--font-sans)] leading-[normal] text-[var(--fg-primary)] shadow-none focus-visible:!border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-[13px]",
    submitButton:
        "[display:inline-flex] h-[38px] w-full rounded-[8px] border border-transparent px-[12px] py-0 [font:600_12px_var(--font-sans)] leading-[normal] text-[var(--button-primary-fg)] shadow-none hover:text-[var(--button-primary-fg)] focus-visible:ring-0 has-[>svg]:px-[12px]",
    formMessage:
        "mx-auto mb-[10px] mt-[-2px] max-w-[280px] text-left text-[12px] font-normal leading-normal text-muted-foreground data-[sot-state=error]:text-destructive data-[sot-state=success]:text-primary",
    footer: "!mt-[14px] [font:12px_var(--font-sans)] !leading-[normal] !text-[var(--fg-disabled)]",
    inlineLink:
        "h-auto min-h-0 rounded-none p-0 align-baseline [font:inherit] text-primary underline underline-offset-auto hover:text-primary hover:underline",
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
                hasNoPadding
                className={authLoginClassNames.surface}
                data-sot-card="auth"
                data-sot-surface={surfaceName}
                data-sot-ready={isMounted ? "true" : "false"}
                data-sot-state={surfaceState}
            >
                <form onSubmit={handleSubmit}>
                    <CardHeader className={authLoginClassNames.header}>
                        <CardTitle
                            className={authLoginClassNames.headerTitle}
                            data-sot-part="card-heading"
                        >
                            {cardHeading}
                        </CardTitle>
                        <CardDescription
                            className={authLoginClassNames.headerDescription}
                            data-sot-part="card-sub"
                        >
                            邮箱 + 链接 · 不要密码
                        </CardDescription>
                    </CardHeader>
                    <CardContent
                        className={authLoginClassNames.frame}
                        data-sot-frame="auth"
                    >
                        <img
                            className={authLoginClassNames.logoMark}
                            data-sot-part="auth-logo-mark"
                            src="/assets/logo-mark-steel.svg"
                            alt=""
                        />{" "}
                        <CardTitle
                            className={authLoginClassNames.frameTitle}
                            data-sot-part="auth-heading"
                        >
                            {title}
                        </CardTitle>
                        <CardDescription
                            className={authLoginClassNames.frameDescription}
                            data-sot-part="auth-description"
                        >
                            {subtitle}
                        </CardDescription>
                        <FieldGroup className={authLoginClassNames.fieldGroup}>
                            <Field
                                className={authLoginClassNames.field}
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
                                    className={authLoginClassNames.emailInput}
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
                                    className={authLoginClassNames.submitButton}
                                    data-sot-control="send-login-link"
                                >
                                    {isLoading ? "发送中..." : "发送登录链接"}
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
                                        className={
                                            authLoginClassNames.inlineLink
                                        }
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
