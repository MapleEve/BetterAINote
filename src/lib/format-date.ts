import {
    format,
    formatDistanceToNow,
    formatDistanceToNowStrict,
} from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import type { UiLanguage } from "@/lib/i18n";
import type { DateTimeFormat } from "@/types/common";

export type { DateTimeFormat };

function getDateFnsLocale(language: UiLanguage) {
    return language === "zh-CN" ? zhCN : enUS;
}

export function formatRelativeDistance(
    date: Date | string,
    language: UiLanguage,
): string {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return formatDistanceToNowStrict(dateObj, {
        locale: getDateFnsLocale(language),
    });
}

export function formatDateTime(
    date: Date | string,
    formatType: DateTimeFormat = "relative",
    language: UiLanguage = "zh-CN",
): string {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const locale = getDateFnsLocale(language);

    switch (formatType) {
        case "relative":
            return formatDistanceToNow(dateObj, {
                addSuffix: true,
                locale,
            });
        case "absolute":
            return language === "zh-CN"
                ? format(dateObj, "yyyy/MM/dd HH:mm", { locale })
                : format(dateObj, "MMM d, yyyy h:mm a", { locale });
        case "iso":
            return dateObj.toISOString();
        default:
            return formatDistanceToNow(dateObj, {
                addSuffix: true,
                locale,
            });
    }
}
