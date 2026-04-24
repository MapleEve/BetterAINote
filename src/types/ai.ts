/**
 * AI prompt types for title generation
 */

export type PromptPreset =
    | "default"
    | "meetings"
    | "lectures"
    | "phone-calls"
    | "audio-blog"
    | "idea-stormer";

export interface PromptConfig {
    id: PromptPreset;
    name: string;
    description: string;
    prompt: string;
}

/**
 * Custom prompt interface
 */
export interface CustomPrompt {
    id: string;
    name: string;
    prompt: string;
    createdAt: string;
}

/**
 * Prompt configuration structure
 */
export interface PromptConfiguration {
    selectedPrompt: string; // preset ID or custom prompt ID
    customPrompts: CustomPrompt[];
}
