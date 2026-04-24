import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { db } from "@/db";
import { sourceConnections } from "@/db/schema/core";
import { requireAuth } from "@/lib/auth-server";

export default async function OnboardingPage() {
    const session = await requireAuth();

    const [existingConnection] = await db
        .select()
        .from(sourceConnections)
        .where(eq(sourceConnections.userId, session.user.id))
        .limit(1);

    if (existingConnection) {
        redirect("/dashboard");
    }

    return (
        <div className="flex min-h-full items-center justify-center p-4">
            <OnboardingForm />
        </div>
    );
}
