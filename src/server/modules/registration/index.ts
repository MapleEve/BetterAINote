import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/core";

export async function hasRegisteredUser() {
    const existingUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.isAnonymous, false))
        .limit(1);

    return existingUsers.length > 0;
}

export async function isRegistrationOpen() {
    return !(await hasRegisteredUser());
}

export async function isRegisteredEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
        return false;
    }

    const existingUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(
            and(eq(users.email, normalizedEmail), eq(users.isAnonymous, false)),
        )
        .limit(1);

    return existingUsers.length > 0;
}
