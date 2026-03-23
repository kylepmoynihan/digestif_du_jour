import { searchRecipes } from "../db/recipes";

interface SearchRecipesInput {
  query?: string;
  tags?: string[];
  limit?: number;
}

export async function handleSearchRecipes(
  input: SearchRecipesInput
): Promise<string> {
  const recipes = await searchRecipes({
    query: input.query,
    tags: input.tags,
    limit: input.limit,
  });

  if (recipes.length === 0) {
    return JSON.stringify({
      results: [],
      message: "No recipes found matching your criteria.",
    });
  }

  const results = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    tags: r.tags,
    addedByName: r.addedByName,
    ingredients: r.ingredients.map((i) =>
      [i.quantity, i.unit, i.name].filter(Boolean).join(" ")
    ),
    avgRating: r.avgRating,
    reviewCount: r.reviewCount,
  }));

  return JSON.stringify({ results, total: results.length });
}
