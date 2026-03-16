import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client";
import { tasteProfileKey } from "./keys";

export interface ReviewInsight {
  component: string;
  sentiment: "loved" | "liked" | "neutral" | "disliked";
  note?: string;
}

interface ComponentNote {
  component: string;
  sentiment: string;
  count: number;
}

export interface TasteProfile {
  userId: number;

  // Derived arrays (injected into system prompt)
  favoriteCuisines: string[];
  dislikedCuisines: string[];
  specificLikes: string[];
  specificDislikes: string[];
  reuseRequests: string[];
  favoriteRecipes: { id: string; name: string }[];

  // Internal tracking (used for computation, not in prompt)
  cuisineScores: Record<string, number>;
  componentNotes: ComponentNote[];
  totalReviews: number;

  updatedAt: string;
}

const MAX_FAVORITE_CUISINES = 5;
const MAX_DISLIKED_CUISINES = 3;
const MAX_SPECIFIC_LIKES = 8;
const MAX_SPECIFIC_DISLIKES = 5;
const MAX_REUSE_REQUESTS = 5;
const MAX_FAVORITE_RECIPES = 5;

function emptyProfile(userId: number): TasteProfile {
  return {
    userId,
    favoriteCuisines: [],
    dislikedCuisines: [],
    specificLikes: [],
    specificDislikes: [],
    reuseRequests: [],
    favoriteRecipes: [],
    cuisineScores: {},
    componentNotes: [],
    totalReviews: 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function getTasteProfile(
  userId: number
): Promise<TasteProfile | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: tasteProfileKey(userId) })
  );
  return (result.Item as TasteProfile) || null;
}

export interface ReviewData {
  recipeId: string;
  recipeName: string;
  rating: number;
  insights: ReviewInsight[];
  reuseSignals: string[];
  cuisineTags: string[];
}

export async function updateTasteProfile(
  userId: number,
  data: ReviewData
): Promise<void> {
  const profile = (await getTasteProfile(userId)) || emptyProfile(userId);

  profile.totalReviews++;

  // Update cuisine scores: (rating - 3) so 5=+2, 4=+1, 3=0, 2=-1, 1=-2
  const delta = data.rating - 3;
  for (const tag of data.cuisineTags) {
    const key = tag.toLowerCase();
    profile.cuisineScores[key] = (profile.cuisineScores[key] || 0) + delta;
  }

  // Update component notes from insights
  for (const insight of data.insights) {
    const comp = insight.component.toLowerCase();
    const existing = profile.componentNotes.find(
      (n) => n.component === comp && n.sentiment === insight.sentiment
    );
    if (existing) {
      existing.count++;
    } else {
      profile.componentNotes.push({
        component: comp,
        sentiment: insight.sentiment,
        count: 1,
      });
    }
  }

  // Append reuse signals (most recent first, capped)
  for (const signal of data.reuseSignals) {
    // Avoid duplicates
    if (
      !profile.reuseRequests.some(
        (r) => r.toLowerCase() === signal.toLowerCase()
      )
    ) {
      profile.reuseRequests.unshift(signal);
    }
  }
  profile.reuseRequests = profile.reuseRequests.slice(0, MAX_REUSE_REQUESTS);

  // Update favorite recipes (rating >= 4)
  if (data.rating >= 4) {
    const exists = profile.favoriteRecipes.some((r) => r.id === data.recipeId);
    if (!exists) {
      profile.favoriteRecipes.unshift({
        id: data.recipeId,
        name: data.recipeName,
      });
      profile.favoriteRecipes = profile.favoriteRecipes.slice(
        0,
        MAX_FAVORITE_RECIPES
      );
    }
  }

  // Recompute derived arrays from scores
  recomputeDerivedArrays(profile);

  profile.updatedAt = new Date().toISOString();

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...tasteProfileKey(userId),
        ...profile,
      },
    })
  );
}

function recomputeDerivedArrays(profile: TasteProfile): void {
  // Favorite cuisines: top positive scores
  const sortedCuisines = Object.entries(profile.cuisineScores).sort(
    ([, a], [, b]) => b - a
  );
  profile.favoriteCuisines = sortedCuisines
    .filter(([, score]) => score > 0)
    .slice(0, MAX_FAVORITE_CUISINES)
    .map(([tag]) => tag);

  // Disliked cuisines: most negative scores
  profile.dislikedCuisines = sortedCuisines
    .filter(([, score]) => score < 0)
    .slice(-MAX_DISLIKED_CUISINES)
    .reverse()
    .map(([tag]) => tag);

  // Specific likes: components with "loved" or "liked" sentiment, count >= 2
  const likedComponents = profile.componentNotes
    .filter(
      (n) =>
        (n.sentiment === "loved" || n.sentiment === "liked") && n.count >= 2
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_SPECIFIC_LIKES)
    .map((n) => n.component);

  // Also include components with "loved" even with count 1 (strong signal)
  const lovedOnce = profile.componentNotes
    .filter(
      (n) =>
        n.sentiment === "loved" &&
        n.count === 1 &&
        !likedComponents.includes(n.component)
    )
    .map((n) => n.component);

  profile.specificLikes = [...likedComponents, ...lovedOnce].slice(
    0,
    MAX_SPECIFIC_LIKES
  );

  // Specific dislikes: components with "disliked" sentiment, count >= 2
  profile.specificDislikes = profile.componentNotes
    .filter((n) => n.sentiment === "disliked" && n.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_SPECIFIC_DISLIKES)
    .map((n) => n.component);
}

export function serializeTasteProfileForPrompt(
  profile: TasteProfile
): string {
  const lines: string[] = [];

  if (profile.favoriteCuisines.length > 0) {
    lines.push(`Favorite cuisines: ${profile.favoriteCuisines.join(", ")}`);
  }
  if (profile.dislikedCuisines.length > 0) {
    lines.push(`Tends to dislike: ${profile.dislikedCuisines.join(", ")}`);
  }
  if (profile.specificLikes.length > 0) {
    lines.push(`Loves: ${profile.specificLikes.join(", ")}`);
  }
  if (profile.specificDislikes.length > 0) {
    lines.push(`Dislikes: ${profile.specificDislikes.join(", ")}`);
  }
  if (profile.reuseRequests.length > 0) {
    lines.push(
      `Reuse requests: ${profile.reuseRequests.map((r) => `"${r}"`).join("; ")}`
    );
  }
  if (profile.favoriteRecipes.length > 0) {
    const favs = profile.favoriteRecipes
      .map((r) => `${r.name} (${r.id})`)
      .join(", ");
    lines.push(`Top rated recipes: ${favs}`);
  }

  lines.push(`Total reviews: ${profile.totalReviews}`);

  return lines.join("\n");
}
