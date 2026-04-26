import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({
    redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    redirect,
}));

vi.mock("@/lib/auth-server", () => ({
    redirectIfAuthenticated: vi.fn(),
}));

vi.mock("@/lib/registration", () => ({
    hasRegisteredUser: vi.fn(),
}));

vi.mock("@/components/auth/register-form", () => ({
    RegisterForm: () => "REGISTER_FORM",
}));

import RegisterPage from "@/app/(auth)/register/page";
import { redirectIfAuthenticated } from "@/lib/auth-server";
import { hasRegisteredUser } from "@/lib/registration";

describe("Trimmed product surface", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (redirectIfAuthenticated as Mock).mockResolvedValue(undefined);
    });

    it("redirects the register page back to login after the first user exists", async () => {
        (hasRegisteredUser as Mock).mockResolvedValue(true);

        await RegisterPage();

        expect(redirect).toHaveBeenCalledWith("/login");
    });

    it("keeps the register page available before the first user is created", async () => {
        (hasRegisteredUser as Mock).mockResolvedValue(false);

        const page = await RegisterPage();

        expect(redirect).not.toHaveBeenCalled();
        expect(page).toBeTruthy();
    });

    it("removes trimmed routes and helper modules from the repository", () => {
        const removedPaths = [
            "src/app/api/backup/route.ts",
            "src/app/api/export/route.ts",
            "src/app/api/recordings/[id]/enhance/route.ts",
            "src/app/api/recordings/[id]/export-obsidian/route.ts",
            "src/app/api/recordings/[id]/summary/route.ts",
            "src/app/api/recordings/upload/route.ts",
            "src/app/api/settings/ai/providers/route.ts",
            "src/app/api/settings/ai/providers/[id]/route.ts",
            "src/app/api/settings/obsidian/route.ts",
            "src/app/api/settings/obsidian/test/route.ts",
            "src/app/api/settings/storage/route.ts",
            "src/app/api/settings/test-email/route.ts",
            "src/app/api/settings/user/route.ts",
            "src/app/api/tags/route.ts",
            "src/app/api/tags/[id]/route.ts",
            "src/components/dashboard/tag-assignment.tsx",
            "src/components/settings-sections/export-section.tsx",
            "src/components/settings-sections/notifications-section.tsx",
            "src/components/settings-sections/obsidian-section.tsx",
            "src/components/settings-sections/providers-section.tsx",
            "src/components/settings-sections/storage-section.tsx",
            "src/components/settings-sections/summary-section.tsx",
            "src/components/settings-sections/tags-section.tsx",
            "src/lib/obsidian/client.ts",
            "src/lib/obsidian/formatter.ts",
            "src/lib/notifications/email.ts",
            "src/lib/transcription/browser-transcriber.ts",
        ];

        for (const relativePath of removedPaths) {
            expect(
                existsSync(join(process.cwd(), relativePath)),
                `${relativePath} should be deleted`,
            ).toBe(false);
        }
    });

    it("keeps neutral recording tag routes while removing legacy tag routes", () => {
        expect(
            existsSync(join(process.cwd(), "src/app/api/tags/route.ts")),
        ).toBe(false);
        expect(
            existsSync(join(process.cwd(), "src/app/api/tags/[id]/route.ts")),
        ).toBe(false);
        expect(
            existsSync(
                join(process.cwd(), "src/app/api/recording-tags/route.ts"),
            ),
        ).toBe(true);
        expect(
            existsSync(
                join(
                    process.cwd(),
                    "src/app/api/recordings/[id]/tags/route.ts",
                ),
            ),
        ).toBe(true);
    });

    it("removes empty legacy API shell directories from the repository", () => {
        const removedDirectories = [
            "src/app/api/backup",
            "src/app/api/export",
            "src/app/api/settings/ai",
            "src/app/api/settings/ai/providers",
            "src/app/api/settings/ai/providers/[id]",
            "src/app/api/settings/obsidian",
            "src/app/api/settings/obsidian/test",
            "src/app/api/settings/storage",
            "src/app/api/settings/test-email",
            "src/app/api/settings/user",
            "src/app/api/tags",
            "src/app/api/tags/[id]",
        ];

        for (const relativePath of removedDirectories) {
            expect(
                existsSync(join(process.cwd(), relativePath)),
                `${relativePath} should be deleted`,
            ).toBe(false);
        }
    });
});
