import { getAllPlansForWeek } from "../db/plans";
import { getRecipe } from "../db/recipes";
import { getISOWeekId } from "../utils/week";

interface GetAllWeekPlansInput {
  weekId?: string;
}

export async function handleGetAllWeekPlans(
  input: GetAllWeekPlansInput
): Promise<string> {
  const weekId = input.weekId || getISOWeekId();

  const plans = await getAllPlansForWeek(weekId);

  if (plans.length === 0) {
    return JSON.stringify({
      weekId,
      plans: [],
      message: `No one has planned meals for ${weekId} yet.`,
    });
  }

  // Fetch recipe details for each plan
  const plansWithDetails = await Promise.all(
    plans.map(async (plan) => {
      const recipes = await Promise.all(
        plan.recipeIds.map(async (id) => {
          const recipe = await getRecipe(id);
          return recipe
            ? { id: recipe.id, name: recipe.name }
            : { id, name: "Unknown recipe" };
        })
      );

      return {
        userName: plan.userName,
        status: plan.status,
        recipes,
      };
    })
  );

  return JSON.stringify({
    weekId,
    plans: plansWithDetails,
    message: `${plans.length} people have plans for ${weekId}.`,
  });
}
