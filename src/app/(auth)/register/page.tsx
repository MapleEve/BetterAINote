import { redirect } from "next/navigation";
import { RegisterForm } from "@/features/auth/components/register-form";
import { redirectIfAuthenticated } from "@/lib/auth-server";
import { hasRegisteredUser } from "@/lib/registration";

export default async function RegisterPage() {
    await redirectIfAuthenticated();

    if (await hasRegisteredUser()) {
        redirect("/login");
    }

    return <RegisterForm />;
}
