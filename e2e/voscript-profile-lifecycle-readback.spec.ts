import { expect, type Page, type Route, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

type SpeakerProfile = {
    assignmentCount: number;
    createdAt: string;
    displayName: string;
    id: string;
    updatedAt: string;
    voiceprintRef: string | null;
};

type SpeakerProfilesResponse = {
    profiles: SpeakerProfile[];
};

type CreateSpeakerProfileResponse = {
    profile: SpeakerProfile;
};

const SPEAKER_PROFILES_ENDPOINT = "/api/speakers/profiles";

function speakerProfilesPanel(page: Page) {
    return page.locator('[data-sot-panel="speaker-profiles"]');
}

function speakerProfilesLocalPanel(page: Page) {
    return speakerProfilesPanel(page).locator(
        '[data-sot-panel="speaker-profiles-local"]',
    );
}

function speakerProfileRow(page: Page, profileId: string) {
    return speakerProfilesPanel(page).locator(
        `[data-sot-speaker-profile-row][data-sot-speaker-profile-id="${profileId}"]`,
    );
}

function isSpeakerProfilesEndpoint(url: string) {
    return new URL(url).pathname === SPEAKER_PROFILES_ENDPOINT;
}

async function getSpeakerProfiles(page: Page): Promise<SpeakerProfile[]> {
    const response = await page.request.get(SPEAKER_PROFILES_ENDPOINT);
    expect(response.status()).toBe(200);

    const payload = (await response.json()) as SpeakerProfilesResponse;
    expect(Array.isArray(payload.profiles)).toBe(true);
    return payload.profiles;
}

test("VoScript saved speaker profile persists through UI, API readback, reload, and delete", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });
    await ensureSignedIn(page);

    const baselineProfiles = await getSpeakerProfiles(page);
    const baselineProfileIds = new Set(
        baselineProfiles.map((profile) => profile.id),
    );
    const profileName = `E2E Speaker ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let createdProfileId: string | null = null;
    let holdCreateRequest = true;
    let notifyCreateRequestHeld: () => void;
    let releaseCreateRequest: () => void;
    const createRequestHeld = new Promise<void>((resolve) => {
        notifyCreateRequestHeld = resolve;
    });
    const createRequestReleased = new Promise<void>((resolve) => {
        releaseCreateRequest = resolve;
    });
    const gateCreateRequest = async (route: Route) => {
        if (
            holdCreateRequest &&
            route.request().method() === "POST" &&
            isSpeakerProfilesEndpoint(route.request().url())
        ) {
            holdCreateRequest = false;
            notifyCreateRequestHeld();
            await createRequestReleased;
        }

        await route.continue();
    };

    await page.route("**/api/speakers/profiles", gateCreateRequest);

    try {
        await page.goto("/settings#voscript", {
            waitUntil: "domcontentloaded",
        });

        const localPanel = speakerProfilesLocalPanel(page);
        const newNameInput = localPanel.locator(
            '[data-sot-control="speaker-profile-new-name"]',
        );
        const createButton = localPanel.locator(
            '[data-sot-control="speaker-profile-create"]',
        );

        await expect(localPanel).toBeVisible();
        await expect(localPanel).toHaveAttribute(
            "data-sot-state",
            /^(empty|ready)$/,
        );
        await expect(newNameInput).toBeEnabled();

        await newNameInput.fill(profileName);
        await expect(createButton).toBeEnabled();
        await expect(createButton).toHaveAttribute("data-sot-state", "idle");

        const createRequest = page.waitForRequest(
            (request) =>
                request.method() === "POST" &&
                isSpeakerProfilesEndpoint(request.url()),
        );
        const createResponse = page.waitForResponse(
            (response) =>
                response.request().method() === "POST" &&
                isSpeakerProfilesEndpoint(response.url()),
        );
        const createClick = createButton.click();

        await createRequestHeld;
        const request = await createRequest;
        expect(request.postDataJSON()).toEqual({ displayName: profileName });
        await expect(newNameInput).toBeDisabled();
        await expect(createButton).toBeDisabled();
        await expect(createButton).toHaveAttribute("aria-busy", "true");
        await expect(createButton).toHaveAttribute("data-sot-state", "saving");

        releaseCreateRequest();
        const response = await createResponse;
        expect(response.status()).toBe(200);
        const createPayload =
            (await response.json()) as CreateSpeakerProfileResponse;
        createdProfileId = createPayload.profile.id;
        expect(createPayload.profile).toMatchObject({
            assignmentCount: 0,
            displayName: profileName,
            id: expect.any(String),
            voiceprintRef: null,
        });
        await createClick;

        const createdRow = speakerProfileRow(page, createdProfileId);
        await expect(createdRow).toBeVisible();
        await expect(
            createdRow.locator('[data-sot-control="speaker-profile-name"]'),
        ).toHaveValue(profileName);
        await expect(createdRow).toHaveAttribute("data-sot-state", "ready");

        const apiReadback = await getSpeakerProfiles(page);
        expect(apiReadback).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    assignmentCount: 0,
                    displayName: profileName,
                    id: createdProfileId,
                    voiceprintRef: null,
                }),
            ]),
        );

        const reloadProfilesResponse = page.waitForResponse(
            (reloadResponse) =>
                reloadResponse.request().method() === "GET" &&
                isSpeakerProfilesEndpoint(reloadResponse.url()) &&
                reloadResponse.status() === 200,
        );
        await page.reload({ waitUntil: "domcontentloaded" });
        await reloadProfilesResponse;
        await expect(speakerProfileRow(page, createdProfileId)).toBeVisible();
        await expect(
            speakerProfileRow(page, createdProfileId).locator(
                '[data-sot-control="speaker-profile-name"]',
            ),
        ).toHaveValue(profileName);

        const deleteButton = speakerProfileRow(page, createdProfileId).locator(
            '[data-sot-control="speaker-profile-delete"]',
        );
        await expect(deleteButton).toBeEnabled();
        await deleteButton.click();

        const confirmDialog = page.getByRole("dialog", {
            name: "确认操作",
            exact: true,
        });
        await expect(confirmDialog).toBeVisible();
        await expect(confirmDialog).toContainText(profileName);

        const deleteRequest = page.waitForRequest(
            (request) =>
                request.method() === "DELETE" &&
                new URL(request.url()).pathname ===
                    `${SPEAKER_PROFILES_ENDPOINT}/${createdProfileId}`,
        );
        const deleteResponse = page.waitForResponse(
            (response) =>
                response.request().method() === "DELETE" &&
                new URL(response.url()).pathname ===
                    `${SPEAKER_PROFILES_ENDPOINT}/${createdProfileId}`,
        );
        await confirmDialog
            .getByRole("button", { name: "确认", exact: true })
            .click();

        const [deleteApiRequest, deleteApiResponse] = await Promise.all([
            deleteRequest,
            deleteResponse,
        ]);
        expect(deleteApiRequest.method()).toBe("DELETE");
        expect(deleteApiResponse.status()).toBe(200);
        expect(await deleteApiResponse.json()).toEqual({ success: true });
        await expect(speakerProfileRow(page, createdProfileId)).toHaveCount(0);
        expect(await getSpeakerProfiles(page)).toEqual(baselineProfiles);
    } finally {
        await page.unroute("**/api/speakers/profiles", gateCreateRequest);

        const profilesAfterTest = await getSpeakerProfiles(page);
        const profilesToRemove = profilesAfterTest.filter(
            (profile) =>
                profile.id === createdProfileId ||
                (!baselineProfileIds.has(profile.id) &&
                    profile.displayName === profileName),
        );

        for (const profile of profilesToRemove) {
            const cleanupResponse = await page.request.delete(
                `${SPEAKER_PROFILES_ENDPOINT}/${profile.id}`,
            );
            expect(cleanupResponse.status()).toBe(200);
        }

        expect(await getSpeakerProfiles(page)).toEqual(baselineProfiles);
    }
});
