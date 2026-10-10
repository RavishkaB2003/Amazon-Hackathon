/**
 * Aura+ MOD-03 Offline Deterministic Mock Engine
 * Simulates Anthropic Claude 3.5 Sonnet Converse API without network calls.
 * Executes real MCP tools against MOD-02 local registry, generates streaming deltas,
 * and reproduces rich hackathon persona behaviors (Alex, Elena, Marcus, Custom).
 */

import { getTool } from '../mcp/registry';
import { getRecipeById, getRecipes } from '../data/recipes';
import {
  type AgentChatRequest,
  type AgentChatResponse,
  type AgentStreamChunk,
  type ToolCallExecutionRecord,
  type WidgetDispatchedRecord,
} from '../../shared/types/agent';
import {
  countWords,
  trimSpokenText,
  parseAmbientConstraints,
  MAX_SPOKEN_WORDS_DEFAULT,
} from './prompts';
import { isPurgeCommand } from './memory';
import type { CuratedBundle } from '../../shared/types/tools';

export class MockEngine {
  /**
   * Deterministically executes a conversational chat turn offline.
   */
  async chat(
    request: AgentChatRequest,
    fallbackTriggered: boolean = false
  ): Promise<AgentChatResponse> {
    const { sessionId, message, persona } = request;

    // 1. Session Purge Command handling
    if (isPurgeCommand(message)) {
      const toolCalls: ToolCallExecutionRecord[] = [];
      const manageCartTool = getTool('manage_cart');
      if (manageCartTool) {
        const input = { action: 'clear', sessionId };
        const res = await manageCartTool.handler(input, { sessionId });
        let out: Record<string, unknown> = {};
        try {
          out = JSON.parse(res.content[0]?.text || '{}');
        } catch {
          out = { message: res.content[0]?.text || '' };
        }
        toolCalls.push({ toolName: 'manage_cart', input, output: out });
      }

      const spokenText = "I've cleared your session history and shopping cart.";
      return {
        sessionId,
        spokenText,
        wordCount: countWords(spokenText),
        toolCallsExecuted: toolCalls,
        widgetsDispatched: [],
        fallbackTriggered,
        modelUsed: 'system-purge',
        turnCount: 0,
      };
    }

    // 2. Identify scenario
    const plan = this.resolveScenarioPlan(request);

    // 3. Execute tools sequentially against real in-memory MCP registry
    const toolCallsExecuted: ToolCallExecutionRecord[] = [];
    const widgetsDispatched: WidgetDispatchedRecord[] = [];

    for (const toolStep of plan.tools) {
      const tool = getTool(toolStep.name);
      if (!tool) {
        continue;
      }

      const result = await tool.handler(toolStep.input, { sessionId });
      let outputObj: Record<string, unknown> = {};
      try {
        outputObj = JSON.parse(result.content[0]?.text || '{}');
      } catch {
        outputObj = { text: result.content[0]?.text || '' };
      }

      toolCallsExecuted.push({
        toolName: toolStep.name,
        input: toolStep.input,
        output: outputObj,
      });

      if (toolStep.name === 'render_multimodal_widget') {
        widgetsDispatched.push({
          widgetType: (toolStep.input.widgetType as string) || 'recipe_card',
          title: (toolStep.input.title as string) || 'Meal Plan',
        });
      }
    }

    // 4. Validate and enforce brevity (< 25 words)
    let spokenText = plan.spokenText;
    if (countWords(spokenText) > MAX_SPOKEN_WORDS_DEFAULT) {
      spokenText = trimSpokenText(spokenText, MAX_SPOKEN_WORDS_DEFAULT);
    }
    const wordCount = countWords(spokenText);

    return {
      sessionId,
      spokenText,
      wordCount,
      toolCallsExecuted,
      widgetsDispatched,
      fallbackTriggered,
      modelUsed: 'anthropic.claude-3-5-sonnet-20241022-v2:0 (mock)',
      turnCount: 1,
    };
  }

  /**
   * Streams conversational tokens and tool execution events as an AsyncIterable.
   */
  async *chatStream(
    request: AgentChatRequest,
    fallbackTriggered: boolean = false
  ): AsyncIterable<AgentStreamChunk> {
    const { sessionId, message } = request;

    if (isPurgeCommand(message)) {
      const manageCartTool = getTool('manage_cart');
      if (manageCartTool) {
        yield {
          type: 'tool_call',
          toolName: 'manage_cart',
          toolUseId: `call_purge_${Date.now()}`,
          input: { action: 'clear', sessionId },
        };
        const res = await manageCartTool.handler({ action: 'clear', sessionId }, { sessionId });
        yield {
          type: 'tool_result',
          toolUseId: `call_purge_${Date.now()}`,
          result: res,
        };
      }

      const spokenText = "I've cleared your session history and shopping cart.";
      const words = spokenText.split(' ');
      for (let i = 0; i < words.length; i++) {
        yield { type: 'token', text: (i === 0 ? '' : ' ') + words[i] };
      }

      yield {
        type: 'done',
        spokenText,
        wordCount: countWords(spokenText),
        fallbackTriggered,
      };
      return;
    }

    const plan = this.resolveScenarioPlan(request);
    let spokenText = plan.spokenText;
    if (countWords(spokenText) > MAX_SPOKEN_WORDS_DEFAULT) {
      spokenText = trimSpokenText(spokenText, MAX_SPOKEN_WORDS_DEFAULT);
    }
    const words = spokenText.split(' ');

    // Yield initial phrase tokens
    const firstHalfCount = Math.min(3, words.length);
    for (let i = 0; i < firstHalfCount; i++) {
      yield { type: 'token', text: (i === 0 ? '' : ' ') + words[i] };
    }

    // Execute tools and yield events
    let callIdx = 1;
    for (const toolStep of plan.tools) {
      const toolUseId = `call_${callIdx++}_${toolStep.name}`;
      yield {
        type: 'tool_call',
        toolName: toolStep.name,
        toolUseId,
        input: toolStep.input,
      };

      const tool = getTool(toolStep.name);
      let outputObj: Record<string, unknown> = {};
      if (tool) {
        const result = await tool.handler(toolStep.input, { sessionId });
        try {
          outputObj = JSON.parse(result.content[0]?.text || '{}');
        } catch {
          outputObj = { text: result.content[0]?.text || '' };
        }
        yield {
          type: 'tool_result',
          toolUseId,
          result: outputObj,
        };
      }

      if (toolStep.name === 'render_multimodal_widget') {
        yield {
          type: 'widget',
          widgetType: (toolStep.input.widgetType as string) || 'recipe_card',
          title: (toolStep.input.title as string) || 'Meal Plan',
          payload: (toolStep.input.payload as Record<string, unknown>) || {},
        };
      }
    }

    // Yield remaining speech tokens
    for (let i = firstHalfCount; i < words.length; i++) {
      yield { type: 'token', text: ' ' + words[i] };
    }

    // Final completion marker
    yield {
      type: 'done',
      spokenText,
      wordCount: countWords(spokenText),
      fallbackTriggered,
    };
  }

  /**
   * Resolves the deterministic scenario execution plan based on persona or keywords.
   */
  private resolveScenarioPlan(request: AgentChatRequest): {
    tools: Array<{ name: string; input: Record<string, unknown> }>;
    spokenText: string;
  } {
    const { sessionId, message, persona } = request;
    const lower = message.toLowerCase();

    // 1. Scenario: Alex (ADHD Professional)
    const isAlex =
      persona === 'alex' ||
      lower.includes('alex') ||
      lower.includes('exhausted') ||
      (lower.includes('high-protein') && lower.includes('25') && lower.includes('dairy'));

    if (isAlex) {
      const chickenRecipe = getRecipeById('rec-sesame-chicken') || getRecipes()[1];
      const chickenRecipeId = chickenRecipe ? chickenRecipe.id : 'rec-sesame-chicken';

      return {
        tools: [
          {
            name: 'smart_search_catalog',
            input: {
              query: 'chicken',
              maxPrice: 25.0,
              excludedAllergens: ['dairy'],
              dietaryTags: ['high-protein'],
              limit: 5,
            },
          },
          {
            name: 'build_curated_bundle',
            input: {
              recipeId: chickenRecipeId,
              servings: 2,
              maxBudget: 25.0,
              excludedAllergens: ['dairy'],
            },
          },
          {
            name: 'render_multimodal_widget',
            input: {
              widgetType: 'recipe_card',
              title: '15-Minute Sesame Chicken Noodles',
              sessionId,
              payload: {
                recipeId: chickenRecipeId,
                prepTimeMinutes: 5,
                cookTimeMinutes: 10,
                servings: 2,
                totalPrice: 22.45,
                nutritionPerServing: chickenRecipe?.nutritionPerServing || {
                  calories: 480,
                  proteinG: 38,
                  carbsG: 52,
                  fatG: 14,
                },
              },
            },
          },
          {
            name: 'manage_cart',
            input: {
              action: 'add_bundle',
              sessionId,
              bundleId: `bnd-${chickenRecipeId}-alex`,
              items: [
                { sku: 'FRESH-POULTRY-01', title: 'Organic Chicken Breast', quantity: 1, price: 6.99 },
                { sku: 'FRESH-GRAIN-03', title: 'Asian Lo Mein Noodles', quantity: 1, price: 2.89 },
                { sku: 'FRESH-PRODUCE-11', title: 'Fresh Broccoli Crowns', quantity: 1, price: 2.49 },
                { sku: 'FRESH-PRODUCE-06', title: 'Red Bell Pepper', quantity: 1, price: 1.29 },
                { sku: 'FRESH-PANTRY-02', title: 'Toasted Sesame Oil', quantity: 1, price: 4.99 },
                { sku: 'FRESH-PANTRY-03', title: 'Low-Sodium Soy Sauce', quantity: 1, price: 3.29 },
              ],
            },
          },
        ],
        spokenText:
          "I've assembled a quick 15-minute Sesame Chicken dinner with 38 grams of protein for under $25.",
      };
    }

    // 2. Scenario: Elena (Budget & Allergy Parent)
    const isElena =
      persona === 'elena' ||
      lower.includes('elena') ||
      lower.includes('mediterranean salmon') ||
      (lower.includes('swap') && lower.includes('chicken'));

    if (isElena) {
      if (lower.includes('swap') || lower.includes('under $20') || lower.includes('20')) {
        return {
          tools: [
            {
              name: 'build_curated_bundle',
              input: {
                recipeId: 'rec-sesame-chicken',
                servings: 2,
                maxBudget: 20.0,
                excludedAllergens: ['dairy'],
              },
            },
            {
              name: 'render_multimodal_widget',
              input: {
                widgetType: 'recipe_card',
                title: '15-Minute Sesame Chicken Noodles',
                sessionId,
                payload: {
                  recipeId: 'rec-sesame-chicken',
                  prepTimeMinutes: 5,
                  cookTimeMinutes: 10,
                  servings: 2,
                  totalPrice: 18.5,
                },
              },
            },
            {
              name: 'manage_cart',
              input: {
                action: 'add_bundle',
                sessionId,
                bundleId: 'bnd-chicken-swap-elena',
                items: [
                  { sku: 'FRESH-POULTRY-01', title: 'Organic Chicken Breast', quantity: 1, price: 6.99 },
                  { sku: 'FRESH-GRAIN-03', title: 'Asian Lo Mein Noodles', quantity: 1, price: 2.89 },
                  { sku: 'FRESH-PRODUCE-11', title: 'Fresh Broccoli Crowns', quantity: 1, price: 2.49 },
                ],
              },
            },
          ],
          spokenText:
            "I've swapped the salmon for organic chicken breast, bringing the total to $18.50.",
        };
      }

      // Initial Elena request (Mediterranean salmon under $30, dairy-free)
      return {
        tools: [
          {
            name: 'smart_search_catalog',
            input: {
              query: 'salmon',
              maxPrice: 30.0,
              excludedAllergens: ['dairy'],
              limit: 5,
            },
          },
          {
            name: 'build_curated_bundle',
            input: {
              recipeId: 'rec-mediterranean-salmon',
              servings: 2,
              maxBudget: 30.0,
              excludedAllergens: ['dairy'],
            },
          },
          {
            name: 'render_multimodal_widget',
            input: {
              widgetType: 'recipe_card',
              title: 'Mediterranean Salmon Bowl',
              sessionId,
              payload: {
                recipeId: 'rec-mediterranean-salmon',
                prepTimeMinutes: 10,
                cookTimeMinutes: 15,
                servings: 2,
                totalPrice: 24.45,
              },
            },
          },
          {
            name: 'manage_cart',
            input: {
              action: 'add_bundle',
              sessionId,
              bundleId: 'bnd-mediterranean-salmon-elena',
              items: [
                { sku: 'FRESH-SALMON-02', title: 'Wild Sockeye Salmon Fillet', quantity: 1, price: 13.99 },
                { sku: 'FRESH-QUINOA-01', title: 'Organic Tricolor Quinoa', quantity: 1, price: 4.49 },
                { sku: 'FRESH-CUCUMBER-01', title: 'English Cucumber', quantity: 1, price: 1.49 },
                { sku: 'FRESH-TOMATO-01', title: 'Roma Tomatoes (1 lb)', quantity: 1, price: 1.99 },
              ],
            },
          },
        ],
        spokenText:
          "I've assembled a Mediterranean Salmon Bowl with dairy-free ingredients under $30 for your family.",
      };
    }

    // 3. Scenario: Marcus (Fitness Enthusiast)
    const isMarcus =
      persona === 'marcus' ||
      lower.includes('marcus') ||
      (lower.includes('grain bowl') && lower.includes('protein')) ||
      lower.includes('>35g') ||
      lower.includes('35g');

    if (isMarcus) {
      return {
        tools: [
          {
            name: 'smart_search_catalog',
            input: {
              query: 'quinoa',
              dietaryTags: ['high-protein'],
              limit: 5,
            },
          },
          {
            name: 'build_curated_bundle',
            input: {
              recipeId: 'rec-vegetarian-grain',
              servings: 2,
              maxBudget: 35.0,
            },
          },
          {
            name: 'render_multimodal_widget',
            input: {
              widgetType: 'recipe_card',
              title: 'High-Protein Grain Bowl',
              sessionId,
              payload: {
                recipeId: 'rec-vegetarian-grain',
                prepTimeMinutes: 10,
                cookTimeMinutes: 15,
                servings: 2,
                totalPrice: 22.8,
              },
            },
          },
        ],
        spokenText:
          "I've prepared a high-protein quinoa grain bowl with balanced macros ready in 25 minutes.",
      };
    }

    // 4. Custom / Generic queries: parse ambient constraints
    const constraints = parseAmbientConstraints(message);
    const recipes = getRecipes();
    let selectedRecipe = recipes[0];

    if (lower.includes('egg') || lower.includes('scramble') || lower.includes('breakfast')) {
      selectedRecipe = recipes.find((r) => r.id === 'rec-keto-scramble') || selectedRecipe;
    } else if (lower.includes('chicken') || lower.includes('noodle')) {
      selectedRecipe = recipes.find((r) => r.id === 'rec-sesame-chicken') || selectedRecipe;
    } else if (lower.includes('grain') || lower.includes('vegetarian')) {
      selectedRecipe = recipes.find((r) => r.id === 'rec-vegetarian-grain') || selectedRecipe;
    } else if (lower.includes('salmon')) {
      selectedRecipe = recipes.find((r) => r.id === 'rec-mediterranean-salmon') || selectedRecipe;
    }

    const queryWord = selectedRecipe.title.split(' ')[0] || 'groceries';

    return {
      tools: [
        {
          name: 'smart_search_catalog',
          input: {
            query: queryWord,
            ...(constraints.maxBudget ? { maxPrice: constraints.maxBudget } : {}),
            ...(constraints.excludedAllergens ? { excludedAllergens: constraints.excludedAllergens } : {}),
            ...(constraints.dietaryTags ? { dietaryTags: constraints.dietaryTags } : {}),
            limit: 5,
          },
        },
        {
          name: 'build_curated_bundle',
          input: {
            recipeId: selectedRecipe.id,
            servings: constraints.servings || 2,
            ...(constraints.maxBudget ? { maxBudget: constraints.maxBudget } : {}),
            ...(constraints.excludedAllergens ? { excludedAllergens: constraints.excludedAllergens } : {}),
          },
        },
        {
          name: 'render_multimodal_widget',
          input: {
            widgetType: 'recipe_card',
            title: selectedRecipe.title,
            sessionId,
            payload: {
              recipeId: selectedRecipe.id,
              prepTimeMinutes: selectedRecipe.prepTimeMinutes,
              cookTimeMinutes: selectedRecipe.cookTimeMinutes,
              servings: constraints.servings || 2,
              totalPrice: 21.5,
            },
          },
        },
      ],
      spokenText: `I've prepared a ${selectedRecipe.title} recipe card and ingredient bundle tailored to your preferences.`,
    };
  }
}

export const mockEngine = new MockEngine();
