const BOT_TOKEN = process.env.BOT_TOKEN!;

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  options?: { parseMode?: "Markdown" | "HTML" }
): Promise<void> {
  // Telegram has a 4096 char limit per message. Split if needed.
  const chunks = splitMessage(text, 4000);

  for (const chunk of chunks) {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: chunk,
    };

    if (options?.parseMode) {
      body.parse_mode = options.parseMode;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send Telegram message:", error);
      // If Markdown parsing fails, retry once without parse_mode
      if (options?.parseMode) {
        await sendTelegramMessage(chatId, chunk, {}); // empty options = no parse_mode, no further retry
        continue;
      }
    }
  }
}

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen / 2) {
      // No good newline, split at space
      splitAt = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitAt < maxLen / 2) {
      // No good space either, hard split
      splitAt = maxLen;
    }

    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt).trimStart();
  }

  return chunks;
}
