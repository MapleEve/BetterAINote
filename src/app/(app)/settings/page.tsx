import { SettingsPageContent } from "@/components/settings/settings-page-content";
import { requireAuth } from "@/lib/auth-server";

export default async function SettingsPage() {
    await requireAuth();
    return <SettingsPageContent />;
}
