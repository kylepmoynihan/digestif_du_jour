import { removeGroceryItems } from "../db/grocery";
import { getISOWeekId } from "../utils/week";

interface UpdateGroceryListInput {
  weekId?: string;
  removeItems: string[];
}

export async function handleUpdateGroceryList(
  input: UpdateGroceryListInput,
  userId: number
): Promise<string> {
  const weekId = input.weekId || getISOWeekId();

  const updated = await removeGroceryItems(userId, weekId, input.removeItems);

  if (!updated) {
    return JSON.stringify({
      success: false,
      message: `No grocery list found for week ${weekId}. Generate one first.`,
    });
  }

  return JSON.stringify({
    success: true,
    weekId,
    remainingItems: updated.items.length,
    removedItems: input.removeItems,
    items: updated.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
    })),
    message: `Removed ${input.removeItems.length} items. ${updated.items.length} items remaining.`,
  });
}
