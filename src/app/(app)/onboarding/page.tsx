import { redirect } from "next/navigation";
import { OnboardingForm } from "@/features/onboarding/components/onboarding-form";
import { requireAuth } from "@/lib/auth-server";
import { hasCompletedOnboarding } from "@/server/modules/onboarding";

export default async function OnboardingPage() {
    const session = await requireAuth();

    if (await hasCompletedOnboarding(session.user.id)) {
        redirect("/dashboard");
    }

    return (
        <div className="flex min-h-full items-center justify-center p-4">
            <OnboardingForm />
        </div>
    );
}
