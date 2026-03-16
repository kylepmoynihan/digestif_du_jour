import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client";
import { userKey } from "./keys";

export interface UserProfile {
  userId: number;
  name: string;
  telegramUsername?: string;
  createdAt: string;
  lastSeen: string;
}

export async function getUser(userId: number): Promise<UserProfile | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: userKey(userId) })
  );

  return (result.Item as UserProfile) || null;
}

export async function upsertUser(
  userId: number,
  name: string,
  telegramUsername?: string
): Promise<void> {
  const existing = await getUser(userId);
  const now = new Date().toISOString();

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...userKey(userId),
        userId,
        name,
        telegramUsername,
        createdAt: existing?.createdAt || now,
        lastSeen: now,
      },
    })
  );
}
