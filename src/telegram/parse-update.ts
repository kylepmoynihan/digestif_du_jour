import { TelegramUpdate, ParsedUpdate } from "./types";

const BOT_USERNAME = "digestif_bot";

export function parseUpdate(update: TelegramUpdate): ParsedUpdate | null {
  const message = update.message;
  if (!message || !message.from) return null;

  const isGroupChat = message.chat.type !== "private";

  // Check if bot is mentioned in entities
  const isBotMentioned = (message.entities || []).some(
    (entity) =>
      entity.type === "mention" &&
      message.text?.substring(entity.offset, entity.offset + entity.length) ===
        `@${BOT_USERNAME}`
  );

  // Check if this is a reply to a bot message
  const isReplyToBot = message.reply_to_message?.from?.is_bot === true;

  // Get text (from text field or caption for photos)
  let messageText = message.text || message.caption || "";

  // Strip bot mention from text
  if (isBotMentioned) {
    messageText = messageText.replace(`@${BOT_USERNAME}`, "").trim();
  }

  const firstName = message.from.first_name || "";
  const lastName = message.from.last_name || "";
  const userName = `${firstName} ${lastName}`.trim() || message.from.username || "Unknown";

  return {
    chatId: message.chat.id,
    userId: message.from.id,
    userName,
    messageText,
    photos: message.photo || null,
    isGroupChat,
    isBotMentioned,
    isReplyToBot,
  };
}
