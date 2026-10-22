import { encode } from "@jsquash/avif";

type StartMessage = {
    id: number;
    type: "start";
    blob: Blob;
    maxW: number;
    maxH: number;
    maxSize: number;
    speed: number;
};

self.addEventListener("message", async (event: MessageEvent<StartMessage>) => {
    const { id, type, blob, maxW, maxH, maxSize, speed } = event.data;
    if (type !== "start") return;
    try {
        const rawImageData = await decodeAndResize(blob, maxW, maxH);
        const size = rawImageData.height * rawImageData.width;
        const startQuality =
            size > 1024 * 2048
                ? 73
                : size > 1024 * 512
                  ? 77
                  : size > 512 * 256
                    ? 80
                    : 83;

        for (const quality of [startQuality, 65, 50, 40, 30, 20, 10]) {
            const avifBuffer: ArrayBuffer = await encode(rawImageData, {
                quality,
                speed,
                qualityAlpha: 80,
            });
            if (avifBuffer.byteLength < maxSize) {
                self.postMessage({ id, type: "done", data: avifBuffer }, [
                    avifBuffer,
                ]);
                return;
            }
        }
        self.postMessage({ id, type: "error", data: "Image is too big" });
    } catch (e) {
        console.error(e);
        self.postMessage({ id, type: "error", data: "Error converting image" });
    }
});

async function decodeAndResize(
    blob: Blob,
    maxW: number,
    maxH: number,
): Promise<ImageData> {
    const source = await createImageBitmap(blob);
    const scale = Math.min(1, maxW / source.width, maxH / source.height);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    let bitmap = source;
    if (scale < 1) {
        try {
            bitmap = await createImageBitmap(blob, {
                resizeWidth: width,
                resizeHeight: height,
                resizeQuality: "high",
            });
        } finally {
            source.close();
        }
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2d context in worker");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return ctx.getImageData(0, 0, width, height);
}
