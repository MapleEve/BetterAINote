import { SettingsPageContent } from "@/features/settings/components/settings-page-content";
import { requireAuth } from "@/lib/auth-server";

export default async function SettingsPage() {
    const session = await requireAuth();

    return (
        <SettingsPageContent
            user={{
                email: session.user.email,
                name: session.user.name,
            }}
        />
    );
}
