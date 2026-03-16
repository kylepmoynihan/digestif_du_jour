import { PutCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client";
import { planKey, planGSI1 } from "./keys";

export interface WeeklyPlan {
  userId: number;
  userName: string;
  weekId: string;
  recipeIds: string[];
  status: "draft" | "finalized";
  createdAt: string;
}

export async function saveWeeklyPlan(
  userId: number,
  userName: string,
  weekId: string,
  recipeIds: string[],
  status: "draft" | "finalized" = "draft"
): Promise<void> {
  const createdAt = new Date().toISOString();

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...planKey(userId, weekId),
        ...planGSI1(weekId, userId),
        userId,
        userName,
        weekId,
        recipeIds,
        status,
        createdAt,
      },
    })
  );
}

export async function getWeeklyPlan(
  userId: number,
  weekId: string
): Promise<WeeklyPlan | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: planKey(userId, weekId) })
  );

  return (result.Item as WeeklyPlan) || null;
}

export async function getAllPlansForWeek(
  weekId: string
): Promise<WeeklyPlan[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": `WEEK#${weekId}` },
    })
  );

  return (result.Items || []) as WeeklyPlan[];
}
