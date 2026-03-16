import { PutCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client";
import { recipeKey, recipeGSI1, reviewKey } from "./keys";
import { generateId } from "../utils/ulid";

export interface RecipeIngredient {
  name: string;
  quantity?: string;
  unit?: string;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  instructions: string;
  tags: string[];
  addedBy: number;
  addedByName: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  sourceUrl?: string;
  createdAt: string;
  avgRating?: number;
  reviewCount?: number;
}

export async function saveRecipe(
  recipe: Omit<Recipe, "id" | "createdAt">
): Promise<Recipe> {
  const id = generateId();
  const createdAt = new Date().toISOString();

  const item = {
    ...recipeKey(id),
    ...recipeGSI1(createdAt, id),
    id,
    createdAt,
    ...recipe,
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

  return { id, createdAt, ...recipe };
}

export async function getRecipe(recipeId: string): Promise<Recipe | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: recipeKey(recipeId) })
  );

  if (!result.Item) return null;
  return result.Item as Recipe;
}

export async function getRecipeWithReviews(recipeId: string) {
  // Query for recipe metadata and all reviews (same PK)
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": `RECIPE#${recipeId}` },
    })
  );

  const items = result.Items || [];
  const recipe = items.find((i) => i.SK === "METADATA") as Recipe | undefined;
  const reviews = items
    .filter((i) => (i.SK as string).startsWith("REVIEW#"))
    .map((i) => ({
      userId: i.userId as number,
      reviewerName: i.reviewerName as string,
      rating: i.rating as number,
      comment: i.comment as string | undefined,
      createdAt: i.createdAt as string,
    }));

  return recipe ? { ...recipe, reviews } : null;
}

export async function searchRecipes(options?: {
  query?: string;
  tags?: string[];
  limit?: number;
}): Promise<Recipe[]> {
  const limit = options?.limit || 10;

  // Query GSI1 for all recipes
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": "RECIPES" },
      ScanIndexForward: false, // Newest first
      Limit: 50, // Fetch more than needed for filtering
    })
  );

  let recipes = (result.Items || []) as Recipe[];

  // Filter by query (name or ingredients)
  if (options?.query) {
    const q = options.query.toLowerCase();
    recipes = recipes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(q))
    );
  }

  // Filter by tags
  if (options?.tags && options.tags.length > 0) {
    const filterTags = options.tags.map((t) => t.toLowerCase());
    recipes = recipes.filter((r) =>
      filterTags.some((ft) => r.tags.some((rt) => rt.toLowerCase().includes(ft)))
    );
  }

  return recipes.slice(0, limit);
}
