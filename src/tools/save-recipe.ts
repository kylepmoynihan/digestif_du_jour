import { saveRecipe, RecipeIngredient } from "../db/recipes";

interface SaveRecipeInput {
  name: string;
  ingredients: RecipeIngredient[];
  instructions: string;
  tags: string[];
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  sourceUrl?: string;
}

export async function handleSaveRecipe(
  input: SaveRecipeInput,
  userId: number,
  userName: string
): Promise<string> {
  const recipe = await saveRecipe({
    name: input.name,
    ingredients: input.ingredients,
    instructions: input.instructions,
    tags: input.tags.map((t) => t.toLowerCase()),
    addedBy: userId,
    addedByName: userName,
    servings: input.servings,
    prepTime: input.prepTime,
    cookTime: input.cookTime,
    sourceUrl: input.sourceUrl,
  });

  return JSON.stringify({
    success: true,
    recipeId: recipe.id,
    name: recipe.name,
    message: `Recipe "${recipe.name}" saved with ID ${recipe.id}`,
  });
}
