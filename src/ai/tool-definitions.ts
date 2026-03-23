import Anthropic from "@anthropic-ai/sdk";

type Tool = Anthropic.Tool;

export const tools: Tool[] = [
  {
    name: "save_recipe",
    description:
      "Save a new recipe to the database. Use this when a user shares a recipe via text or when you've extracted recipe details from an image. Always confirm the parsed details with the user before saving.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Recipe name" },
        ingredients: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              quantity: {
                type: "string",
                description: "e.g. '2', '1/2', '3-4'",
              },
              unit: {
                type: "string",
                description: "e.g. 'cups', 'tbsp', 'lbs', 'pieces'",
              },
            },
            required: ["name"],
          },
          description: "List of ingredients with quantities",
        },
        instructions: {
          type: "string",
          description: "Cooking instructions",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Category tags like 'pasta', 'chicken', 'vegetarian', 'quick', 'mexican'",
        },
        servings: { type: "string", description: "Number of servings" },
        prepTime: { type: "string", description: "Prep time" },
        cookTime: { type: "string", description: "Cook time" },
        sourceUrl: {
          type: "string",
          description: "URL if the recipe came from the web",
        },
      },
      required: ["name", "ingredients", "instructions", "tags"],
    },
  },
  {
    name: "search_recipes",
    description:
      "Search the recipe database by name, tags, or ingredients. Call with no query or tags to list ALL saved recipes. Results include full ingredient lists, so you can compile a consolidated recipe list from search results alone without needing get_recipe for each one.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Free text search term to match against recipe names, tags, and ingredients",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by specific tags",
        },
        limit: {
          type: "number",
          description: "Max results to return. Default 10.",
        },
      },
    },
  },
  {
    name: "get_recipe",
    description:
      "Get full details of a specific recipe by its ID, including all reviews.",
    input_schema: {
      type: "object" as const,
      properties: {
        recipeId: { type: "string", description: "The unique recipe ID" },
      },
      required: ["recipeId"],
    },
  },
  {
    name: "save_review",
    description:
      "Save a user's review/rating of a recipe with detailed taste insights. Auto-extract component-level opinions and reuse signals from the user's casual feedback. Always save immediately without asking for confirmation.",
    input_schema: {
      type: "object" as const,
      properties: {
        recipeId: {
          type: "string",
          description: "The recipe being reviewed",
        },
        rating: {
          type: "number",
          description: "Overall rating from 1 to 5",
        },
        comment: {
          type: "string",
          description:
            "The user's original review text, preserved as-is",
        },
        insights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              component: {
                type: "string",
                description:
                  "Specific component being evaluated, e.g. 'red sauce', 'chicken', 'seasoning', 'overall'",
              },
              sentiment: {
                type: "string",
                enum: ["loved", "liked", "neutral", "disliked"],
                description: "How the user felt about this component",
              },
              note: {
                type: "string",
                description:
                  "Additional context, e.g. 'wants to reuse on other dishes'",
              },
            },
            required: ["component", "sentiment"],
          },
          description:
            "Component-level taste insights extracted from the user's feedback",
        },
        reuseSignals: {
          type: "array",
          items: { type: "string" },
          description:
            "Things the user wants to reuse or see again, e.g. 'that red sauce on other pasta dishes'",
        },
      },
      required: ["recipeId", "rating"],
    },
  },
  {
    name: "get_weekly_plan",
    description:
      "Get a user's meal plan for a specific week. If no weekId is provided, returns the current week's plan.",
    input_schema: {
      type: "object" as const,
      properties: {
        weekId: {
          type: "string",
          description: "ISO week identifier like '2026-W10'. Defaults to current week.",
        },
        userId: {
          type: "string",
          description: "Get a specific user's plan. Defaults to the requesting user.",
        },
      },
    },
  },
  {
    name: "save_weekly_plan",
    description:
      "Save or update a user's weekly meal plan.",
    input_schema: {
      type: "object" as const,
      properties: {
        weekId: { type: "string", description: "ISO week like '2026-W10'" },
        recipeIds: {
          type: "array",
          items: { type: "string" },
          description: "List of recipe IDs selected for this week",
        },
        status: {
          type: "string",
          enum: ["draft", "finalized"],
          description: "Whether the plan is still being edited or finalized",
        },
      },
      required: ["weekId", "recipeIds"],
    },
  },
  {
    name: "generate_grocery_list",
    description:
      "Generate an aggregated grocery/shopping list from a set of recipes. Combines duplicate ingredients and sums quantities.",
    input_schema: {
      type: "object" as const,
      properties: {
        recipeIds: {
          type: "array",
          items: { type: "string" },
          description: "Recipe IDs to generate the grocery list from",
        },
        excludeItems: {
          type: "array",
          items: { type: "string" },
          description: "Ingredients the user already has (e.g. 'olive oil', 'salt')",
        },
        weekId: {
          type: "string",
          description: "Week to associate this grocery list with",
        },
      },
      required: ["recipeIds"],
    },
  },
  {
    name: "update_grocery_list",
    description:
      "Update an existing grocery list by removing items the user already has.",
    input_schema: {
      type: "object" as const,
      properties: {
        weekId: { type: "string" },
        removeItems: {
          type: "array",
          items: { type: "string" },
          description: "Items to remove from the list",
        },
      },
      required: ["weekId", "removeItems"],
    },
  },
  {
    name: "search_web_for_recipes",
    description:
      "Search the internet for new recipe ideas. Use this when users want inspiration or ask for recipes not in the database.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query, e.g. 'easy weeknight Thai curry recipe'",
        },
        count: {
          type: "number",
          description: "Number of results to return. Default 5.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_all_week_plans",
    description:
      "Get all users' plans for a given week. Useful to see what everyone is making.",
    input_schema: {
      type: "object" as const,
      properties: {
        weekId: {
          type: "string",
          description: "ISO week like '2026-W10'. Defaults to current week.",
        },
      },
    },
  },
];
