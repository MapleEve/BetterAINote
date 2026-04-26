import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { recordings } from "@/db/schema/library";

export async function listRecordingsForUser(userId: string) {
    return db
        .select()
        .from(recordings)
        .where(eq(recordings.userId, userId))
        .orderBy(desc(recordings.startTime));
}
