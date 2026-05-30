import { LoginForm } from "@/features/auth/components/login-form";
import { redirectIfAuthenticated } from "@/lib/auth-server";
import { isRegistrationOpen } from "@/lib/registration";

export default async function LoginPage() {
    // Redirect to dashboard if already authenticated
    await redirectIfAuthenticated();
    const registrationOpen = await isRegistrationOpen();

    return (
        <div className="flex min-h-svh items-center justify-center px-4 py-8 md:py-12">
            <div className="w-full max-w-md">
                <LoginForm registrationOpen={registrationOpen} />
            </div>
        </div>
    );
}
