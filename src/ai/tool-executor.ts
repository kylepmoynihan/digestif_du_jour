import { handleSaveRecipe } from "../tools/save-recipe";
import { handleSearchRecipes } from "../tools/search-recipes";
import { handleGetRecipe } from "../tools/get-recipe";
import { handleSaveReview } from "../tools/save-review";
import { handleGetWeeklyPlan } from "../tools/get-weekly-plan";
import { handleSaveWeeklyPlan } from "../tools/save-weekly-plan";
import { handleGenerateGroceryList } from "../tools/generate-grocery-list";
import { handleUpdateGroceryList } from "../tools/update-grocery-list";
import { handleSearchWeb } from "../tools/search-web";
import { handleGetAllWeekPlans } from "../tools/get-all-week-plans";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolInput = any;

export async function executeTool(
  toolName: string,
  toolInput: ToolInput,
  userId: number,
  userName: string
): Promise<string> {
  try {
    switch (toolName) {
      case "save_recipe":
        return await handleSaveRecipe(toolInput, userId, userName);
      case "search_recipes":
        return await handleSearchRecipes(toolInput);
      case "get_recipe":
        return await handleGetRecipe(toolInput);
      case "save_review":
        return await handleSaveReview(toolInput, userId, userName);
      case "get_weekly_plan":
        return await handleGetWeeklyPlan(toolInput, userId);
      case "save_weekly_plan":
        return await handleSaveWeeklyPlan(toolInput, userId, userName);
      case "generate_grocery_list":
        return await handleGenerateGroceryList(toolInput, userId);
      case "update_grocery_list":
        return await handleUpdateGroceryList(toolInput, userId);
      case "search_web_for_recipes":
        return await handleSearchWeb(toolInput);
      case "get_all_week_plans":
        return await handleGetAllWeekPlans(toolInput);
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error) {
    console.error(`Tool ${toolName} failed:`, error);
    return JSON.stringify({
      error: `Tool ${toolName} failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}
