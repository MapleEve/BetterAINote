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
        <div className="dashboard-workstation flex min-h-svh items-center justify-center px-4 py-8 md:py-12">
            <OnboardingForm />
        </div>
    );
}
