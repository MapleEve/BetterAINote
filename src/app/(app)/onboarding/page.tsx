import { OnboardingForm } from "@/features/onboarding/components/onboarding-form";
import { requireAuth } from "@/lib/auth-server";

export default async function OnboardingPage() {
    await requireAuth();

    return <OnboardingForm />;
}
