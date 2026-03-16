import { saveReview } from "../db/reviews";
import { getRecipe } from "../db/recipes";
import { ReviewInsight, updateTasteProfile } from "../db/taste-profile";

interface SaveReviewInput {
  recipeId: string;
  rating: number;
  comment?: string;
  insights?: ReviewInsight[];
  reuseSignals?: string[];
}

export async function handleSaveReview(
  input: SaveReviewInput,
  userId: number,
  userName: string
): Promise<string> {
  // Fetch recipe to get tags for denormalization
  const recipe = await getRecipe(input.recipeId);
  const cuisineTags = recipe?.tags || [];

  await saveReview(
    input.recipeId,
    userId,
    userName,
    input.rating,
    input.comment,
    input.insights,
    input.reuseSignals,
    cuisineTags
  );

  // Update taste profile as side effect
  await updateTasteProfile(userId, {
    recipeId: input.recipeId,
    recipeName: recipe?.name || "Unknown",
    rating: input.rating,
    insights: input.insights || [],
    reuseSignals: input.reuseSignals || [],
    cuisineTags,
  });

  return JSON.stringify({
    success: true,
    message: `Review saved: ${input.rating}/5 for recipe ${input.recipeId}`,
    insightsExtracted: (input.insights || []).length,
    reuseSignals: (input.reuseSignals || []).length,
  });
}
