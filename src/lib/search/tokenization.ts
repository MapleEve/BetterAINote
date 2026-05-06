const FTS_OPERATOR_WORDS = new Set(["and", "or", "not", "near"]);
const TOKEN_PATTERN =
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+|[A-Za-z0-9_]+/gu;

function isCjkToken(token: string) {
    return /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+$/u.test(
        token,
    );
}

function cjkBigrams(token: string) {
    const chars = Array.from(token);
    if (chars.length <= 1) {
        return [];
    }

    const terms: string[] = [];
    for (let index = 0; index < chars.length - 1; index += 1) {
        terms.push(chars.slice(index, index + 2).join(""));
    }
    return terms;
}

function uniqueTerms(terms: string[]) {
    return [...new Set(terms.filter(Boolean))];
}

export function buildSearchTerms(input: string) {
    const terms: string[] = [];

    for (const match of input.matchAll(TOKEN_PATTERN)) {
        const rawToken = match[0].trim();
        if (!rawToken) {
            continue;
        }

        const token = isCjkToken(rawToken)
            ? rawToken
            : rawToken.toLocaleLowerCase();
        if (FTS_OPERATOR_WORDS.has(token)) {
            continue;
        }

        terms.push(token);
        if (isCjkToken(token)) {
            terms.push(...cjkBigrams(token));
        }
    }

    return uniqueTerms(terms);
}

export function buildFtsMatchQuery(input: string) {
    return buildSearchTerms(input).join(" ");
}

export function buildFtsIndexText(input: string | null | undefined) {
    const value = input?.trim() ?? "";
    if (!value) {
        return "";
    }

    const fallbackTerms = buildSearchTerms(value);

    return uniqueTerms([value, ...fallbackTerms]).join(" ");
}
