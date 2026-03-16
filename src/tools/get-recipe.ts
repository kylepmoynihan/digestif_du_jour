import { getRecipeWithReviews } from "../db/recipes";

interface GetRecipeInput {
  recipeId: string;
}

export async function handleGetRecipe(input: GetRecipeInput): Promise<string> {
  const recipe = await getRecipeWithReviews(input.recipeId);

  if (!recipe) {
    return JSON.stringify({ error: `Recipe ${input.recipeId} not found.` });
  }

  return JSON.stringify(recipe);
}
