import {
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client";
import { reviewKey, reviewGSI1, recipeKey } from "./keys";
import { ReviewInsight } from "./taste-profile";

export async function saveReview(
  recipeId: string,
  userId: number,
  reviewerName: string,
  rating: number,
  comment?: string,
  insights?: ReviewInsight[],
  reuseSignals?: string[],
  cuisineTags?: string[]
): Promise<void> {
  const createdAt = new Date().toISOString();

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...reviewKey(recipeId, userId),
        ...reviewGSI1(userId, createdAt),
        recipeId,
        userId,
        reviewerName,
        rating,
        comment,
        insights,
        reuseSignals,
        cuisineTags,
        createdAt,
      },
    })
  );

  // Update denormalized rating on the recipe
  await updateRecipeRating(recipeId);
}

async function updateRecipeRating(recipeId: string): Promise<void> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `RECIPE#${recipeId}`,
        ":sk": "REVIEW#",
      },
    })
  );

  const reviews = result.Items || [];
  const count = reviews.length;
  if (count === 0) return;

  const avg =
    reviews.reduce((sum, r) => sum + (r.rating as number), 0) / count;

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: recipeKey(recipeId),
      UpdateExpression: "SET avgRating = :avg, reviewCount = :cnt",
      ExpressionAttributeValues: {
        ":avg": Math.round(avg * 10) / 10,
        ":cnt": count,
      },
    })
  );
}
