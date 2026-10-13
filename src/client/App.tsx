import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { AmbientHomeView } from './components/AmbientHomeView';
import { WaveformVisualizer } from './components/WaveformVisualizer';
import { PersonaQuickSelect } from './components/PersonaQuickSelect';
import { SpokenFeed } from './components/SpokenFeed';
import { RecipeCard } from './components/RecipeCard';
import { BundleCarousel } from './components/BundleCarousel';
import { CartSummaryDock } from './components/CartSummaryDock';
import { ProtocolInspector } from './components/ProtocolInspector';
import { ConfirmModal } from './components/ConfirmModal';
import { SseClient, type SseConnectionStatus } from './services/sse-client';
import { apiClient } from './services/api-client';
import { ArrowLeft } from 'lucide-react';
import type {
  ViewportMode,
  RecipeCardProps,
  BundleItem,
  WireMessage,
} from './types/ui';

// Demonstration recipe payload when dynamically requested
const DEFAULT_RECIPE: RecipeCardProps = {
  id: 'rec-mediterranean-salmon',
  title: 'Mediterranean Salmon Bowl',
  photoUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  prepTimeMinutes: 10,
  cookTimeMinutes: 15,
  servings: 2,
  macros: {
    calories: 520,
    proteinGrams: 42,
    carbsGrams: 38,
    fatsGrams: 22,
  },
  allergenCertifications: ['Dairy-Free', 'Peanut-Free', 'Gluten-Free'],
  estimatedCost: 29.75,
  onStartCooking: () => {},
};

// Demonstration bundle items when dynamically requested
const DEFAULT_BUNDLE_ITEMS: BundleItem[] = [
  {
    sku: 'FRESH-SALMON-02',
    name: 'Wild Sockeye Salmon Fillet (1 lb)',
    photoUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80',
    packageQuantity: '1 lb fresh fillet',
    unitPrice: 12.99,
    inStock: true,
    allergenTags: ['Fish'],
  },
  {
    sku: 'FRESH-QUINOA-01',
    name: 'Organic Tricolor Quinoa (16 oz)',
    photoUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
    packageQuantity: '16 oz dry grain',
    unitPrice: 4.49,
    inStock: true,
    allergenTags: ['Gluten-Free'],
  },
  {
    sku: 'FRESH-CUCUMBER-01',
    name: 'Organic English Cucumber',
    photoUrl: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?auto=format&fit=crop&w=600&q=80',
    packageQuantity: '1 each',
    unitPrice: 1.79,
    inStock: true,
    allergenTags: [],
  },
  {
    sku: 'FRESH-TOMATO-01',
    name: 'Roma Tomatoes (1 lb)',
    photoUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80',
    packageQuantity: '1 lb vine-ripened',
    unitPrice: 2.49,
    inStock: true,
    allergenTags: [],
  },
  {
    sku: 'FRESH-OLIVEOIL-01',
    name: 'Extra Virgin Olive Oil (500ml)',
    photoUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
    packageQuantity: '500 ml cold-pressed',
    unitPrice: 7.99,
    inStock: true,
    allergenTags: [],
  },
];

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export const App: React.FC = () => {
  const [sessionId, setSessionId] = useState<string>(() => generateSessionId());
  const [viewportMode, setViewportMode] = useState<ViewportMode>('echo-show-15');
  const [connectionStatus, setConnectionStatus] = useState<SseConnectionStatus>('connected');
  const [isMockMode, setIsMockMode] = useState<boolean>(true);
  const [activePersona, setActivePersona] = useState<string | undefined>(undefined);
  const [assistantState, setAssistantState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [spokenText, setSpokenText] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [speaker, setSpeaker] = useState<'aura' | 'user'>('aura');

  // Stage: 'ambient' (Idle Clock/Input) vs 'active' (Conversing, Dynamic Recipe/Bundle)
  const [stage, setStage] = useState<'ambient' | 'active'>('ambient');

  // Stealth Debug/Inspector Activation (?debug=true or Ctrl+`)
  const [showDebug, setShowDebug] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('debug') === 'true' || p.get('inspector') === '1';
    }
    return false;
  });

  // Dynamic Widget States (Null by default on ambient cold start)
  const [recipe, setRecipe] = useState<RecipeCardProps | null>(null);
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [bundleId, setBundleId] = useState<string>('bnd-mediterranean-salmon-1728480000');
  const [maxBudget, setMaxBudget] = useState<number | undefined>(30.0);
  const [savingsAmount, setSavingsAmount] = useState<number | undefined>(undefined);
  const [isGuidedCookingActive, setIsGuidedCookingActive] = useState<boolean>(false);

  // Cart State
  const [cartCount, setCartCount] = useState<number>(0);
  const [cartSubtotal, setCartSubtotal] = useState<number>(0);
  const [cartTax, setCartTax] = useState<number>(0);
  const [cartTotal, setCartTotal] = useState<number>(0);
  const [cartVersion, setCartVersion] = useState<number>(1);
  const [isAddingToCart, setIsAddingToCart] = useState<boolean>(false);
  const [isCartConflict, setIsCartConflict] = useState<boolean>(false);

  // Wire Protocol Telemetry & Modals
  const [wireMessages, setWireMessages] = useState<WireMessage[]>([]);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);

  const [, startTransition] = useTransition();

  // Log incoming/outgoing wire messages to state & browser console
  const logWireMessage = useCallback((msg: WireMessage) => {
    setWireMessages((prev) => [msg, ...prev.slice(0, 199)]);
    console.debug(`[Aura+ Wire ${msg.direction}]`, msg.type, msg.method || '', msg.payload);
  }, []);

  // Global Keyboard Shortcut: Ctrl + ` toggles Stealth Inspector Drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setShowDebug((prev) => !prev);
        setIsInspectorOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Calculate bundle total price
  const bundleTotalPrice = bundleItems.reduce((acc, item) => acc + item.unitPrice, 0);

  // Resilient SSE Client
  useEffect(() => {
    const sse = new SseClient({
      sessionId,
      onConnectionChange: (status) => setConnectionStatus(status),
      onWidget: (data) => {
        logWireMessage({
          id: `wire-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          direction: 'SSE_EVENT',
          type: 'SSE',
          method: `widget/${data.widgetType}`,
          payload: data,
        });

        // Switch to active stage when a widget arrives
        setStage('active');

        if (data.widgetType === 'recipe_card' && data.payload) {
          const p = data.payload as unknown as {
            recipeId: string;
            title: string;
            imageUrl?: string;
            prepTimeMinutes?: number;
            cookTimeMinutes?: number;
            servings?: number;
            macros?: { calories: number; proteinG?: number; proteinGrams?: number; carbsG?: number; carbsGrams?: number; fatG?: number; fatsGrams?: number };
            dietaryTags?: string[];
            allergenFlags?: string[];
            estimatedCost?: number;
          };
          setRecipe({
            id: p.recipeId || 'rec-custom',
            title: p.title || 'Curated Meal',
            photoUrl: p.imageUrl || DEFAULT_RECIPE.photoUrl,
            prepTimeMinutes: p.prepTimeMinutes || 15,
            cookTimeMinutes: p.cookTimeMinutes || 15,
            servings: p.servings || 2,
            macros: {
              calories: p.macros?.calories || 500,
              proteinGrams: p.macros?.proteinGrams || p.macros?.proteinG || 35,
              carbsGrams: p.macros?.carbsGrams || p.macros?.carbsG || 40,
              fatsGrams: p.macros?.fatsGrams || p.macros?.fatG || 20,
            },
            allergenCertifications: p.dietaryTags || ['Allergen-Safe'],
            estimatedCost: p.estimatedCost || 24.5,
            onStartCooking: () => {},
          });
        } else if (data.widgetType === 'product_carousel' && data.payload) {
          setBundleItems(DEFAULT_BUNDLE_ITEMS);
        }
      },
      onError: (err) => {
        logWireMessage({
          id: `wire-${Date.now()}`,
          timestamp: new Date().toISOString(),
          direction: 'INCOMING',
          type: 'SYSTEM',
          method: 'SSE Error',
          payload: { error: String(err) },
        });
      },
    });

    sse.connect();

    return () => {
      sse.disconnect();
    };
  }, [sessionId, logWireMessage]);

  // Handle conversational queries submitted from ambient input or chip
  const handleSendQuery = async (queryText: string, personaId?: 'alex' | 'elena' | 'marcus') => {
    setStage('active');
    setAssistantState('thinking');
    setIsStreaming(true);
    setSpeaker('aura');
    if (personaId) {
      setActivePersona(personaId);
    }

    setSpokenText('');

    let streamAcc = '';
    await apiClient.sendChatStream(
      sessionId,
      queryText,
      personaId,
      {
        onToken: (tok) => {
          streamAcc += tok;
          setSpokenText(streamAcc);
          setAssistantState('speaking');
        },
        onDone: (d) => {
          setIsStreaming(false);
          setAssistantState('idle');
          if (d.spokenText) {
            setSpokenText(d.spokenText);
          }
          if (d.fallbackTriggered !== undefined) {
            setIsMockMode(d.fallbackTriggered);
          }
          // Dynamically present curated recipe if none yet displayed
          if (!recipe) {
            setRecipe(DEFAULT_RECIPE);
            setBundleItems(DEFAULT_BUNDLE_ITEMS);
          }
        },
        onError: () => {
          setIsStreaming(false);
          setAssistantState('idle');
          if (!recipe) {
            setRecipe(DEFAULT_RECIPE);
          }
        },
        onWireMessage: logWireMessage,
      }
    );
  };

  // 1-Tap Add Bundle to Cart Action (with OCC version increment)
  const handleAddToCart = async () => {
    setIsAddingToCart(true);
    setIsCartConflict(false);

    try {
      const response = await apiClient.callMcpTool('manage_cart', {
        action: 'add_bundle',
        sessionId,
        bundleId,
        version: cartVersion,
      }, {
        idempotencyKey: `idemp-${Date.now()}`,
        ifMatchVersion: cartVersion,
        sessionId,
      });

      logWireMessage({
        id: `wire-${Date.now()}`,
        timestamp: new Date().toISOString(),
        direction: 'INCOMING',
        type: 'JSON_RPC',
        method: 'tools/call (manage_cart)',
        payload: response,
      });

      if (response.error && (response.error.code === 409 || response.error.code === -32009)) {
        setIsCartConflict(true);
      } else {
        startTransition(() => {
          const newCount = cartCount + bundleItems.length;
          const newSubtotal = cartSubtotal + bundleTotalPrice;
          const newTax = Number((newSubtotal * 0.08).toFixed(2));
          const newTotal = Number((newSubtotal + newTax).toFixed(2));

          setCartCount(newCount);
          setCartSubtotal(newSubtotal);
          setCartTax(newTax);
          setCartTotal(newTotal);
          setCartVersion((v) => v + 1);
        });
      }
    } catch {
      setIsCartConflict(true);
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Swap item substitution
  const handleSwapItem = (sku: string) => {
    setBundleItems((prev) =>
      prev.map((item) => {
        if (item.sku === sku) {
          return {
            ...item,
            name: `${item.name.replace(' (Swapped)', '')} (Swapped)`,
            unitPrice: Number((item.unitPrice * 0.9).toFixed(2)),
            isSubstituted: true,
          };
        }
        return item;
      })
    );
    setSavingsAmount((s) => (s || 0) + 1.25);
  };

  // Guided cooking action
  const handleStartCooking = () => {
    setIsGuidedCookingActive((prev) => !prev);
    setSpokenText(
      isGuidedCookingActive
        ? 'Guided cooking paused.'
        : 'Step 1: Bring 2 cups of salted water to a boil and rinse tricolor quinoa.'
    );
    setSpeaker('aura');
  };

  // Return back to ambient idle screen without clearing cart state
  const handleReturnToAmbient = () => {
    setStage('ambient');
  };

  // Clear Session Action (PRIV-002)
  const handleConfirmClearSession = async () => {
    try {
      await apiClient.clearSession(sessionId);
    } catch {
      // ignore network errors on volatile reset
    }

    startTransition(() => {
      setSessionId(generateSessionId());
      setSpokenText('');
      setRecipe(null);
      setBundleItems([]);
      setCartCount(0);
      setCartSubtotal(0);
      setCartTax(0);
      setCartTotal(0);
      setCartVersion(1);
      setIsGuidedCookingActive(false);
      setIsCartConflict(false);
      setStage('ambient');
      setActivePersona(undefined);
      setWireMessages([]);
    });

    setIsClearModalOpen(false);
  };

  // Export Friction Log as Markdown (FR-019, OPS-002)
  const handleExportFrictionLog = () => {
    const mdLines = [
      '# Aura+ Protocol Friction Log',
      `Generated: ${new Date().toISOString()}`,
      `Session ID: ${sessionId}`,
      `Total Wire Frames: ${wireMessages.length}`,
      '',
      '## Telemetry Frames',
      '',
      '| Timestamp | Direction | Type | Method | Latency |',
      '|---|---|---|---|---|',
      ...wireMessages.map(
        (m) =>
          `| ${m.timestamp} | ${m.direction} | ${m.type} | ${m.method || '-'} | ${
            m.latencyMs !== undefined ? `${m.latencyMs}ms` : '-'
          } |`
      ),
      '',
      '## Raw Frame Details',
      '',
      ...wireMessages.map(
        (m) => `### Frame ${m.id} (${m.method || m.type})
\`\`\`json
${JSON.stringify(m.payload, null, 2)}
\`\`\`
`
      ),
    ];

    const blob = new Blob([mdLines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FRICTION_LOG-${sessionId}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Viewport Container Styles when in developer debug mode
  const getViewportWrapperClass = () => {
    if (!showDebug) {
      return 'w-full max-w-7xl mx-auto min-h-screen';
    }
    switch (viewportMode) {
      case 'mobile':
        return 'max-w-[393px] mx-auto min-h-[852px] border-x border-[#1e2d4a] shadow-2xl';
      case 'echo-show-8':
        return 'max-w-[1280px] mx-auto min-h-[800px] border-x border-[#1e2d4a]';
      case 'echo-show-15':
      default:
        return 'w-full max-w-[1920px] mx-auto min-h-screen';
    }
  };

  return (
    <div
      data-testid="app-root"
      className="min-h-screen bg-[#080c14] text-[#f8fafc] flex flex-col font-sans select-none overflow-x-hidden relative"
    >
      {/* ========================================================
          LAYER 01: Background Layer (Fill frame, zero gradients)
          ======================================================== */}
      <div
        data-testid="layer-01-background"
        className="fixed inset-0 bg-[#080c14] pointer-events-none z-0"
        aria-hidden="true"
      />

      {/* Viewport Frame Container */}
      <div className={`relative z-10 flex flex-col flex-1 pb-32 bg-[#080c14] ${getViewportWrapperClass()}`}>
        {/* ========================================================
            LAYER 02: Foreground Layer (Header, Content, Cards, Feed)
            ======================================================== */}
        <div data-testid="layer-02-foreground" className="flex flex-col flex-1">
          {/* Header Bar */}
          <HeaderBar
            connectionStatus={connectionStatus}
            isMockMode={isMockMode}
            activePersona={activePersona}
            onClearSession={() => setIsClearModalOpen(true)}
            onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
            isInspectorOpen={isInspectorOpen}
            viewportMode={viewportMode}
            onChangeViewport={showDebug ? setViewportMode : undefined}
            showDebug={showDebug}
          />

          {/* Developer Debug Persona Selector */}
          {showDebug && (
            <div className="bg-[#111a2e] border-b border-[#1e2d4a] px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-[#94a3b8] uppercase font-bold tracking-wider">
                Developer Test Harness Active (?debug=true)
              </span>
              <PersonaQuickSelect
                onSelectPersona={(p) => {
                  const promptMap = {
                    alex: 'Quick 15-minute high dopamine dinner for 1 under $20',
                    elena: 'Family dinner for 4 under $30, strict dairy-free and peanut-free',
                    marcus: 'High-protein post-workout dinner >35g protein',
                  };
                  handleSendQuery(promptMap[p], p);
                }}
                activePersona={activePersona}
                disabled={isStreaming}
              />
            </div>
          )}

          <main className="flex-1 px-4 sm:px-6 md:px-8 py-6 flex flex-col gap-6">
            {/* STAGE 1: Ambient Idle Screen (Default Cold Start) */}
            {stage === 'ambient' && (
              <AmbientHomeView
                onSearch={(q) => handleSendQuery(q)}
                disabled={isStreaming}
              />
            )}

            {/* STAGE 2+: Conversational Active Flow */}
            {stage === 'active' && (
              <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
                {/* Back to Ambient Screen Navigation */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleReturnToAmbient}
                    className="min-h-[48px] px-4 py-2 rounded-xl bg-[#111a2e] border border-[#1e2d4a] text-[#94a3b8] hover:text-[#f8fafc] hover:border-[#38bdf8] transition-colors flex items-center gap-2 text-sm font-medium"
                    aria-label="Return to Ambient Home Screen"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    <span>Ambient Screen</span>
                  </button>

                  {/* Audio Waveform Spectrum */}
                  <div className="w-48 sm:w-64">
                    <WaveformVisualizer
                      state={assistantState}
                      audioLevel={assistantState === 'speaking' ? 0.7 : 0.3}
                    />
                  </div>
                </div>

                {/* Live Spoken Text Anchor */}
                {spokenText && (
                  <SpokenFeed
                    spokenText={spokenText}
                    isStreaming={isStreaming}
                    speaker={speaker}
                  />
                )}

                {/* Main Interactive Stage: Recipe Card & Bundle Carousel */}
                {(recipe || bundleItems.length > 0) && (
                  <div className="w-full my-2 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Recipe Card */}
                    {recipe && (
                      <div className="lg:col-span-5 w-full">
                        <RecipeCard
                          {...recipe}
                          onStartCooking={handleStartCooking}
                          isGuidedCookingActive={isGuidedCookingActive}
                        />
                      </div>
                    )}

                    {/* Bundle Carousel */}
                    {bundleItems.length > 0 && (
                      <div className="lg:col-span-7 w-full overflow-hidden">
                        <BundleCarousel
                          bundleId={bundleId}
                          recipeName={recipe ? recipe.title : 'Mediterranean Salmon Bowl'}
                          items={bundleItems}
                          totalPrice={bundleTotalPrice}
                          maxBudget={maxBudget}
                          savingsAmount={savingsAmount}
                          onSwapItem={handleSwapItem}
                          onAddToCart={handleAddToCart}
                          isAddingToCart={isAddingToCart}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        {/* ========================================================
            LAYER 03: Components Layer (Floating Docks, Drawers, Modals)
            ======================================================== */}
        <div data-testid="layer-03-components" className="relative z-30">
          {/* Sticky Cart Summary Dock (Renders only when items in cart or bundle active) */}
          {(bundleItems.length > 0 || cartCount > 0) && stage === 'active' && (
            <CartSummaryDock
              itemCount={cartCount}
              subtotal={cartSubtotal}
              estimatedTax={cartTax}
              total={cartTotal}
              maxBudget={maxBudget}
              savingsAmount={savingsAmount}
              version={cartVersion}
              onAddToCart={handleAddToCart}
              isAdding={isAddingToCart}
              isConflict={isCartConflict}
              onResolveConflict={() => {
                setIsCartConflict(false);
                setCartVersion((v) => v + 1);
              }}
            />
          )}

          {/* Diagnostic Protocol Wire Inspector Drawer (Hidden unless debug requested) */}
          <ProtocolInspector
            isOpen={isInspectorOpen}
            onClose={() => setIsInspectorOpen(false)}
            messages={wireMessages}
            onClearMessages={() => setWireMessages([])}
            onExportFrictionLog={handleExportFrictionLog}
          />

          {/* Clear Session Confirmation Modal */}
          <ConfirmModal
            isOpen={isClearModalOpen}
            title="Clear Ephemeral Session?"
            message="This action immediately wipes in-memory conversation history and active cart items per PRIV-002. It cannot be undone."
            confirmLabel="Clear Session"
            cancelLabel="Keep Session"
            onConfirm={handleConfirmClearSession}
            onCancel={() => setIsClearModalOpen(false)}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
