import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { parseUpdate } from "./telegram/parse-update";
import { isAllowedUser } from "./utils/auth";

const lambdaClient = new LambdaClient({});
const PROCESSOR_FUNCTION_NAME = process.env.PROCESSOR_FUNCTION_NAME!;

// Simple in-memory dedup for Telegram update_ids (survives within a warm Lambda)
const recentUpdateIds = new Set<number>();
const MAX_DEDUP_SIZE = 100;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const update = JSON.parse(event.body || "{}");

    // Deduplicate: Telegram may retry webhook delivery
    const updateId = update.update_id as number | undefined;
    if (updateId) {
      if (recentUpdateIds.has(updateId)) {
        console.log(`Duplicate update_id ${updateId}, skipping`);
        return { statusCode: 200, body: "OK" };
      }
      recentUpdateIds.add(updateId);
      // Prevent unbounded growth
      if (recentUpdateIds.size > MAX_DEDUP_SIZE) {
        const oldest = recentUpdateIds.values().next().value!;
        recentUpdateIds.delete(oldest);
      }
    }

    const parsed = parseUpdate(update);

    if (!parsed) {
      return { statusCode: 200, body: "OK" };
    }

    // Check user allowlist
    if (!isAllowedUser(parsed.userId)) {
      console.log(`Rejected message from unauthorized user: ${parsed.userId}`);
      return { statusCode: 200, body: "OK" };
    }

    // In group chat, only respond to @mentions or replies to bot
    if (parsed.isGroupChat && !parsed.isBotMentioned && !parsed.isReplyToBot) {
      return { statusCode: 200, body: "OK" };
    }

    // Skip empty messages
    if (!parsed.messageText && !parsed.photos) {
      return { statusCode: 200, body: "OK" };
    }

    // Invoke processor asynchronously
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: PROCESSOR_FUNCTION_NAME,
        InvocationType: "Event", // Async
        Payload: Buffer.from(JSON.stringify(update)),
      })
    );

    return { statusCode: 200, body: "OK" };
  } catch (error) {
    console.error("Receiver error:", error);
    return { statusCode: 200, body: "OK" }; // Always return 200 to Telegram
  }
};
