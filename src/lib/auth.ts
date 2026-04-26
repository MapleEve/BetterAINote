import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { coreDb } from "@/db";
import { coreSchema } from "@/db/schema/core";
import { isBuildRuntime } from "@/lib/platform/runtime";
import { env } from "./env";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const BUILD_ONLY_AUTH_SECRET =
    "betterainote-build-only-secret-not-used-at-runtime";

function resolveAuthSecret() {
    if (env.BETTER_AUTH_SECRET) {
        return env.BETTER_AUTH_SECRET;
    }

    if (isBuildRuntime()) {
        return BUILD_ONLY_AUTH_SECRET;
    }

    return undefined;
}

function normalizeOrigin(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
}

function getHostname(origin: string | null) {
    if (!origin) {
        return null;
    }

    try {
        return new URL(origin).hostname;
    } catch {
        return null;
    }
}

function isLoopbackHost(hostname: string | null) {
    return hostname ? LOOPBACK_HOSTS.has(hostname) : false;
}

function normalizeForwardedOrigin(
    host: string | null,
    protocol: string | null,
) {
    if (!host) {
        return null;
    }

    const scheme =
        protocol === "http" || protocol === "https" ? protocol : "http";
    return normalizeOrigin(`${scheme}://${host}`);
}

async function resolveTrustedOrigins(request?: Request) {
    const configuredOrigin = normalizeOrigin(env.APP_URL);
    const configuredHostname = getHostname(configuredOrigin);
    const allowedOrigins = new Set<string>();

    if (configuredOrigin) {
        allowedOrigins.add(configuredOrigin);
    }

    if (!request) {
        return [...allowedOrigins];
    }

    const requestOrigin = normalizeOrigin(request.url);
    const requestHostname = getHostname(requestOrigin);
    const forwardedHost = request.headers
        .get("x-forwarded-host")
        ?.split(",")[0]
        ?.trim();
    const hostHeader = request.headers.get("host")?.trim() ?? null;
    const forwardedProto = request.headers
        .get("x-forwarded-proto")
        ?.split(",")[0]
        ?.trim();
    const forwardedOrigin =
        normalizeForwardedOrigin(
            forwardedHost ?? hostHeader,
            forwardedProto ?? null,
        ) ?? null;
    const originHeader = normalizeOrigin(request.headers.get("origin"));
    const originHostname = getHostname(originHeader);

    if (requestOrigin) {
        allowedOrigins.add(requestOrigin);
    }

    if (forwardedOrigin) {
        allowedOrigins.add(forwardedOrigin);
    }

    if (originHeader && originHostname) {
        const matchesConfiguredHost = configuredHostname === originHostname;
        const matchesRequestHost = requestHostname === originHostname;
        const loopbackPair =
            isLoopbackHost(originHostname) &&
            (isLoopbackHost(requestHostname) ||
                isLoopbackHost(configuredHostname));

        if (matchesConfiguredHost || matchesRequestHost || loopbackPair) {
            allowedOrigins.add(originHeader);
        }
    }

    return [...allowedOrigins];
}

export const auth = betterAuth({
    database: drizzleAdapter(coreDb, {
        provider: "sqlite",
        schema: coreSchema,
        usePlural: true,
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
    },
    secret: resolveAuthSecret(),
    baseURL: env.APP_URL,
    trustedOrigins: resolveTrustedOrigins,
});

export type Session = typeof auth.$Infer.Session;
