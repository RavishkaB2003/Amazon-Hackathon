import React from 'react';
import { Play, Clock, Users, DollarSign, ShieldCheck, Flame, Check } from 'lucide-react';
import type { RecipeCardProps } from '../types/ui';

export const RecipeCard: React.FC<RecipeCardProps> = ({
  id,
  title,
  photoUrl,
  prepTimeMinutes,
  cookTimeMinutes,
  servings,
  macros,
  allergenCertifications,
  estimatedCost,
  onStartCooking,
  isGuidedCookingActive = false,
}) => {
  return (
    <article
      data-testid="recipe-card"
      aria-label={`Recipe: ${title}`}
      className="w-full max-w-xl mx-auto rounded-xl border border-[#334155] bg-[#1e293b] shadow-card overflow-hidden flex flex-col"
    >
      {/* 1. Standalone Photo Container (#GUARDRAIL 3: Standalone Photos, zero text overlay, zero scrims) */}
      <div className="w-full aspect-video bg-[#0f172a] overflow-hidden flex items-center justify-center border-b border-[#334155]">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="text-[#94a3b8] flex flex-col items-center justify-center p-6 text-center">
            <Flame className="w-12 h-12 text-[#64748b] mb-2" aria-hidden="true" />
            <span className="text-caption font-medium">Recipe Presentation Image</span>
          </div>
        )}
      </div>

      {/* 2. Solid Text Panel Below Photo (#GUARDRAIL 3, #GUARDRAIL 4: Dark Theme Only) */}
      <div className="p-6 flex flex-col flex-1 bg-[#1e293b]">
        {/* #GUARDRAIL 2: Zero Text Above Headings - Title MUST be the first text element in container */}
        <h2
          data-testid="recipe-title"
          className="text-h1 font-semibold text-[#f8fafc] leading-snug mb-3"
        >
          {title}
        </h2>

        {/* Metadata Row: Prep, Cook, Servings, Cost (Strictly below heading) */}
        <div className="flex flex-wrap items-center gap-4 text-caption text-[#94a3b8] mb-4 pb-4 border-b border-[#334155]">
          <div className="flex items-center gap-1.5" data-testid="recipe-prep-time">
            <Clock className="w-4 h-4 text-[#38bdf8]" aria-hidden="true" />
            <span>Prep: {prepTimeMinutes}m</span>
          </div>

          {cookTimeMinutes !== undefined && (
            <div className="flex items-center gap-1.5" data-testid="recipe-cook-time">
              <Clock className="w-4 h-4 text-[#38bdf8]" aria-hidden="true" />
              <span>Cook: {cookTimeMinutes}m</span>
            </div>
          )}

          <div className="flex items-center gap-1.5" data-testid="recipe-servings">
            <Users className="w-4 h-4 text-[#38bdf8]" aria-hidden="true" />
            <span>{servings} {servings === 1 ? 'serving' : 'servings'}</span>
          </div>

          <div className="flex items-center gap-1.5" data-testid="recipe-cost">
            <DollarSign className="w-4 h-4 text-[#10b981]" aria-hidden="true" />
            <span className="font-semibold text-[#f8fafc]">${estimatedCost.toFixed(2)}</span>
          </div>
        </div>

        {/* Macronutrient Pills (Badge/Nutrition) */}
        <div className="mb-4">
          <span className="block text-caption font-medium text-[#94a3b8] mb-2">
            Nutrition (per serving)
          </span>
          <div className="flex flex-wrap gap-2" data-testid="recipe-macros">
            <span
              data-testid="macro-calories"
              className="px-3 py-1.5 rounded-full text-caption font-medium bg-[#1e293b] text-[#f8fafc] border border-[#64748b]"
            >
              {macros.calories} kcal
            </span>
            <span
              data-testid="macro-protein"
              className="px-3 py-1.5 rounded-full text-caption font-medium bg-[#1e293b] text-[#10b981] border border-[#10b981]"
            >
              <strong>{macros.proteinGrams}g</strong> Protein
            </span>
            <span
              data-testid="macro-carbs"
              className="px-3 py-1.5 rounded-full text-caption font-medium bg-[#1e293b] text-[#94a3b8] border border-[#334155]"
            >
              {macros.carbsGrams}g Carbs
            </span>
            <span
              data-testid="macro-fats"
              className="px-3 py-1.5 rounded-full text-caption font-medium bg-[#1e293b] text-[#94a3b8] border border-[#334155]"
            >
              {macros.fatsGrams}g Fat
            </span>
          </div>
        </div>

        {/* Allergen & Dietary Safety Badges */}
        {allergenCertifications && allergenCertifications.length > 0 && (
          <div className="mb-6">
            <span className="block text-caption font-medium text-[#94a3b8] mb-2">
              Dietary Certifications
            </span>
            <div className="flex flex-wrap gap-2" data-testid="recipe-allergens">
              {allergenCertifications.map((allergen, idx) => (
                <span
                  key={idx}
                  data-testid={`allergen-badge-${idx}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-caption font-medium bg-[#1e293b] text-[#10b981] border border-[#10b981]"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" aria-hidden="true" />
                  {allergen}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Primary Action Button (Start Guided Cooking) - Min 48x48px hit area per NFR-009 */}
        <div className="mt-auto pt-2">
          <button
            type="button"
            onClick={() => onStartCooking(id)}
            data-testid="btn-start-cooking"
            className={`w-full min-h-[52px] sm:min-h-[56px] px-6 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold text-h2 transition-colors focus-visible:outline-none ${
              isGuidedCookingActive
                ? 'bg-[#10b981] text-[#0f172a]'
                : 'bg-[#38bdf8] text-[#0f172a] hover:bg-[#7dd3fc]'
            }`}
            aria-label={isGuidedCookingActive ? 'Guided cooking currently active' : `Start guided cooking for ${title}`}
          >
            {isGuidedCookingActive ? (
              <>
                <Check className="w-5 h-5 text-[#0f172a]" aria-hidden="true" />
                Guided Cooking Active
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current text-[#0f172a]" aria-hidden="true" />
                Start Guided Cooking
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};
