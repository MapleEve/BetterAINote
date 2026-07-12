import { expect, type Locator, type Page } from "@playwright/test";

export async function chooseShadcnSelectOption(
    page: Page,
    trigger: Locator,
    optionName: string,
) {
    await expect(trigger).toHaveAttribute("role", "combobox");
    await expect(trigger).toHaveAttribute("data-slot", "select-trigger");
    await trigger.click();
    await page.getByRole("option", { name: optionName, exact: true }).click();
}

export async function expectShadcnSelectTrigger(
    trigger: Locator,
    {
        label,
        text,
    }: {
        label?: string;
        text: string | RegExp;
    },
) {
    await expect(trigger).toHaveAttribute("role", "combobox");
    await expect(trigger).toHaveAttribute("data-slot", "select-trigger");
    if (label) {
        await expect(trigger).toHaveAttribute("aria-label", label);
    }
    await expect(trigger).toContainText(text);
}
