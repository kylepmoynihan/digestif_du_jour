# Architecture & Design Decisions

## Overview

Digestif Du Jour is a serverless Telegram bot built on AWS (Lambda, DynamoDB, API Gateway) with Claude AI for natural language understanding and tool execution. It manages recipes, meal planning, grocery lists, and taste preference learning for a group of 5 friends who share a cook in Mexico.

## System Architecture

### Request Flow

```
User sends message in Telegram
    ↓
Telegram delivers webhook POST to API Gateway
    ↓
API Gateway → Receiver Lambda (sync, 10s max)
    - Parses update
    - Deduplicates by update_id (in-memory Set)
    - Checks user allowlist (ALLOWED_USER_IDS env var)
    - If group chat: only responds to @mentions or replies to bot
    - Invokes Processor Lambda asynchronously (InvocationType: "Event")
    - Returns 200 OK immediately
    ↓
Processor Lambda (async, 120s max)
    - Parses the Telegram update again
    - Upserts user profile in DynamoDB
    - Loads conversation history + taste profile in parallel
    - If message has photos: downloads via Telegram API, base64 encodes
    - Sends to Claude with system prompt + tools + conversation history
    - Executes tool calls in a loop (max 5 rounds)
    - Saves updated conversation history
    - Sends response text to Telegram
```

### Why Two Lambdas?

Telegram webhooks require a response within ~60 seconds or it retries. Claude + tool execution can take 10-30 seconds. The two-Lambda pattern ensures:
1. Telegram always gets an immediate 200 OK (no retries)
2. Processor can take up to 120 seconds without webhook timeout issues
3. Receiver stays cheap (128MB, fast execution)

## DynamoDB Single-Table Design

One table (`DigestifDuJour`) with PK/SK pattern + one GSI.

### Key Schema

| Entity | PK | SK | GSI1PK | GSI1SK |
|--------|----|----|--------|--------|
| Recipe | `RECIPE#{id}` | `METADATA` | `RECIPES` | `{createdAt}#{id}` |
| Review | `RECIPE#{id}` | `REVIEW#{userId}` | `USER#{userId}` | `REVIEW#{createdAt}` |
| User Profile | `USER#{userId}` | `PROFILE` | — | — |
| Taste Profile | `USER#{userId}` | `TASTE_PROFILE` | — | — |
| Conversation | `USER#{userId}` | `CONVO#{chatId}` | — | — |
| Weekly Plan | `USER#{userId}` | `PLAN#{weekId}` | `WEEK#{weekId}` | `USER#{userId}` |
| Grocery List | `USER#{userId}` | `GROCERY#{weekId}` | — | — |

### Access Patterns

- **Get recipe by ID**: Query `PK=RECIPE#{id}, SK=METADATA`
- **Get all reviews for a recipe**: Query `PK=RECIPE#{id}, SK begins_with REVIEW#`
- **List all recipes (newest first)**: Query GSI1 `GSI1PK=RECIPES`, sorted by GSI1SK
- **Search recipes by text/tags**: Scan with filter (acceptable for small dataset)
- **Get user's reviews**: Query GSI1 `GSI1PK=USER#{id}, GSI1SK begins_with REVIEW#`
- **Get all plans for a week**: Query GSI1 `GSI1PK=WEEK#{weekId}`
- **Get user's conversation context**: Query `PK=USER#{id}, SK=CONVO#{chatId}`
- **Get user's taste profile**: Query `PK=USER#{id}, SK=TASTE_PROFILE`

### TTL

- Conversation history items have a `ttl` attribute set to auto-expire old contexts (prevents unbounded storage growth).

## AI Layer

### Model Choice: Claude Haiku 4.5

**Model ID**: `claude-haiku-4-5-20251001`
**max_tokens**: 1024

Previously used Sonnet 4, switched to Haiku 4.5 for cost. Sonnet was ~$0.25 per half-conversation; Haiku is ~3-4x cheaper. Haiku handles all use cases well: OCR, Spanish, tool use, review extraction, recipe parsing.

**Pricing** (as of March 2026):
| Model | Input/1M tokens | Output/1M tokens |
|-------|----------------|-----------------|
| Sonnet 4 | $3.00 | $15.00 |
| Haiku 4.5 | $0.80 | $4.00 |

**Important**: Claude Max subscription ($100/mo) does NOT cover API usage. API is billed separately per-token through the Anthropic Console. These are completely separate billing systems.

### Tool-Use Loop

Claude has access to 10 tools. The Processor runs a tool-use loop:

1. Send message + tools to Claude
2. If Claude returns `tool_use` blocks, execute each tool
3. Send tool results back to Claude
4. Repeat until Claude returns text-only or MAX_TOOL_ROUNDS (5) is reached

**Tools available:**
| Tool | Purpose |
|------|---------|
| `save_recipe` | Save a new recipe (parsed from text, screenshots, or Spanish conversations) |
| `search_recipes` | Search/list recipes from database. No args = list all. Returns full ingredients. |
| `get_recipe` | Get full recipe details + all reviews by ID |
| `save_review` | Save a review with auto-extracted taste insights + trigger taste profile update |
| `get_weekly_plan` | Get a user's meal plan for a specific week |
| `save_weekly_plan` | Save/update a weekly meal plan |
| `get_all_week_plans` | Get all users' plans for a given week |
| `generate_grocery_list` | Aggregate ingredients from recipes into a categorized shopping list |
| `update_grocery_list` | Remove items from an existing grocery list |
| `search_web_for_recipes` | Search the internet (Brave API) for new recipe ideas |

### System Prompt

The system prompt (`src/ai/system-prompt.ts`) instructs Claude on:
- **Recipe ingestion**: Parse from text, screenshots, Spanish conversations
- **Review extraction**: Auto-extract component-level opinions (e.g., "red sauce = loved, overall = neutral"), map natural language to 1-5 ratings, identify reuse signals. Save immediately without confirmation.
- **Recipe discovery**: Database search + AI knowledge + Brave web search, filtered through taste profile
- **Bilingual support**: English for users, Mexican Spanish for Irene ("tú" form, colloquial terms, metric units)
- **Unit conversion**: Imperial ↔ metric, metric default for Irene
- **Telegram formatting**: Markdown, concise messages, include recipe IDs

The user's taste profile (if it exists) is appended to the system prompt dynamically.

## Taste Profile System

### How It Works

1. User casually reviews a recipe in chat (e.g., "the ziti was mid but that red sauce was fire")
2. Claude auto-extracts structured insights via the `save_review` tool:
   - component: "red sauce", sentiment: "loved"
   - component: "overall/ziti", sentiment: "neutral"
   - reuseSignals: ["that red sauce on other dishes"]
3. `save_review` triggers `updateTasteProfile()` which:
   - Adjusts cuisine scores by `(rating - 3)` per cuisine tag
   - Tracks component notes with sentiment counts
   - Manages reuse requests and favorite recipes
   - Recomputes derived arrays (top cuisines, specific likes/dislikes)
4. On the next message, the serialized taste profile is injected into the system prompt

### Profile Structure

```typescript
interface TasteProfile {
  // Derived (injected into prompt)
  favoriteCuisines: string[];     // max 5, from positive cuisine scores
  dislikedCuisines: string[];     // max 3, from negative cuisine scores
  specificLikes: string[];         // max 8, components with "loved"/"liked" sentiment
  specificDislikes: string[];      // max 5, components with "disliked" sentiment
  reuseRequests: string[];         // max 5, things user wants to see again
  favoriteRecipes: { id, name }[]; // max 5, recipes rated >= 4

  // Internal tracking
  cuisineScores: Record<string, number>;  // running score per cuisine tag
  componentNotes: ComponentNote[];         // component + sentiment + count
  totalReviews: number;
}
```

### Scoring

- Each review adjusts cuisine scores by `rating - 3` (so 5 = +2, 3 = 0, 1 = -2)
- Components with "loved" sentiment (even once) are added to specificLikes
- Components need count >= 2 for "liked" to become a specificLike
- Components need count >= 2 for "disliked" to become a specificDislike

## Cost Guardrails

Multiple layers to prevent cost overruns:

1. **retryAttempts: 0** — Lambda async invoke retries disabled. Without this, a failed Claude call would retry 2 more times (default), tripling the cost.
2. **MAX_TOOL_ROUNDS: 5** — Prevents unbounded tool-use loops. Even if Claude keeps requesting tools, it stops after 5 rounds.
3. **120s Lambda timeout** — Hard cutoff on execution time.
4. **Receiver dedup** — In-memory Set of recent update_ids prevents processing the same Telegram message twice.
5. **Haiku 4.5 model** — ~3-4x cheaper than Sonnet per token.
6. **max_tokens: 1024** — Keeps output concise, reduces output token cost.
7. **MAX_HISTORY_MESSAGES: 10** — Limits conversation context sent to Claude (less input tokens per call).
8. **Telegram Markdown retry** — If Markdown formatting fails, retries once without formatting (empty options, no further retry) to prevent infinite recursion.

## Known Issues & History

### Resolved

- **Anthropic API key not deployed** — First deploy after code changes didn't source `.env`, so all secrets were empty strings. Fix: Always deploy with `export $(grep -v '^#' .env | xargs) && npx cdk deploy`.
- **sendTelegramMessage infinite recursion** — When Markdown parsing failed, the retry path could recurse infinitely. Fixed by passing empty options `{}` on retry.
- **Recipe list incomplete** — MAX_TOOL_ROUNDS was 3, and listing all recipes required search + multiple get_recipe calls. Fixed by bumping to 5 and enriching search_recipes to return full ingredient lists.
- **CDK deploy hanging** — CDK buffers all stdout, causing timeout issues when run as a background task. Solution: run in foreground with long timeout or in a separate terminal.
- **CDK version mismatch** — aws-cdk CLI and aws-cdk-lib have different version schemes. Pinned in package.json: `"aws-cdk": "2.1109.0"`, `"aws-cdk-lib": "2.241.0"`, `"constructs": "10.5.1"`.
- **Local git hanging** — macOS Xcode's git has an fsmonitor issue that causes `git add` to hang. Workaround: push to GitHub via `gh api` (GitHub API) instead of local git.

### API Error 529

The Anthropic API occasionally returns 529 ("API Overloaded") during high-traffic periods. This is transient and affects all models equally. The bot currently does not retry on 529 — the user receives the generic error message and needs to resend.

**Potential improvement**: Add a single retry with backoff specifically for 529 errors in `claude-client.ts`.

## Deployment

### Prerequisites

- AWS CLI configured
- Node.js 20+
- `.env` file with secrets (BOT_TOKEN, ANTHROPIC_API_KEY, BRAVE_SEARCH_API_KEY, ALLOWED_USER_IDS)

### Deploy Command

```bash
export $(grep -v '^#' .env | xargs) && npx cdk deploy --require-approval never
```

**Important**: Always source `.env` before deploying. CDK reads environment variables at synth time and bakes them into the Lambda configuration. If you forget, all secrets will be empty strings.

### Push to GitHub

Local git hangs due to macOS Xcode fsmonitor. Use GitHub API instead:

```bash
# Upload a single file
CONTENT=$(base64 < path/to/file)
CURRENT_SHA=$(gh api "repos/kylepmoynihan/digestif_du_jout/contents/path/to/file" --jq '.sha')
gh api "repos/kylepmoynihan/digestif_du_jout/contents/path/to/file" \
  -X PUT -f "message=your commit message" -f "content=$CONTENT" -f "sha=$CURRENT_SHA"
```

For bulk pushes, use the Git Data API (create blobs → create tree → create commit → update ref). See conversation history for the full script.

### Current Infrastructure

- **AWS Account**: 557712821985
- **Region**: us-east-1
- **Stack**: DigestifDuJour
- **DynamoDB Table**: DigestifDuJour
- **Webhook URL**: https://uoq39e3iy9.execute-api.us-east-1.amazonaws.com/prod/webhook
- **Telegram Bot**: @digestif_bot

## Users

| Name | Role |
|------|------|
| Kyle | Owner/developer, friend |
| Marcus | Friend |
| Andrew | Friend |
| Austin | Friend |
| Luis | Friend |
| Irene | Cook (Mexican, communicates in Spanish, receives recipes in Spanish with metric units) |

All users are located in Mexico.

## Future Considerations

- **529 retry handling** — Add single retry with exponential backoff for Anthropic API overload errors
- **Hybrid model routing** — Use Haiku for simple messages, Sonnet for image OCR / complex tasks (if Haiku quality proves insufficient)
- **System prompt optimization** — The current prompt is ~600 tokens. Could be compressed further to reduce per-call input costs.
- **Prompt caching** — Anthropic supports prompt caching which could reduce costs for the static system prompt portion.
