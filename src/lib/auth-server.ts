import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/**
 * Get the current session on the server
 * Requires server component or API route
 */
export async function getSession() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    return session;
}

/**
 * Require authentication - redirects to login if not authenticated
 * Use in server components
 */
export async function requireAuth() {
    const session = await getSession();

    if (!session?.user) {
        redirect("/login");
    }

    return session;
}

/**
 * Redirect to dashboard if already authenticated
 * Use in login/register pages
 */
export async function redirectIfAuthenticated() {
    const session = await getSession();

    if (session?.user) {
        redirect("/dashboard");
    }
}
