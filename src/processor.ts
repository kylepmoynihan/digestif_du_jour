import Anthropic from "@anthropic-ai/sdk";
import { parseUpdate } from "./telegram/parse-update";
import { sendTelegramMessage } from "./telegram/send-message";
import { downloadTelegramPhoto } from "./telegram/download-photo";
import {
  getConversationContext,
  saveConversationContext,
} from "./db/conversation";
import { upsertUser } from "./db/users";
import { chat } from "./ai/claude-client";
import { TelegramUpdate } from "./telegram/types";
import {
  getTasteProfile,
  serializeTasteProfileForPrompt,
} from "./db/taste-profile";

export const handler = async (event: TelegramUpdate): Promise<void> => {
  try {
    const parsed = parseUpdate(event);
    if (!parsed) return;

    const { chatId, userId, userName, messageText, photos, isGroupChat } =
      parsed;

    // Update user profile
    await upsertUser(userId, userName);

    // Load conversation context and taste profile in parallel
    const [history, tasteProfile] = await Promise.all([
      getConversationContext(userId, chatId),
      getTasteProfile(userId),
    ]);
    const tasteProfileText = tasteProfile
      ? serializeTasteProfileForPrompt(tasteProfile)
      : undefined;

    // Build user message content
    const contentBlocks: Anthropic.ContentBlockParam[] = [];

    // Handle photo messages
    if (photos && photos.length > 0) {
      const photo = await downloadTelegramPhoto(photos);
      if (photo) {
        contentBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: photo.mimeType as
              | "image/jpeg"
              | "image/png"
              | "image/webp"
              | "image/gif",
            data: photo.base64,
          },
        });
      }
    }

    // Add text content
    const text = messageText || (photos ? "What's in this image?" : "");
    if (text) {
      contentBlocks.push({ type: "text", text });
    }

    if (contentBlocks.length === 0) return;

    const userMessage: Anthropic.MessageParam = {
      role: "user",
      content: contentBlocks,
    };

    // Call Claude
    const { responseText, updatedHistory } = await chat(
      userId,
      userName,
      isGroupChat,
      history,
      userMessage,
      tasteProfileText
    );

    // Save conversation context
    await saveConversationContext(userId, chatId, updatedHistory);

    // Send response to Telegram
    if (responseText) {
      await sendTelegramMessage(chatId, responseText, {
        parseMode: "Markdown",
      });
    }
  } catch (error) {
    console.error("Processor error:", error);

    // Try to send an error message to the user
    try {
      const parsed = parseUpdate(event);
      if (parsed) {
        await sendTelegramMessage(
          parsed.chatId,
          "Sorry, something went wrong. Please try again!"
        );
      }
    } catch {
      // Ignore errors in error handler
    }
  }
};
