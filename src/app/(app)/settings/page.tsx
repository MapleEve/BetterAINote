import { SettingsPageContent } from "@/features/settings/components/settings-page-content";
import { requireAuth } from "@/lib/auth-server";

export default async function SettingsPage() {
    await requireAuth();
    return <SettingsPageContent />;
}
