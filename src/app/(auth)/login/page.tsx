import { LoginForm } from "@/features/auth/components/login-form";
import { redirectIfAuthenticated } from "@/lib/auth-server";
import { isRegistrationOpen } from "@/lib/registration";

export default async function LoginPage() {
    await redirectIfAuthenticated();
    const registrationOpen = await isRegistrationOpen();

    return <LoginForm registrationOpen={registrationOpen} />;
}
