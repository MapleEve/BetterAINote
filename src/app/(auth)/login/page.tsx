import { LoginForm } from "@/components/auth/login-form";
import { redirectIfAuthenticated } from "@/lib/auth-server";
import { isRegistrationOpen } from "@/lib/registration";

export default async function LoginPage() {
    // Redirect to dashboard if already authenticated
    await redirectIfAuthenticated();
    const registrationOpen = await isRegistrationOpen();

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-md">
                <LoginForm registrationOpen={registrationOpen} />
            </div>
        </div>
    );
}
