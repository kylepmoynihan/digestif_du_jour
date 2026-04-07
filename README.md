# Digestif Du Jour

A Telegram bot that serves as a personal cooking assistant for a group of 5 friends (Kyle, Marcus, Andrew, Austin, Luis) who share a cook named Irene in Mexico.

Bot: [@digestif_bot](https://t.me/digestif_bot)
GitHub: [kylepmoynihan/digestif_du_jout](https://github.com/kylepmoynihan/digestif_du_jout)

## What It Does

- **Recipe management** — Save recipes via text, screenshots (OCR), or Spanish conversation screenshots from Irene
- **Weekly meal planning** — Plan meals for the week, see what others are making
- **Grocery list generation** — Aggregates ingredients from selected recipes, groups by category
- **Taste profile learning** — Automatically extracts component-level opinions from casual reviews and builds a preference profile over time
- **Recipe discovery** — Combines database search, AI knowledge, and Brave web search, filtered through taste preferences
- **Bilingual support** — English for users, Mexican Spanish for Irene (with metric units)

## Architecture

```
Telegram → API Gateway → Receiver Lambda → (async) → Processor Lambda → Telegram
                                                          ↓
                                                    Claude Haiku 4.5
                                                    DynamoDB (single table)
                                                    Brave Search API
```

**Two Lambda architecture:**
- **Receiver** (128MB, 10s timeout) — Validates the webhook, deduplicates update_ids, checks user allowlist, and asynchronously invokes the Processor. Returns 200 immediately so Telegram doesn't retry.
- **Processor** (512MB, 120s timeout) — Loads conversation history + taste profile, sends to Claude with tools, executes tool calls in a loop (max 5 rounds), sends response to Telegram.

**DynamoDB single-table design** with PK/SK + GSI1. See [docs/architecture.md](docs/architecture.md) for key schema.

## Setup

### Prerequisites

- Node.js 20+
- AWS CLI configured with credentials
- AWS CDK CLI (`npm install -g aws-cdk` or use npx)
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))
- An Anthropic API key
- A Brave Search API key (for recipe discovery)

### Environment Variables

Create a `.env` file in the project root:

```
BOT_TOKEN=your-telegram-bot-token
ANTHROPIC_API_KEY=your-anthropic-api-key
BRAVE_SEARCH_API_KEY=your-brave-search-api-key
ALLOWED_USER_IDS=123456789,987654321
```

`ALLOWED_USER_IDS` is a comma-separated list of Telegram user IDs that are allowed to use the bot.

### Deploy

```bash
npm install
export $(grep -v '^#' .env | xargs) && npx cdk deploy --require-approval never
```

The deploy will output the webhook URL. Register it with Telegram:

```bash
./scripts/set-webhook.sh https://YOUR-API-GATEWAY-URL/prod/webhook
```

### Current Deployment

- AWS Account: `557712821985`, Region: `us-east-1`
- Stack: `DigestifDuJour`
- Webhook: `https://uoq39e3iy9.execute-api.us-east-1.amazonaws.com/prod/webhook`

## Project Structure

```
src/
  ai/
    claude-client.ts      # Claude API wrapper with tool-use loop
    system-prompt.ts      # System prompt (bilingual, review extraction, etc.)
    tool-definitions.ts   # Tool schemas Claude can call
    tool-executor.ts      # Routes tool calls to handlers
  db/
    client.ts             # DynamoDB client
    keys.ts               # PK/SK key patterns for all entity types
    conversation.ts       # Conversation history (for context between messages)
    recipes.ts            # Recipe CRUD + search
    reviews.ts            # Review storage + recipe rating denormalization
    taste-profile.ts      # Taste profile accumulation + serialization
    plans.ts              # Weekly meal plans
    grocery.ts            # Grocery list storage
    users.ts              # User profile upsert
  telegram/
    parse-update.ts       # Parse Telegram webhook updates
    send-message.ts       # Send messages (with Markdown retry fallback)
    download-photo.ts     # Download photos for OCR via Claude
    types.ts              # Telegram type definitions
  tools/
    save-recipe.ts        # Save a new recipe
    search-recipes.ts     # Search/list recipes from database
    get-recipe.ts         # Get full recipe details
    save-review.ts        # Save review + trigger taste profile update
    save-weekly-plan.ts   # Save/update weekly meal plan
    get-weekly-plan.ts    # Get a user's weekly plan
    get-all-week-plans.ts # Get all users' plans for a week
    generate-grocery-list.ts  # Aggregate ingredients from recipes
    update-grocery-list.ts    # Remove items from grocery list
    search-web.ts         # Brave Search API for recipe discovery
  utils/
    auth.ts               # User allowlist check
    ingredient-aggregator.ts  # Smart ingredient combining
    ulid.ts               # ULID generation for IDs
    week.ts               # ISO week calculation
  processor.ts            # Main Processor Lambda handler
  receiver.ts             # Receiver Lambda handler
infra/
  app.ts                  # CDK app entry point
  digestif-stack.ts       # CDK stack (DynamoDB, Lambdas, API Gateway)
scripts/
  set-webhook.sh          # Register Telegram webhook
```

## Cost Guardrails

- **retryAttempts: 0** on Processor Lambda — prevents duplicate Claude calls on async invoke failures
- **MAX_TOOL_ROUNDS: 5** — caps the number of tool-use loop iterations per message
- **120s timeout** — prevents runaway executions
- **Receiver dedup** — in-memory Set of recent update_ids to skip Telegram webhook retries
- **Model: Claude Haiku 4.5** — ~3-4x cheaper than Sonnet per token. Estimated ~$0.06-0.08 per conversation vs. ~$0.25+ with Sonnet.
- **max_tokens: 1024** — keeps output concise

## Key Design Decisions

See [docs/architecture.md](docs/architecture.md) for detailed rationale on all decisions.
