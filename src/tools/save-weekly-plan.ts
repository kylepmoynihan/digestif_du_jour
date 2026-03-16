import { saveWeeklyPlan } from "../db/plans";
import { getISOWeekId } from "../utils/week";

interface SaveWeeklyPlanInput {
  weekId?: string;
  recipeIds: string[];
  status?: "draft" | "finalized";
}

export async function handleSaveWeeklyPlan(
  input: SaveWeeklyPlanInput,
  userId: number,
  userName: string
): Promise<string> {
  const weekId = input.weekId || getISOWeekId();

  await saveWeeklyPlan(
    userId,
    userName,
    weekId,
    input.recipeIds,
    input.status || "draft"
  );

  return JSON.stringify({
    success: true,
    weekId,
    recipeCount: input.recipeIds.length,
    status: input.status || "draft",
    message: `Weekly plan saved with ${input.recipeIds.length} recipes for ${weekId}.`,
  });
}
