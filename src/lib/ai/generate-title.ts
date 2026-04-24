import { eq } from "drizzle-orm";
import { OpenAI } from "openai";
import { db } from "@/db";
import { userSettings } from "@/db/schema/core";
import {
    getDefaultPromptConfig,
    getPromptById,
    type PromptConfiguration,
} from "./prompt-presets";
import { getDecryptedTitleGenerationProviderConfig } from "./title-generation-config";

const DEFAULT_CHAT_MODEL = "gpt-4.1-mini";

export async function generateTitleFromTranscription(
    userId: string,
    transcriptionText: string,
    metadata?: {
        recordingDate?: string | null;
        recordingTime?: string | null;
        currentFilename?: string | null;
    },
): Promise<string | null> {
    try {
        const [userSettingsRow] = await db
            .select()
            .from(userSettings)
            .where(eq(userSettings.userId, userId))
            .limit(1);

        let promptConfig: PromptConfiguration = getDefaultPromptConfig();
        if (userSettingsRow?.titleGenerationPrompt) {
            const config =
                userSettingsRow.titleGenerationPrompt as PromptConfiguration;
            promptConfig = {
                selectedPrompt: config.selectedPrompt || "default",
                customPrompts: config.customPrompts || [],
            };
        }

        let promptTemplate = getPromptById(
            promptConfig.selectedPrompt,
            promptConfig,
        );

        if (!promptTemplate) {
            console.warn(
                `Prompt not found: ${promptConfig.selectedPrompt}, using default`,
            );
            const defaultConfig = getDefaultPromptConfig();
            promptTemplate = getPromptById(
                defaultConfig.selectedPrompt,
                defaultConfig,
            );
            if (!promptTemplate) {
                return null;
            }
        }

        const dedicatedConfig =
            await getDecryptedTitleGenerationProviderConfig(userId);

        const apiKey = dedicatedConfig.apiKey;
        const baseURL = dedicatedConfig.baseUrl || undefined;
        const model = dedicatedConfig.model || DEFAULT_CHAT_MODEL;

        if (!apiKey) {
            console.warn("No dedicated AI rename model config found");
            return null;
        }

        const openai = new OpenAI({
            apiKey,
            baseURL,
        });

        // Truncate transcription if too long (to save tokens)
        const maxTranscriptionLength = 2000;
        const truncatedTranscription =
            transcriptionText.length > maxTranscriptionLength
                ? `${transcriptionText.substring(0, maxTranscriptionLength)}...`
                : transcriptionText;

        const prompt = promptTemplate
            .replace("{transcription}", truncatedTranscription)
            .replace("{recording_date}", metadata?.recordingDate || "unknown")
            .replace("{recording_time}", metadata?.recordingTime || "unknown")
            .replace("{current_filename}", metadata?.currentFilename || "None");

        const response = await openai.chat.completions.create({
            model,
            messages: [
                {
                    role: "system",
                    content:
                        "You generate clean filenames for synced audio recordings. Follow the requested filename format exactly and do not add explanations.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.2,
            max_tokens: 80,
        });

        const title = response.choices[0]?.message?.content?.trim() || null;

        if (!title) {
            return null;
        }

        // Clean up the title (remove quotes, colons, etc. if AI didn't follow rules)
        let cleanedTitle = title
            .replace(/^["']|["']$/g, "")
            .replace(/[\\/:*?"<>|]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        if (cleanedTitle.length > 96) {
            cleanedTitle = cleanedTitle.substring(0, 96).trim();
        }

        return cleanedTitle || null;
    } catch (error) {
        console.error("Error generating title:", error);
        return null;
    }
}
