"use client";

import type { SettingsSection } from "@/types/settings";
import { DataSourcesSection } from "./settings-sections/data-sources-section";
import { DisplaySection } from "./settings-sections/display-section";
import { MiscSection } from "./settings-sections/misc-section";
import { TitleGenerationSection } from "./settings-sections/title-generation-section";
import { TranscriptionSection } from "./settings-sections/transcription-section";
import { VoScriptSection } from "./settings-sections/voscript-section";

interface SettingsContentProps {
    activeSection: SettingsSection;
}

export function SettingsContent({ activeSection }: SettingsContentProps) {
    switch (activeSection) {
        case "transcription":
            return <TranscriptionSection />;
        case "title-generation":
            return <TitleGenerationSection />;
        case "voscript":
            return <VoScriptSection />;
        case "data-sources":
            return <DataSourcesSection />;
        case "appearance":
        case "display":
            return <DisplaySection />;
        case "misc":
            return <MiscSection />;
        case "sync":
        case "playback":
            return <MiscSection />;
        default:
            return null;
    }
}
