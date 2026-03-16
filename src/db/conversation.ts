import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client";
import { conversationKey } from "./keys";

interface StoredMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_MESSAGES = 20;
const TTL_HOURS = 24;

export async function getConversationContext(
  userId: number,
  chatId: number
): Promise<StoredMessage[]> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: conversationKey(userId, chatId),
    })
  );

  return (result.Item?.messages as StoredMessage[]) || [];
}

export async function saveConversationContext(
  userId: number,
  chatId: number,
  messages: StoredMessage[]
): Promise<void> {
  // Keep only the last N messages
  const trimmed = messages.slice(-MAX_MESSAGES);

  const ttl = Math.floor(Date.now() / 1000) + TTL_HOURS * 60 * 60;

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...conversationKey(userId, chatId),
        messages: trimmed,
        ttl,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}
