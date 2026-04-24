import { toNextJsHandler } from "better-auth/next-js";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasRegisteredUser } from "@/lib/registration";

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

    return handlers.POST(request);
}
