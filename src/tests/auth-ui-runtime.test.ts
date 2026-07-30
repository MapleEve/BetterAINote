import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
    signIn: {
        anonymous: vi.fn(),
        magicLink: vi.fn(),
    },
}));

vi.mock("@/lib/platform/browser-router", () => ({
    navigateAndRefreshBrowserRoute: vi.fn(),
    useBrowserRouteController: () => ({
        push: vi.fn(),
        refresh: vi.fn(),
    }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

let LoginForm: typeof import("@/features/auth/components/login-form").LoginForm;
let RegisterForm: typeof import("@/features/auth/components/register-form").RegisterForm;

beforeAll(async () => {
    ({ LoginForm } = await import("@/features/auth/components/login-form"));
    ({ RegisterForm } = await import(
        "@/features/auth/components/register-form"
    ));
});

function renderLogin(
    props: React.ComponentProps<
        typeof import("@/features/auth/components/login-form").LoginForm
    > = {},
) {
    return renderToStaticMarkup(React.createElement(LoginForm, props));
}

describe("auth UI runtime semantics", () => {
    it("renders the login and setup intents from shadcn primitives", () => {
        const login = renderLogin();
        const setup = renderToStaticMarkup(React.createElement(RegisterForm));

        for (const html of [login, setup]) {
            expect(html).toContain('data-slot="card"');
            expect(html).toContain('data-slot="input"');
            expect(html).toContain('data-slot="button"');
            expect(html).toContain('<form aria-busy="false">');
            expect(html).toContain('id="email"');
            expect(html).toContain('name="email"');
            expect(html).toContain('type="email"');
            expect(html).toContain('autoComplete="email"');
            expect(html).toContain('aria-invalid="false"');
            expect(html).toContain("发送登录链接");
            expect(html).toContain("仅本地使用");
            expect(html).not.toContain('id="password"');
            expect(html).not.toContain('id="name"');
            expect(html).not.toContain("data-sot");
            expect(html).not.toContain("authLoginClassNames");
        }

        expect(login).toContain("登录 / Sign in");
        expect(login).toContain("登录 BetterAINote");
        expect(setup).toContain("上手 / Sign in");
        expect(setup).toContain("设置同步身份");
        expect(setup).toContain(
            "首次使用可发送邮箱链接创建同步身份，也可以只在本地工作空间继续。",
        );
    });

    it("keeps the initial form disabled until client hydration", () => {
        const html = renderLogin();
        const email = html.match(/<input[^>]*id="email"[^>]*>/)?.[0];
        const buttons = html.match(/<button[^>]*>.*?<\/button>/g) ?? [];

        expect(email).toContain('disabled=""');
        expect(buttons).toHaveLength(2);
        for (const button of buttons) {
            expect(button).toContain('disabled=""');
            expect(button).toContain('aria-busy="false"');
        }
        expect(html).not.toContain('id="auth-form-message"');
        expect(html).not.toContain('data-slot="spinner"');
    });
});
