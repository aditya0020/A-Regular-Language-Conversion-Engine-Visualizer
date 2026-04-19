import { useRef, useEffect } from 'react';

export default function MinStepPanel({ steps, currentStep, onStepChange, partitionMap, stats }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current && currentStep >= 0) {
      listRef.current.children[currentStep]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentStep]);

  if (!steps || steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-2">
        <span className="text-2xl opacity-50">∅</span>
        <p className="text-xs font-mono text-slate-500">Minimize DFA to see steps</p>
      </div>
    );
  }

  const progress = currentStep >= 0 ? ((currentStep + 1) / steps.length) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-700/50 bg-slate-900">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest">
            Hopcroft's Steps
          </span>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {currentStep >= 0 ? currentStep + 1 : 0}
            <span className="text-slate-600">/{steps.length}</span>
          </span>
        </div>
        <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {stats && (
          <div className="flex gap-3 mt-2 text-xs font-mono">
            <span className="text-slate-500">
              <span className="text-slate-300 font-bold">{stats.original}</span>
              {' → '}
              <span className="text-purple-400 font-bold">{stats.minimized}</span>
              {' states'}
            </span>
            {stats.original > stats.minimized && (
              <span className="text-emerald-400 font-semibold">
                −{stats.original - stats.minimized} removed
              </span>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex gap-2 px-4 py-2 border-b border-slate-700/50 bg-slate-900">
        <button
          onClick={() => onStepChange(Math.max(0, currentStep - 1))}
          disabled={currentStep <= 0}
          className="flex-1 py-1.5 text-xs font-mono font-semibold bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors text-slate-200"
        >← Prev</button>
        <button
          onClick={() => onStepChange(currentStep === -1 ? 0 : Math.min(steps.length - 1, currentStep + 1))}
          disabled={currentStep >= steps.length - 1}
          className="flex-1 py-1.5 text-xs font-mono font-semibold bg-purple-700 hover:bg-purple-600 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors text-white"
        >Next →</button>
      </div>

      {/* Equivalence classes */}
      {partitionMap && Object.keys(partitionMap).length > 0 && (
        <div className="px-4 py-2.5 border-b border-slate-700/50 bg-slate-900/50">
          <div className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest mb-2">
            Equivalence Classes
          </div>
          <div className="flex flex-col gap-1">
            {Object.entries(partitionMap).map(([minState, origStates]) => (
              <div key={minState} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-purple-400 font-bold w-7">{minState}</span>
                <span className="text-slate-600">=</span>
                <span className="text-slate-300">{`{${origStates.join(', ')}}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Steps list */}
      <div ref={listRef} className="flex-1 overflow-y-auto bg-slate-950">
        {steps.map((step, i) => {
          const isActive = i === currentStep;
          const isDone   = i < currentStep;
          return (
            <div
              key={i}
              onClick={() => onStepChange(i)}
              className={`px-4 py-2.5 border-b border-slate-800/60 cursor-pointer transition-all ${
                isActive
                  ? 'bg-purple-950/40 border-l-2 border-l-purple-500'
                  : isDone
                  ? 'hover:bg-slate-800/40 border-l-2 border-l-transparent opacity-70'
                  : 'hover:bg-slate-800/40 border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold font-mono mt-0.5 ${
                  isActive ? 'bg-purple-600 text-white'
                  : isDone  ? 'bg-emerald-900/60 text-emerald-400'
                  : 'bg-slate-800 text-slate-500'
                }`}>
                  {isDone ? '✓' : i + 1}
                </span>
                <p className={`text-xs font-mono leading-relaxed ${
                  isActive ? 'text-purple-200' : 'text-slate-400'
                }`}>
                  {step.description}
                </p>
              </div>

              {isActive && step.partitions && (
                <div className="mt-2 ml-7 flex flex-col gap-1">
                  {step.partitions.map((p, j) => (
                    <div key={j} className="text-xs font-mono text-slate-400 bg-slate-900 rounded px-2.5 py-1 border border-slate-700/60">
                      <span className="text-purple-400 font-bold">P{j + 1}</span>
                      {' = {'}{p.join(', ')}{'}'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
