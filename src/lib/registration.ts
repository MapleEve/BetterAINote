import { db } from "@/db";
import { users } from "@/db/schema/core";

export async function hasRegisteredUser() {
    const existingUsers = await db
        .select({ id: users.id })
        .from(users)
        .limit(1);

    return existingUsers.length > 0;
}

export async function isRegistrationOpen() {
    return !(await hasRegisteredUser());
}
