const SIZE = 256;
const MAX_BYTES = 40_000;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo."));
    };
    image.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not compress that photo."));
      },
      "image/jpeg",
      quality,
    );
  });
}

export async function compressAvatar(file: File): Promise<Blob> {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not compress that photo.");
  const scale = Math.max(SIZE / image.width, SIZE / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.fillStyle = "#f4f0e5";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(image, (SIZE - width) / 2, (SIZE - height) / 2, width, height);

  let quality = 0.72;
  let blob = await toBlob(canvas, quality);
  while (blob.size > MAX_BYTES && quality > 0.42) {
    quality -= 0.08;
    blob = await toBlob(canvas, quality);
  }
  return blob;
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not save that photo."));
    reader.readAsDataURL(blob);
  });
}
