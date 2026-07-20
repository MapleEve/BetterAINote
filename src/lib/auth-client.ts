"use client";

import { anonymousClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { getBrowserOrigin } from "@/lib/platform/browser-shell";

export const authClient = createAuthClient({
    baseURL: getBrowserOrigin(),
    plugins: [magicLinkClient(), anonymousClient()],
});

export const { useSession, signIn, signOut, signUp } = authClient;
