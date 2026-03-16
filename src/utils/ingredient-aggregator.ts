import { RecipeIngredient } from "../db/recipes";
import { GroceryItem } from "../db/grocery";

/**
 * Aggregate ingredients across multiple recipes.
 * Combines duplicates by name+unit and sums quantities.
 */
export function aggregateIngredients(
  recipesIngredients: { recipeName: string; ingredients: RecipeIngredient[] }[],
  excludeItems?: string[]
): GroceryItem[] {
  const map = new Map<string, GroceryItem>();
  const excludeSet = new Set(
    (excludeItems || []).map((i) => i.toLowerCase().trim())
  );

  for (const recipe of recipesIngredients) {
    for (const ing of recipe.ingredients) {
      const name = ing.name.toLowerCase().trim();
      if (excludeSet.has(name)) continue;

      const unit = (ing.unit || "").toLowerCase().trim();
      const key = `${name}|${unit}`;

      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.quantity = addQuantities(existing.quantity, ing.quantity || "");
        if (!existing.fromRecipes.includes(recipe.recipeName)) {
          existing.fromRecipes.push(recipe.recipeName);
        }
      } else {
        map.set(key, {
          name: ing.name.trim(),
          quantity: ing.quantity || "",
          unit: unit,
          fromRecipes: [recipe.recipeName],
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function addQuantities(a: string, b: string): string {
  const numA = parseFloat(a);
  const numB = parseFloat(b);

  if (!isNaN(numA) && !isNaN(numB)) {
    const sum = numA + numB;
    // Clean up: 2.0 -> "2", 2.5 -> "2.5"
    return sum % 1 === 0 ? sum.toString() : sum.toFixed(1);
  }

  // Can't parse as numbers, just concatenate
  if (a && b) return `${a} + ${b}`;
  return a || b;
}
