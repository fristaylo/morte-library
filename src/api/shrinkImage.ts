export async function shrinkImage(file: File, maxWidth: number): Promise<File> {
    const url = URL.createObjectURL(file);
    const img = new Image();
    try {
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("bad image"));
            img.src = url;
        });
    } catch {
        URL.revokeObjectURL(url);
        return file;
    }
    URL.revokeObjectURL(url);
    if (!img.naturalWidth || !img.naturalHeight) return file;
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === "image/webp" ? "webp" : "png";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${ext}`, {
        type: blob.type,
    });
}
