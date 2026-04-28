import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sourceConnections } from "@/db/schema/core";

export async function hasCompletedOnboarding(userId: string) {
    const [existingConnection] = await db
        .select({ id: sourceConnections.id })
        .from(sourceConnections)
        .where(eq(sourceConnections.userId, userId))
        .limit(1);

    return Boolean(existingConnection);
}
