import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiCredentials } from "@/db/schema/core";

// Centralize raw api_credentials table access so ownership facades stay explicit.
export type ApiCredentialRecord = typeof apiCredentials.$inferSelect;
type ApiCredentialInsert = typeof apiCredentials.$inferInsert;

export async function listUserApiCredentials(userId: string) {
    return await db
        .select()
        .from(apiCredentials)
        .where(eq(apiCredentials.userId, userId));
}

export async function getUserApiCredentialByProvider(
    userId: string,
    provider: string,
) {
    const [credential] = await db
        .select()
        .from(apiCredentials)
        .where(
            and(
                eq(apiCredentials.userId, userId),
                eq(apiCredentials.provider, provider),
            ),
        )
        .limit(1);

    return credential ?? null;
}

export async function getDefaultTranscriptionApiCredential(userId: string) {
    const [credential] = await db
        .select()
        .from(apiCredentials)
        .where(
            and(
                eq(apiCredentials.userId, userId),
                eq(apiCredentials.isDefaultTranscription, true),
            ),
        )
        .limit(1);

    return credential ?? null;
}

export async function deleteApiCredentialById(id: string) {
    await db.delete(apiCredentials).where(eq(apiCredentials.id, id));
}

export async function updateApiCredentialById(
    id: string,
    updates: Partial<ApiCredentialInsert>,
) {
    await db
        .update(apiCredentials)
        .set({
            ...updates,
            updatedAt: new Date(),
        })
        .where(eq(apiCredentials.id, id));
}

export async function insertApiCredential(values: ApiCredentialInsert) {
    await db.insert(apiCredentials).values(values);
}
