import { redirect } from "next/navigation";
import { RegisterForm } from "@/features/auth/components/register-form";
import { redirectIfAuthenticated } from "@/lib/auth-server";
import { hasRegisteredUser } from "@/lib/registration";

export default async function RegisterPage() {
    await redirectIfAuthenticated();

    if (await hasRegisteredUser()) {
        redirect("/login");
    }

    return (
        <div className="flex min-h-svh items-center justify-center px-4 py-8 md:py-12">
            <div className="w-full max-w-md">
                <RegisterForm />
            </div>
        </div>
    );
}
