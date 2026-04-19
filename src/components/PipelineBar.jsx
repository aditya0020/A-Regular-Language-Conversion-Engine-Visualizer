export default function PipelineBar({ stages, activeStage, onStageClick, readyStages = new Set() }) {
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center gap-0 px-6 py-2 bg-slate-900 border-b border-slate-700/40 overflow-x-auto"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.04)' }}
    >
      {stages.map((stage, i) => {
        const isActive = activeStage === stage.id;
        const isReady  = readyStages.has(stage.id);

        return (
          <div key={stage.id} className="flex items-center">
            <button
              onClick={() => stage.available && onStageClick(stage.id)}
              disabled={!stage.available}
              title={!stage.available ? 'Complete previous steps first' : stage.label}
              className={`relative flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                  : stage.done
                  ? 'text-emerald-400 hover:bg-emerald-950/50 hover:text-emerald-300'
                  : stage.available
                  ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              {/* Step badge */}
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] leading-none font-bold ${
                stage.done
                  ? 'bg-emerald-600 text-white'
                  : isActive
                  ? 'bg-indigo-400 text-white'
                  : 'bg-slate-700 text-slate-500'
              }`}>
                {stage.done ? '✓' : i + 1}
              </span>

              {stage.label}

              {/* Pulsing "ready" dot — indicates a new result is waiting */}
              {isReady && !isActive && (
                <span
                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400"
                  style={{ animation: 'pulseReady 1.5s ease-in-out infinite' }}
                />
              )}
            </button>

            {/* Arrow connector */}
            {i < stages.length - 1 && (
              <div className={`flex items-center mx-1.5 text-xs font-bold select-none transition-colors ${
                stage.done ? 'text-emerald-700' : 'text-slate-700'
              }`}>
                →
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
