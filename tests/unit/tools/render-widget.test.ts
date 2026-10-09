import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderMultimodalWidgetHandler } from '../../../src/server/mcp/tools/render-widget';
import * as sseTransport from '../../../src/server/transport/sse';

describe('Tool: render_multimodal_widget (Unit)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validates and dispatches valid recipe_card widget payload (FR-007)', async () => {
    const broadcastSpy = vi.spyOn(sseTransport, 'broadcastSseEvent');

    const validPayload = {
      recipeId: 'rec-mediterranean-salmon',
      title: 'Mediterranean Salmon Bowl',
      description: 'Pan-seared salmon over fluffy tricolor quinoa with crisp cucumber and tomatoes.',
      imageUrl: '/assets/recipes/salmon-bowl.jpg',
      prepTimeMinutes: 10,
      cookTimeMinutes: 15,
      servings: 2,
      macros: { calories: 520, proteinG: 42, carbsG: 38, fatG: 22 },
      ingredients: [
        { name: 'Atlantic Salmon Fillet', quantity: '1 lb' },
        { name: 'Tricolor Quinoa', quantity: '1 cup' },
        { name: 'English Cucumber', quantity: '1 medium' },
      ],
      action: { label: 'Start Guided Cooking', actionId: 'start_cooking' },
    };

    const res = await renderMultimodalWidgetHandler({
      widgetType: 'recipe_card',
      title: 'Mediterranean Salmon Bowl',
      sessionId: 'session-alex-123',
      payload: validPayload,
    });

    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain(
      'Rendered recipe_card widget: "Mediterranean Salmon Bowl" successfully.'
    );

    expect(broadcastSpy).toHaveBeenCalledTimes(1);
    expect(broadcastSpy).toHaveBeenCalledWith(
      {
        event: 'widget',
        data: {
          widgetType: 'recipe_card',
          title: 'Mediterranean Salmon Bowl',
          payload: validPayload,
          sessionId: 'session-alex-123',
        },
      },
      'session-alex-123'
    );
  });

  it('rejects recipe_card payload with missing required fields', async () => {
    const invalidPayload = {
      recipeId: 'rec-mediterranean-salmon',
      // missing title, description, imageUrl, macros, ingredients
    };

    const res = await renderMultimodalWidgetHandler({
      widgetType: 'recipe_card',
      title: 'Broken Recipe Card',
      payload: invalidPayload,
    });

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Widget payload validation failed for "recipe_card"');
  });

  it('validates and dispatches valid product_carousel widget payload', async () => {
    const broadcastSpy = vi.spyOn(sseTransport, 'broadcastSseEvent');

    const validCarousel = {
      title: 'Bundle Ingredients',
      items: [
        { sku: 'FRESH-SALMON-01', title: 'Atlantic Salmon', price: 11.99, unit: '1 lb' },
        { sku: 'FRESH-QUINOA-01', title: 'Tricolor Quinoa', price: 3.99, unit: '16 oz' },
      ],
      totalPrice: 15.98,
      primaryAction: { label: 'Add All to Cart', actionId: 'add_bundle' },
    };

    const res = await renderMultimodalWidgetHandler({
      widgetType: 'product_carousel',
      title: 'Bundle Ingredients',
      sessionId: 'session-elena-456',
      payload: validCarousel,
    });

    expect(res.isError).toBeFalsy();
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'widget',
        data: expect.objectContaining({
          widgetType: 'product_carousel',
          title: 'Bundle Ingredients',
        }),
      }),
      'session-elena-456'
    );
  });

  it('validates and dispatches valid cooking_step widget payload', async () => {
    const broadcastSpy = vi.spyOn(sseTransport, 'broadcastSseEvent');

    const validStep = {
      recipeId: 'rec-mediterranean-salmon',
      stepNumber: 1,
      totalSteps: 5,
      instruction: 'Simmer tricolor quinoa in 2 cups of water for 15 minutes.',
      timerSeconds: 900,
      tip: 'Fluff with a fork for best texture.',
    };

    const res = await renderMultimodalWidgetHandler({
      widgetType: 'cooking_step',
      title: 'Step 1: Cook Quinoa',
      sessionId: 'session-alex-123',
      payload: validStep,
    });

    expect(res.isError).toBeFalsy();
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'widget',
        data: expect.objectContaining({
          widgetType: 'cooking_step',
          title: 'Step 1: Cook Quinoa',
        }),
      }),
      'session-alex-123'
    );
  });

  it('rejects cooking_step with missing stepNumber', async () => {
    const invalidStep = {
      recipeId: 'rec-mediterranean-salmon',
      // missing stepNumber and totalSteps
      instruction: 'Do something',
    };

    const res = await renderMultimodalWidgetHandler({
      widgetType: 'cooking_step',
      title: 'Step missing numbers',
      payload: invalidStep,
    });

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Widget payload validation failed for "cooking_step"');
  });

  it('rejects unsupported widgetType', async () => {
    const res = await renderMultimodalWidgetHandler({
      widgetType: 'unsupported_widget' as unknown as 'recipe_card',
      title: 'Test',
      payload: {},
    });

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Invalid parameters');
  });
});
