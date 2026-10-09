/**
 * Tool: render_multimodal_widget
 * FR-007: Validates multimodal UI widget schemas (recipe_card, product_carousel, cooking_step)
 * and dispatches them over Server-Sent Events (SSE) via broadcastSseEvent().
 */

import type { McpToolRegistration, McpToolResult, RequestContext } from '../../../shared/types/mcp';
import { broadcastSseEvent } from '../../transport/sse';
import {
  RenderMultimodalWidgetInputSchema,
  RecipeCardPayloadSchema,
  ProductCarouselPayloadSchema,
  CookingStepPayloadSchema,
  type WidgetType,
} from '../../../shared/types/tools';

export const RENDER_MULTIMODAL_WIDGET_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    widgetType: {
      type: 'string',
      enum: ['recipe_card', 'product_carousel', 'cooking_step'],
      description: 'Multimodal widget template type',
    },
    title: {
      type: 'string',
      minLength: 1,
      description: 'Widget display title',
    },
    payload: {
      type: 'object',
      description: 'Structured widget-specific payload conforming to widget type schema',
    },
    sessionId: {
      type: 'string',
      description: 'Target client session ID for SSE unicast or broadcast',
    },
  },
  required: ['widgetType', 'title', 'payload'],
};

export async function renderMultimodalWidgetHandler(
  rawParams: Record<string, unknown>,
  context: RequestContext = {}
): Promise<McpToolResult> {
  const parseResult = RenderMultimodalWidgetInputSchema.safeParse(rawParams);
  if (!parseResult.success) {
    return {
      content: [
        {
          type: 'text',
          text: `Invalid parameters: ${parseResult.error.issues.map((i) => i.message).join('; ')}`,
        },
      ],
      isError: true,
    };
  }

  const { widgetType, title, payload, sessionId } = parseResult.data;
  const targetSessionId = sessionId || context.sessionId;

  // Validate specific widget payload structure
  let validatedPayload: Record<string, unknown>;

  switch (widgetType as WidgetType) {
    case 'recipe_card': {
      const payloadParse = RecipeCardPayloadSchema.safeParse(payload);
      if (!payloadParse.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Widget payload validation failed for "recipe_card": ${payloadParse.error.issues
                .map((i) => i.message)
                .join('; ')}`,
            },
          ],
          isError: true,
        };
      }
      validatedPayload = payloadParse.data as unknown as Record<string, unknown>;
      break;
    }

    case 'product_carousel': {
      const payloadParse = ProductCarouselPayloadSchema.safeParse(payload);
      if (!payloadParse.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Widget payload validation failed for "product_carousel": ${payloadParse.error.issues
                .map((i) => i.message)
                .join('; ')}`,
            },
          ],
          isError: true,
        };
      }
      validatedPayload = payloadParse.data as unknown as Record<string, unknown>;
      break;
    }

    case 'cooking_step': {
      const payloadParse = CookingStepPayloadSchema.safeParse(payload);
      if (!payloadParse.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Widget payload validation failed for "cooking_step": ${payloadParse.error.issues
                .map((i) => i.message)
                .join('; ')}`,
            },
          ],
          isError: true,
        };
      }
      validatedPayload = payloadParse.data as unknown as Record<string, unknown>;
      break;
    }

    default: {
      return {
        content: [
          {
            type: 'text',
            text: `Unsupported widgetType: "${widgetType}"`,
          },
        ],
        isError: true,
      };
    }
  }

  // Dispatch SSE event frame to active clients
  broadcastSseEvent(
    {
      event: 'widget',
      data: {
        widgetType,
        title,
        payload: validatedPayload,
        ...(targetSessionId ? { sessionId: targetSessionId } : {}),
      },
    },
    targetSessionId
  );

  return {
    content: [
      {
        type: 'text',
        text: `Rendered ${widgetType} widget: "${title}" successfully.`,
      },
    ],
  };
}

export const renderMultimodalWidgetTool: McpToolRegistration = {
  name: 'render_multimodal_widget',
  description:
    'Validate and broadcast structured multimodal UI widgets (recipe_card, product_carousel, cooking_step) over SSE.',
  inputSchema: RENDER_MULTIMODAL_WIDGET_SCHEMA,
  handler: renderMultimodalWidgetHandler,
};
