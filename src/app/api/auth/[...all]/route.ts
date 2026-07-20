import { toNextJsHandler } from "better-auth/next-js";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasRegisteredUser, isRegisteredEmail } from "@/lib/registration";

const handlers = toNextJsHandler(auth);
let registrationRequestQueue = Promise.resolve();

function enqueueRegistrationGuard<T>(task: () => Promise<T>) {
    const run = registrationRequestQueue.then(task, task);
    registrationRequestQueue = run.then(
        () => undefined,
        () => undefined,
    );
    return run;
}

export const GET = handlers.GET;

export async function POST(request: NextRequest) {
    if (request.nextUrl.pathname.endsWith("/sign-up/email")) {
        return enqueueRegistrationGuard(async () => {
            if (await hasRegisteredUser()) {
                return NextResponse.json(
                    {
                        error: "Registration is disabled",
                    },
                    {
                        status: 403,
                    },
                );
            }

            return handlers.POST(request);
        });
    }

    if (request.nextUrl.pathname.endsWith("/sign-in/magic-link")) {
        return enqueueRegistrationGuard(async () => {
            const body = await request
                .clone()
                .json()
                .catch(() => null);
            const email =
                body && typeof body.email === "string"
                    ? body.email.trim().toLowerCase()
                    : "";

            if (
                email &&
                (await hasRegisteredUser()) &&
                !(await isRegisteredEmail(email))
            ) {
                return NextResponse.json(
                    {
                        error: "Registration is disabled",
                    },
                    {
                        status: 403,
                    },
                );
            }

            return handlers.POST(request);
        });
    }

    return handlers.POST(request);
}
