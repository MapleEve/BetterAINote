import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userSettings } from "@/db/schema/core";
import { auth } from "@/lib/auth";

export async function getAuthenticatedUserId(request: Request) {
    const session = await auth.api.getSession({
        headers: request.headers,
    });

    return session?.user?.id ?? null;
}

export async function getUserSettingsRow(userId: string) {
    const [settings] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

    return settings ?? null;
}

export async function upsertUserSettings(
    userId: string,
    updates: Partial<typeof userSettings.$inferInsert>,
) {
    const values = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => value !== undefined),
    ) as Partial<typeof userSettings.$inferInsert>;

    const existing = await getUserSettingsRow(userId);

    if (existing) {
        await db
            .update(userSettings)
            .set({
                ...values,
                updatedAt: new Date(),
            })
            .where(eq(userSettings.userId, userId));
        return existing;
    }

    await db.insert(userSettings).values({
        userId,
        ...values,
    });

    return null;
}
