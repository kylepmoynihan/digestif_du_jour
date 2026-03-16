import { TelegramPhotoSize } from "./types";

const BOT_TOKEN = process.env.BOT_TOKEN!;

export async function downloadTelegramPhoto(
  photos: TelegramPhotoSize[]
): Promise<{ base64: string; mimeType: string } | null> {
  // Get the largest photo (last in the array)
  const photo = photos[photos.length - 1];
  if (!photo) return null;

  // Get file path from Telegram
  const fileResponse = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${photo.file_id}`
  );
  const fileData = (await fileResponse.json()) as {
    ok: boolean;
    result?: { file_path?: string };
  };

  if (!fileData.ok || !fileData.result?.file_path) {
    console.error("Failed to get file path:", fileData);
    return null;
  }

  // Download the file
  const filePath = fileData.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
  const imageResponse = await fetch(downloadUrl);
  const buffer = await imageResponse.arrayBuffer();

  const base64 = Buffer.from(buffer).toString("base64");

  // Determine mime type from file extension
  const ext = filePath.split(".").pop()?.toLowerCase();
  const mimeType =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : "image/jpeg";

  return { base64, mimeType };
}
