import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { redirectIfAuthenticated } from "@/lib/auth-server";
import { hasRegisteredUser } from "@/lib/registration";

export default async function RegisterPage() {
    await redirectIfAuthenticated();

    if (await hasRegisteredUser()) {
        redirect("/login");
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-md">
                <RegisterForm />
            </div>
        </div>
    );
}
