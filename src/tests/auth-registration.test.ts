import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const mockedHandlers = vi.hoisted(() => ({
    GET: vi.fn(async () => new Response("ok", { status: 200 })),
    POST: vi.fn(async () => new Response("ok", { status: 200 })),
}));

vi.mock("better-auth/next-js", () => ({
    toNextJsHandler: vi.fn(() => mockedHandlers),
}));

vi.mock("@/lib/auth", () => ({
    auth: {},
}));

vi.mock("@/lib/registration", () => ({
    hasRegisteredUser: vi.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/[...all]/route";
import { hasRegisteredUser } from "@/lib/registration";

function createDeferredResponse() {
    let resolve: ((response: Response) => void) | undefined;
    const promise = new Promise<Response>((res) => {
        resolve = res;
    });
    if (!resolve) {
        throw new Error("Deferred response resolver was not initialized");
    }
    return { promise, resolve };
}

describe("Auth registration guard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("blocks sign-up when a user already exists", async () => {
        (hasRegisteredUser as Mock).mockResolvedValue(true);

        const response = await POST(
            new NextRequest("http://localhost:3001/api/auth/sign-up/email", {
                method: "POST",
            }),
        );

        expect(mockedHandlers.POST).not.toHaveBeenCalled();
        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toEqual({
            error: "Registration is disabled",
        });
    });

    it("passes sign-up through before the first user exists", async () => {
        (hasRegisteredUser as Mock).mockResolvedValue(false);

        const response = await POST(
            new NextRequest("http://localhost:3001/api/auth/sign-up/email", {
                method: "POST",
            }),
        );

        expect(mockedHandlers.POST).toHaveBeenCalledTimes(1);
        expect(response.status).toBe(200);
    });

    it("serializes concurrent sign-up requests so only one reaches the auth handler", async () => {
        const deferred = createDeferredResponse();
        (hasRegisteredUser as Mock)
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);
        mockedHandlers.POST.mockImplementationOnce(() => deferred.promise);

        const firstRequest = POST(
            new NextRequest("http://localhost:3001/api/auth/sign-up/email", {
                method: "POST",
            }),
        );
        await Promise.resolve();

        const secondRequest = POST(
            new NextRequest("http://localhost:3001/api/auth/sign-up/email", {
                method: "POST",
            }),
        );
        await Promise.resolve();

        expect(hasRegisteredUser).toHaveBeenCalledTimes(1);
        expect(mockedHandlers.POST).toHaveBeenCalledTimes(1);

        deferred.resolve(new Response("ok", { status: 200 }));

        const firstResponse = await firstRequest;
        const secondResponse = await secondRequest;

        expect(firstResponse.status).toBe(200);
        expect(hasRegisteredUser).toHaveBeenCalledTimes(2);
        expect(mockedHandlers.POST).toHaveBeenCalledTimes(1);
        expect(secondResponse.status).toBe(403);
        await expect(secondResponse.json()).resolves.toEqual({
            error: "Registration is disabled",
        });
    });
});
