import { getWeeklyPlan } from "../db/plans";
import { getRecipe } from "../db/recipes";
import { getISOWeekId } from "../utils/week";

interface GetWeeklyPlanInput {
  weekId?: string;
  userId?: string;
}

export async function handleGetWeeklyPlan(
  input: GetWeeklyPlanInput,
  currentUserId: number
): Promise<string> {
  const weekId = input.weekId || getISOWeekId();
  const userId = input.userId ? parseInt(input.userId) : currentUserId;

  const plan = await getWeeklyPlan(userId, weekId);

  if (!plan) {
    return JSON.stringify({
      weekId,
      recipes: [],
      message: "No meal plan found for this week.",
    });
  }

  // Fetch recipe details
  const recipes = await Promise.all(
    plan.recipeIds.map(async (id) => {
      const recipe = await getRecipe(id);
      return recipe
        ? { id: recipe.id, name: recipe.name, tags: recipe.tags }
        : { id, name: "Unknown recipe", tags: [] };
    })
  );

  return JSON.stringify({
    weekId,
    status: plan.status,
    recipes,
  });
}
