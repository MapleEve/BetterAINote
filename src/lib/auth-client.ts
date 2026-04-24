"use client";

import { createAuthClient } from "better-auth/react";
import { getBrowserOrigin } from "@/lib/platform/browser-shell";

export const authClient = createAuthClient({
    baseURL: getBrowserOrigin(),
});

export const { useSession, signIn, signOut, signUp } = authClient;
