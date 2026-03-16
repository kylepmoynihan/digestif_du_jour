import Anthropic from "@anthropic-ai/sdk";
import { tools } from "./tool-definitions";
import { buildSystemPrompt } from "./system-prompt";
import { executeTool } from "./tool-executor";

const client = new Anthropic();

const MAX_TOOL_ROUNDS = 3;
const MAX_HISTORY_MESSAGES = 10;

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export async function chat(
  userId: number,
  userName: string,
  isGroupChat: boolean,
  conversationHistory: ConversationMessage[],
  userMessage: Anthropic.MessageParam,
  tasteProfileText?: string
): Promise<{ responseText: string; updatedHistory: ConversationMessage[] }> {
  const systemPrompt = buildSystemPrompt(userId, userName, isGroupChat, tasteProfileText);

  // Trim history to limit token usage per call
  const trimmedHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);

  // Build messages from conversation history + new user message
  const messages: Anthropic.MessageParam[] = [
    ...trimmedHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    userMessage,
  ];

  let responseText = "";
  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      tools,
      messages,
    });

    // Collect text and tool use blocks
    const textBlocks: string[] = [];
    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textBlocks.push(block.text);
      } else if (block.type === "tool_use") {
        toolUseBlocks.push(block);
      }
    }

    if (textBlocks.length > 0) {
      responseText += textBlocks.join("\n");
    }

    // Only continue looping if Claude explicitly wants to use tools
    if (response.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
      break;
    }

    // Execute tool calls and add results to messages
    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      console.log(`Executing tool: ${toolUse.name} (round ${rounds}/${MAX_TOOL_ROUNDS})`);
      const result = await executeTool(
        toolUse.name,
        toolUse.input as Record<string, unknown>,
        userId,
        userName
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  if (rounds >= MAX_TOOL_ROUNDS && !responseText) {
    responseText = "I tried processing your request but it required too many steps. Could you try simplifying your message?";
  }

  // Extract the user message text for history
  const userText =
    typeof userMessage.content === "string"
      ? userMessage.content
      : (userMessage.content as Anthropic.ContentBlockParam[])
          .filter((b): b is Anthropic.TextBlockParam => b.type === "text")
          .map((b) => b.text)
          .join(" ");

  const updatedHistory: ConversationMessage[] = [
    ...conversationHistory,
    { role: "user", content: userText },
    { role: "assistant", content: responseText },
  ];

  return { responseText, updatedHistory };
}
