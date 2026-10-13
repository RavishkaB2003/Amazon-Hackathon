/**
 * Aura+ MOD-04 UI Component Types & Contracts
 * Authoritative interface declarations conforming to MOD-04.md and ui_blueprint.md
 */

export type ViewportMode = 'echo-show-15' | 'echo-show-8' | 'mobile';

// Header Bar Contract (SCR-001)
export interface HeaderBarProps {
  connectionStatus: 'connected' | 'reconnecting' | 'offline';
  isMockMode: boolean;
  activePersona?: string;
  onClearSession: () => void;
  onToggleInspector: () => void;
  isInspectorOpen: boolean;
  viewportMode?: ViewportMode;
  onChangeViewport?: (mode: ViewportMode) => void;
  showDebug?: boolean;
}

// Waveform Visualizer Contract (SCR-001)
export interface WaveformVisualizerProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  audioLevel?: number; // 0.0 to 1.0 simulated audio amplitude
  reducedMotion?: boolean; // defaults to prefers-reduced-motion
}

// Persona Quick Select Contract (SCR-001)
export interface PersonaQuickSelectProps {
  onSelectPersona: (personaId: 'alex' | 'elena' | 'marcus') => void;
  activePersona?: string;
  disabled?: boolean;
}

// Spoken Response Feed Contract (SCR-001)
export interface SpokenFeedProps {
  spokenText: string;
  isStreaming: boolean;
  speaker: 'aura' | 'user';
  wordCount?: number;
}

// Recipe Card Contract (SCR-002)
export interface RecipeCardProps {
  id: string;
  title: string;              // Topmost text element in container (#GUARDRAIL 2: no eyebrow)
  photoUrl: string;           // Standalone photo container above text panel (#GUARDRAIL 3)
  prepTimeMinutes: number;    // Displayed below title in metadata row
  cookTimeMinutes?: number;
  servings: number;
  macros: {
    calories: number;
    proteinGrams: number;     // Rendered with Badge/Nutrition
    carbsGrams: number;
    fatsGrams: number;
  };
  allergenCertifications: string[]; // Rendered with Badge/Allergen
  estimatedCost: number;
  onStartCooking: (recipeId: string) => void;
  isGuidedCookingActive?: boolean;
}

// Ingredient Bundle Carousel Contract (SCR-003)
export interface BundleItem {
  sku: string;
  name: string;               // Topmost text in tile container (#GUARDRAIL 2)
  photoUrl: string;           // Standalone product image (#GUARDRAIL 3)
  packageQuantity: string;    // Displayed below title
  unitPrice: number;
  inStock: boolean;
  allergenTags: string[];
  isSubstituted?: boolean;
}

export interface BundleCarouselProps {
  bundleId: string;
  recipeName: string;
  items: BundleItem[];
  totalPrice: number;
  maxBudget?: number;
  savingsAmount?: number;
  onSwapItem: (sku: string) => void;
  onAddToCart: (bundleId: string) => void;
  isAddingToCart?: boolean;
}

// Cart Summary Dock Contract (SCR-003)
export interface CartSummaryDockProps {
  itemCount: number;
  subtotal: number;
  estimatedTax: number;
  total: number;
  maxBudget?: number;
  savingsAmount?: number;
  version: number;
  onAddToCart: () => void;
  isAdding?: boolean;
  isConflict?: boolean;
  onResolveConflict?: () => void;
}

// Protocol Inspector Drawer Contract (SCR-004)
export interface WireMessage {
  id: string;
  timestamp: string;
  direction: 'INCOMING' | 'OUTGOING' | 'SSE_EVENT';
  type: 'JSON_RPC' | 'SSE' | 'SYSTEM';
  method?: string;
  payload: unknown;
  latencyMs?: number;
}

export interface ProtocolInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  messages: WireMessage[];
  onClearMessages: () => void;
  onExportFrictionLog: () => void;
}

// Confirmation Modal Contract
export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}
