import { z } from "zod";
import {
    assertServerRuntime,
    isBuildRuntime,
    isTestRuntime,
} from "@/lib/platform/runtime";

const envSchema = z.object({
    // Server-required values are optional at schema level so that `next build`
    // (phase-production-build) doesn't depend on server-only secrets.
    DATABASE_PATH: z.string().optional(),

    BETTER_AUTH_SECRET: z.string().optional(),
    APP_URL: z.string().url("APP_URL must be a valid URL").optional(),

    // Encryption
    // Optional at env-schema level so that builds don't fail if it's missing;
    // encryption code is responsible for enforcing a strong key at runtime.
    ENCRYPTION_KEY: z.string().optional(),

    LOCAL_STORAGE_PATH: z.string().optional().default("./storage"),
    TRANSCRIPT_WORDS_DATABASE_PATH: z.string().optional(),
    SYNC_WORKER_TICK_MS: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 60000)),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
    assertServerRuntime("Environment variables");

    try {
        const parsed = envSchema.parse({
            DATABASE_PATH: process.env.DATABASE_PATH,
            BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
            APP_URL: process.env.APP_URL,
            ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
            LOCAL_STORAGE_PATH: process.env.LOCAL_STORAGE_PATH,
            TRANSCRIPT_WORDS_DATABASE_PATH:
                process.env.TRANSCRIPT_WORDS_DATABASE_PATH,
            SYNC_WORKER_TICK_MS: process.env.SYNC_WORKER_TICK_MS,
        });

        // In runtime (dev/prod servers), we require a strong encryption key.
        // During `next build` (phase-production-build) or test runs we skip
        // this so that server-only config doesn't break the frontend build
        // or unit tests that mock env values.
        const isProductionBuildPhase = isBuildRuntime();
        const isTestEnv = isTestRuntime();

        if (!isProductionBuildPhase && !isTestEnv) {
            // Core server-side envs must be present when the server actually runs.
            if (!parsed.DATABASE_PATH) {
                throw new Error(
                    "DATABASE_PATH must be set in non-build runtime (dev/prod server)",
                );
            }

            if (!parsed.BETTER_AUTH_SECRET) {
                throw new Error(
                    "BETTER_AUTH_SECRET must be set in non-build runtime (dev/prod server)",
                );
            }
            if (parsed.BETTER_AUTH_SECRET.length < 32) {
                throw new Error(
                    "BETTER_AUTH_SECRET must be at least 32 characters",
                );
            }

            if (!parsed.APP_URL) {
                throw new Error(
                    "APP_URL must be set in non-build runtime (dev/prod server)",
                );
            }

            // Encryption key: required and strong at runtime, ignored during build.
            const key = parsed.ENCRYPTION_KEY;
            if (!key) {
                throw new Error(
                    "ENCRYPTION_KEY must be set in non-build runtime (dev/prod server)",
                );
            }
            const isValidHexKey = /^[0-9a-fA-F]{64}$/.test(key);
            if (!isValidHexKey) {
                throw new Error(
                    "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)",
                );
            }
        }

        return parsed;
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues
                .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                .join("\n");
            throw new Error(`Environment validation failed:\n${issues}`);
        }
        throw error;
    }
}

export const env = validateEnv();
