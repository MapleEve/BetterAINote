import { and, eq } from "drizzle-orm";
import type { SelectResultFields } from "drizzle-orm/query-builders/select.types";
import type { SelectedFields } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import { recordings } from "@/db/schema/library";

export async function findOwnedRecording<TSelection extends SelectedFields>(
    userId: string,
    recordingId: string,
    fields: TSelection,
): Promise<SelectResultFields<TSelection> | null> {
    const rows = (await db
        .select(fields)
        .from(recordings)
        .where(
            and(eq(recordings.id, recordingId), eq(recordings.userId, userId)),
        )
        .limit(1)) as SelectResultFields<TSelection>[];

    return rows[0] ?? null;
}
