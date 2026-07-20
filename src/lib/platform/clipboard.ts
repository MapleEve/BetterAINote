export async function writeBrowserClipboardText(text: string) {
    if (!text.trim()) {
        throw new Error("Clipboard text is empty");
    }

    let clipboardError: unknown = null;

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch (error) {
            clipboardError = error;
        }
    }

    if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);

        try {
            if (document.execCommand("copy")) {
                return;
            }
        } finally {
            document.body.removeChild(textarea);
        }
    }

    if (clipboardError instanceof Error) {
        throw clipboardError;
    }

    throw new Error("Clipboard is unavailable");
}
