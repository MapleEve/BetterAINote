import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sourceDevices } from "@/db/schema/library";
import type {
    PreparedSourceDeviceWrite,
    SourceProvider,
} from "@/lib/data-sources/types";

export async function persistSourceDevicesForUser(params: {
    userId: string;
    provider: SourceProvider;
    devices: PreparedSourceDeviceWrite[] | undefined;
}) {
    if (!params.devices?.length) {
        return;
    }

    for (const device of params.devices) {
        const [existingDevice] = await db
            .select()
            .from(sourceDevices)
            .where(
                and(
                    eq(sourceDevices.userId, params.userId),
                    eq(sourceDevices.provider, params.provider),
                    eq(sourceDevices.providerDeviceId, device.providerDeviceId),
                ),
            )
            .limit(1);

        if (existingDevice) {
            await db
                .update(sourceDevices)
                .set({
                    name: device.name,
                    model: device.model ?? null,
                    versionNumber: device.versionNumber ?? null,
                    updatedAt: new Date(),
                })
                .where(eq(sourceDevices.id, existingDevice.id));
            continue;
        }

        await db.insert(sourceDevices).values({
            userId: params.userId,
            provider: params.provider,
            providerDeviceId: device.providerDeviceId,
            name: device.name,
            model: device.model ?? null,
            versionNumber: device.versionNumber ?? null,
        });
    }
}
