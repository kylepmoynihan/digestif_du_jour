import { getRecipe } from "../db/recipes";
import { saveGroceryList } from "../db/grocery";
import { aggregateIngredients } from "../utils/ingredient-aggregator";
import { getISOWeekId } from "../utils/week";

interface GenerateGroceryListInput {
  recipeIds: string[];
  excludeItems?: string[];
  weekId?: string;
}

export async function handleGenerateGroceryList(
  input: GenerateGroceryListInput,
  userId: number
): Promise<string> {
  const weekId = input.weekId || getISOWeekId();

  // Fetch all recipes
  const recipes = await Promise.all(input.recipeIds.map((id) => getRecipe(id)));
  const validRecipes = recipes.filter((r) => r !== null);

  if (validRecipes.length === 0) {
    return JSON.stringify({
      success: false,
      message: "No valid recipes found for the given IDs.",
    });
  }

  // Aggregate ingredients
  const recipesIngredients = validRecipes.map((r) => ({
    recipeName: r.name,
    ingredients: r.ingredients,
  }));

  const items = aggregateIngredients(recipesIngredients, input.excludeItems);

  // Save to DynamoDB
  await saveGroceryList(userId, weekId, items);

  return JSON.stringify({
    success: true,
    weekId,
    itemCount: items.length,
    items: items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      fromRecipes: i.fromRecipes,
    })),
    message: `Grocery list generated with ${items.length} items from ${validRecipes.length} recipes.`,
  });
}
