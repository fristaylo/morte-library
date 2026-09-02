import AvifWorker from "./avif.worker?worker";

type WorkerResult = {
    id: number;
    type: "done" | "error";
    data: ArrayBuffer | string;
};

let imageWorker: Worker | null = null;
let requestId = 0;
const pendingRequests = new Map<
    number,
    { resolve: (value: ArrayBuffer) => void; reject: (reason: unknown) => void }
>();

function getImageWorker(): Worker {
    if (imageWorker) return imageWorker;
    const worker = new AvifWorker();
    worker.onmessage = (event: MessageEvent<WorkerResult>) => {
        const { id, type, data } = event.data;
        const handlers = pendingRequests.get(id);
        if (!handlers) return;
        pendingRequests.delete(id);
        if (type === "done") handlers.resolve(data as ArrayBuffer);
        else handlers.reject(data);
    };
    worker.onerror = (event: ErrorEvent) => {
        for (const handlers of pendingRequests.values()) {
            handlers.reject(event.message);
        }
        pendingRequests.clear();
        imageWorker = null;
    };
    imageWorker = worker;
    return worker;
}

let workerChain: Promise<unknown> = Promise.resolve();

function encodeOnWorker(
    blob: Blob,
    maxW: number,
    maxH: number,
    maxSize: number,
    speed: number,
): Promise<ArrayBuffer> {
    const run = () =>
        new Promise<ArrayBuffer>((resolve, reject) => {
            const worker = getImageWorker();
            const id = ++requestId;
            pendingRequests.set(id, { resolve, reject });
            worker.postMessage({
                id,
                type: "start",
                blob,
                maxW,
                maxH,
                maxSize,
                speed,
            });
        });
    const result = workerChain.then(run, run);
    workerChain = result.catch(() => {});
    return result;
}

const MAX_SIZE = 5 * 1024 * 1024;

export async function toAvif(
    file: File,
    opts: { maxW: number; maxH: number },
): Promise<File> {
    const { maxW, maxH } = opts;
    const buffer = await encodeOnWorker(file, maxW, maxH, MAX_SIZE, 8);
    const name = `${file.name.replace(/\.[^.]+$/, "")}.avif`;
    return new File([buffer], name, { type: "image/avif" });
}
