export function recipeKey(recipeId: string) {
  return { PK: `RECIPE#${recipeId}`, SK: "METADATA" };
}

export function reviewKey(recipeId: string, userId: number) {
  return { PK: `RECIPE#${recipeId}`, SK: `REVIEW#${userId}` };
}

export function planKey(userId: number, weekId: string) {
  return { PK: `USER#${userId}`, SK: `PLAN#${weekId}` };
}

export function groceryKey(userId: number, weekId: string) {
  return { PK: `USER#${userId}`, SK: `GROCERY#${weekId}` };
}

export function userKey(userId: number) {
  return { PK: `USER#${userId}`, SK: "PROFILE" };
}

export function conversationKey(userId: number, chatId: number) {
  return { PK: `USER#${userId}`, SK: `CONVO#${chatId}` };
}

export function tasteProfileKey(userId: number) {
  return { PK: `USER#${userId}`, SK: "TASTE_PROFILE" };
}

// GSI1 keys
export function recipeGSI1(createdAt: string, recipeId: string) {
  return { GSI1PK: "RECIPES", GSI1SK: `${createdAt}#${recipeId}` };
}

export function reviewGSI1(userId: number, createdAt: string) {
  return { GSI1PK: `USER#${userId}`, GSI1SK: `REVIEW#${createdAt}` };
}

export function planGSI1(weekId: string, userId: number) {
  return { GSI1PK: `WEEK#${weekId}`, GSI1SK: `USER#${userId}` };
}
