import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client";
import { groceryKey } from "./keys";

export interface GroceryItem {
  name: string;
  quantity: string;
  unit: string;
  fromRecipes: string[];
}

export interface GroceryList {
  userId: number;
  weekId: string;
  items: GroceryItem[];
  removedItems: string[];
  createdAt: string;
}

export async function saveGroceryList(
  userId: number,
  weekId: string,
  items: GroceryItem[]
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...groceryKey(userId, weekId),
        userId,
        weekId,
        items,
        removedItems: [],
        createdAt: new Date().toISOString(),
      },
    })
  );
}

export async function getGroceryList(
  userId: number,
  weekId: string
): Promise<GroceryList | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: groceryKey(userId, weekId) })
  );

  return (result.Item as GroceryList) || null;
}

export async function removeGroceryItems(
  userId: number,
  weekId: string,
  itemsToRemove: string[]
): Promise<GroceryList | null> {
  const list = await getGroceryList(userId, weekId);
  if (!list) return null;

  const removeSet = new Set(itemsToRemove.map((i) => i.toLowerCase()));

  const updatedItems = list.items.filter(
    (item) => !removeSet.has(item.name.toLowerCase())
  );
  const removedItems = [...list.removedItems, ...itemsToRemove];

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...groceryKey(userId, weekId),
        userId,
        weekId,
        items: updatedItems,
        removedItems,
        createdAt: list.createdAt,
      },
    })
  );

  return { ...list, items: updatedItems, removedItems };
}
