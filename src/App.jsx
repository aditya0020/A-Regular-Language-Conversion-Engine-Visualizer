import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import NFABuilder   from './components/NFABuilder';
import RegexInput   from './components/RegexInput';
import GraphView    from './components/GraphView';
import StepPanel    from './components/StepPanel';
import MinStepPanel from './components/MinStepPanel';
import StringTester from './components/StringTester';


import { subsetConstruction, compressNFA } from './utils/nfaToDfa';
import { regexToENFA }    from './utils/regexToENFA';
import { buildMinimalNFA } from './utils/minimalNFA';
import { hopcroftMinimize } from './utils/minimizeDFA';
import { nfaToFlowData, dfaToFlowData } from './utils/graphLayout';
import { normalizeNfaAutomaton, normalizeDfaAutomaton } from './utils/automata';

const INITIAL_NFA = normalizeNfaAutomaton({
  states: ['q0', 'q1', 'q2'],
  alphabet: ['a', 'b'],
  startState: 'q0',
  acceptStates: ['q2'],
  transitions: {
    q0: { a: ['q0', 'q1'], b: ['q0'] },
    q1: { a: [],            b: ['q2'] },
    q2: { a: [],            b: []     },
  },
  epsilon: { q0: [], q1: [], q2: [] },
});

export default function App() {
  // ── Input mode ───────────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState('regex');

  // ── Pipeline states (each maintained separately) ─────────────────────
  const [nfa,         setNfa]         = useState(INITIAL_NFA);
  const [enfa,        setEnfa]        = useState(null);
  const [nfaClean,    setNfaClean]    = useState(null);
  const [dfa,         setDfa]         = useState(null);
  const [minDfa,      setMinDfa]      = useState(null);
  // Stores the raw regex string so the NFA stage can re-run Glushkov independently
  const [regexString, setRegexString] = useState('');

  // ── Active canvas stage (what's shown on the single canvas) ──────────
  const [activeStage, setActiveStage] = useState('enfa'); // always start at ε-NFA stage

  // ── Simulation state ─────────────────────────────────────────────────
  const [currentStep,      setCurrentStep]      = useState(-1);
  const [minStep,          setMinStep]          = useState(-1);
  const [highlightedNodes, setHighlightedNodes] = useState([]);
  const [pathNodes,        setPathNodes]        = useState([]);
  const [traverseEdge,     setTraverseEdge]     = useState(null);
  const [simRejected,      setSimRejected]      = useState(false);
  const [isPlaying,        setIsPlaying]        = useState(false);
  const playTimerRef = useRef(null);

  // ── Right sidebar (replaces floating panels) ────────────────────────
  // null = closed; 'steps' | 'test' | 'table' = which panel is active
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [rightTab,         setRightTab]         = useState('steps');

  // ── Sidebar collapse ─────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Ready indicators ─────────────────────────────────────────────────
  const [readyStages, setReadyStages] = useState(new Set());

  const markReady = (id) => setReadyStages(prev => new Set([...prev, id]));
  const clearReady = (id) => setReadyStages(prev => { const n = new Set(prev); n.delete(id); return n; });

  // ── Reset pipeline downstream ────────────────────────────────────────
  const resetFrom = useCallback((stage) => {
    if (stage === 'enfa') { setNfaClean(null); setDfa(null); setMinDfa(null); setCurrentStep(-1); setMinStep(-1); }
    if (stage === 'nfa')  { setDfa(null); setMinDfa(null); setCurrentStep(-1); setMinStep(-1); }
    if (stage === 'dfa')  { setMinDfa(null); setMinStep(-1); }
    setHighlightedNodes([]);
    setPathNodes([]);
    setTraverseEdge(null);
    setSimRejected(false);
    setIsPlaying(false);
  }, []);

  // ── Conversion handlers ──────────────────────────────────────────────
  const handleBuildFromRegex = useCallback((regex) => {
    const result = normalizeNfaAutomaton(regexToENFA(regex));
    setEnfa(result);
    setRegexString(regex);    // remember the raw regex for the NFA stage
    resetFrom('enfa');
    markReady('enfa');
    setActiveStage('enfa');
  }, [resetFrom]);

  // Regex mode — NFA stage: Glushkov construction + bisimulation merging
  // This runs INDEPENDENTLY from the Thompson ε-NFA, giving the provably
  // minimal ε-free NFA (e.g. 3 states for (a|b)*ab) without ε-elimination.
  const handleRemoveEpsilon = useCallback(() => {
    if (!regexString) return;
    const minNFA = normalizeNfaAutomaton(buildMinimalNFA(regexString));  // Glushkov + bisimulation
    setNfaClean(minNFA);
    resetFrom('nfa');
    markReady('nfa');
    setActiveStage('nfa');
  }, [regexString, resetFrom]);

  // Builder mode: same Stage 2 compression on the manually-built NFA

  // Converts NFA → DFA via subset construction.
  // In builder mode: if nfaClean is not yet set, auto-applies ε-removal on the raw NFA first.
  const handleConvert = useCallback(() => {
    // Pick the source NFA: prefer already-compressed; fall back to compressing raw NFA
    const sourceNFA = nfaClean ?? (inputMode === 'builder' ? normalizeNfaAutomaton(compressNFA(nfa)) : null);
    if (!sourceNFA) return;

    if (!nfaClean && inputMode === 'builder') {
      setNfaClean(sourceNFA);
      markReady('nfa');
    }

    const result = normalizeDfaAutomaton(subsetConstruction(sourceNFA));
    setDfa(result);
    resetFrom('dfa');
    setCurrentStep(-1);
    markReady('dfa');
    setActiveStage('dfa');
  }, [inputMode, nfa, nfaClean, resetFrom]);

  const handleMinimize = useCallback(() => {
    if (!dfa) return;
    const result = normalizeDfaAutomaton(hopcroftMinimize(dfa));
    setMinDfa(result);
    setMinStep(-1);
    markReady('minDfa');
    setActiveStage('minDfa');
  }, [dfa]);

  // ── Step navigation ──────────────────────────────────────────────────
  const handleStepChange = useCallback((idx) => {
    setCurrentStep(idx);
    setMinStep(-1);
    setPathNodes([]);
    setTraverseEdge(null);
    setSimRejected(false);
    if (dfa && idx >= 0) {
      const step = dfa.steps[idx];
      setHighlightedNodes([step.from, step.to]);
    } else {
      setHighlightedNodes([]);
    }
  }, [dfa]);

  const handleMinStepChange = useCallback((idx) => {
    setMinStep(idx);
    setCurrentStep(-1);
    setHighlightedNodes([]);
    setPathNodes([]);
    setTraverseEdge(null);
    setSimRejected(false);
  }, []);

  const handlePathChange = useCallback((visited, current = null, rejected = false) => {
    setIsPlaying(false);
    setPathNodes(visited || []);
    setHighlightedNodes(current ? [current] : []);
    setSimRejected(rejected);
    if (visited && visited.length > 0 && current) {
      const from = visited[visited.length - 1];
      setTraverseEdge({ from, to: current, key: Date.now() });
    } else {
      setTraverseEdge(null);
    }
    if ((visited?.length > 0) || current) {
      setCurrentStep(-1);
      setMinStep(-1);
    }
  }, []);

  // ── Auto-play simulation ─────────────────────────────────────────────
  const activeSteps   = activeStage === 'minDfa' ? (minDfa?.steps || []) : (dfa?.steps || []);
  const activeStepIdx = activeStage === 'minDfa' ? minStep : currentStep;
  const setActiveStep = activeStage === 'minDfa' ? handleMinStepChange : handleStepChange;

  useEffect(() => {
    clearTimeout(playTimerRef.current);

    if (!isPlaying || activeSteps.length === 0 || activeStepIdx >= activeSteps.length - 1) return undefined;

    const nextStep = activeStepIdx === -1 ? 0 : activeStepIdx + 1;
    playTimerRef.current = setTimeout(() => {
      setActiveStep(nextStep);
      if (nextStep >= activeSteps.length - 1) setIsPlaying(false);
    }, 900);

    return () => clearTimeout(playTimerRef.current);
  }, [isPlaying, activeStepIdx, activeSteps.length, setActiveStep]);

  const simReset = () => {
    setIsPlaying(false);
    setActiveStep(-1);
    setHighlightedNodes([]);
    setPathNodes([]);
    setTraverseEdge(null);
    setSimRejected(false);
  };

  // ── Graph data ───────────────────────────────────────────────────────
  // ε-NFA: regex mode → Thompson result; builder mode → the builder's NFA (has ε col)
  const enfaFlow = useMemo(() => {
    const src = inputMode === 'builder' ? nfa : enfa;
    return src ? nfaToFlowData(src) : null;
  }, [enfa, nfa, inputMode]);
  // NFA:   always the ε-removed version
  const nfaFlow    = useMemo(() => nfaClean ? nfaToFlowData(nfaClean) : null, [nfaClean]);
  const dfaFlow    = useMemo(() => dfa    ? dfaToFlowData(dfa,    highlightedNodes, pathNodes, traverseEdge, simRejected) : null, [dfa,    highlightedNodes, pathNodes, traverseEdge, simRejected]);
  const minDfaFlow = useMemo(() => minDfa ? dfaToFlowData(minDfa, highlightedNodes, pathNodes, traverseEdge, simRejected) : null, [minDfa, highlightedNodes, pathNodes, traverseEdge, simRejected]);

  // ── Active flow data for canvas ──────────────────────────────────────
  const activeFlow = useMemo(() => {
    if (activeStage === 'enfa') return enfaFlow;
    if (activeStage === 'nfa')  return nfaFlow;
    if (activeStage === 'minDfa') return minDfaFlow;
    return dfaFlow;
  }, [activeStage, enfaFlow, nfaFlow, dfaFlow, minDfaFlow]);

  const { nodes: canvasNodes = [], edges: canvasEdges = [] } = activeFlow || {};

  // ── Pipeline stages config (unified for both modes) ──────────────────
  const pipelineStages = useMemo(() => [
    // ε-NFA: always available in builder mode; needs regex build in regex mode
    { id: 'enfa', label: 'ε-NFA', color: 'purple',
      available: inputMode === 'builder' ? true : !!enfa,
      done:      inputMode === 'builder' ? true : !!enfa },
    // NFA: available after ε-removal in both modes
    { id: 'nfa',    label: 'NFA',     color: 'indigo',  available: !!nfaClean, done: !!nfaClean },
    { id: 'dfa',    label: 'DFA',     color: 'emerald', available: !!dfa,      done: !!dfa },
    { id: 'minDfa', label: 'Min-DFA', color: 'amber',   available: !!minDfa,   done: !!minDfa },
  ], [inputMode, enfa, nfaClean, dfa, minDfa]);

  // ── Active DFA for string tester ─────────────────────────────────────
  const activeDFA = useMemo(() => {
    if (activeStage === 'dfa') return dfa;
    if (activeStage === 'minDfa') return minDfa;
    return null;
  }, [activeStage, dfa, minDfa]);

  const testPanelMessage = useMemo(() => {
    if (activeStage === 'dfa' || activeStage === 'minDfa') {
      return 'Build this machine to enable testing';
    }
    return 'Select the DFA or Min-DFA canvas to test strings';
  }, [activeStage]);

  const activeDFAKey = useMemo(() => {
    if (!activeDFA) return `no-dfa|${activeStage}`;
    return JSON.stringify({
      stage: activeStage,
      start: activeDFA.startState ?? activeDFA.start ?? '',
      states: activeDFA.states ?? [],
      acceptStates: activeDFA.acceptStates ?? activeDFA.accept ?? [],
      alphabet: activeDFA.alphabet ?? [],
      transitions: activeDFA.transitions ?? {},
    });
  }, [activeDFA, activeStage]);

  // ── Stats ─────────────────────────────────────────────────────────────
  const dfaStats = dfa  ? { states: dfa.states.length,  accept: dfa.acceptStates.length } : null;
  const minStats = minDfa ? { original: minDfa.originalStateCount, minimized: minDfa.minimizedStateCount } : null;

  // ── Which "ready" stage to auto-switch to on stage click ─────────────
  const handleStageClick = (id) => {
    setIsPlaying(false);
    clearReady(id);
    setActiveStage(id);
  };

  // ── Next action button (what to do next in the pipeline) ─────────────
  // eslint-disable-next-line no-unused-vars
  const nextAction = useMemo(() => {
    if (inputMode === 'regex') {
      if (!enfa)     return null;
      if (!nfaClean) return { label: 'ε → NFA', action: handleRemoveEpsilon, color: 'purple' };
      if (!dfa)      return { label: '→ DFA',    action: handleConvert,       color: 'indigo' };
      if (!minDfa)   return { label: '✦ Minimize', action: handleMinimize,   color: 'amber' };
      return null;
    } else {
      // Builder mode: Convert goes directly, auto-removing ε if needed
      if (!dfa)    return { label: '⚡ Convert → DFA', action: handleConvert,   color: 'indigo' };
      if (!minDfa) return { label: '✦ Minimize DFA',  action: handleMinimize, color: 'amber' };
      return null;
    }
  }, [inputMode, enfa, nfaClean, dfa, minDfa, handleConvert, handleMinimize, handleRemoveEpsilon]);

  // ── Transition table data for the active automaton stage ────────────────
  const tableInfo = useMemo(() => {
    if (activeStage === 'enfa') {
      const src = inputMode === 'builder' ? nfa : enfa;
      return src ? { automaton: src, type: 'enfa', label: 'ε-NFA' } : null;
    }
    if (activeStage === 'nfa')    return nfaClean ? { automaton: nfaClean, type: 'nfa',    label: 'NFA' }     : null;
    if (activeStage === 'dfa')    return dfa      ? { automaton: dfa,      type: 'dfa',    label: 'DFA' }     : null;
    if (activeStage === 'minDfa') return minDfa   ? { automaton: minDfa,   type: 'minDfa', label: 'Min-DFA' } : null;
    return null;
  }, [activeStage, inputMode, nfa, enfa, nfaClean, dfa, minDfa]);

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: 'var(--bg-base)',
      fontFamily: 'var(--font-body)',
    }}>

      {/* ── Top Stage Tabs (thin bar) ─────────────────────────────────── */}
      <div style={{
        flexShrink: 0, height: 40,
        display: 'flex', alignItems: 'center',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.03)',
        zIndex: 10,
      }}>
        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{
            width: sidebarOpen ? 255 : 44,
            flexShrink: 0,
            height: '100%',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center',
            padding: '0 12px',
            gap: 8,
            background: 'rgba(255,255,255,0.02)',
            cursor: 'pointer',
            transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <span style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0, lineHeight: 1 }}>
            {sidebarOpen ? '◀' : '▶'}
          </span>
          {sidebarOpen && (
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              color: 'var(--text-muted)', textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
            }}>
              Automata Lab
            </span>
          )}
        </button>

        {/* Stage tabs */}
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, paddingLeft: 8, gap: 2, overflowX: 'auto' }}>
          {pipelineStages.map((stage, i) => {
            const isActive = activeStage === stage.id;
            const isReady  = readyStages.has(stage.id);
            const colorMap = {
              purple:  { active: '#b44dff', badge: '#b44dff' },
              indigo:  { active: '#6e56cf', badge: '#6e56cf' },
              emerald: { active: '#00ff88', badge: '#00b060' },
              amber:   { active: '#ffb800', badge: '#cc9000' },
            };
            const c = colorMap[stage.color] || colorMap.indigo;
            return (
              <div key={stage.id} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => stage.available && handleStageClick(stage.id)}
                  disabled={!stage.available}
                  style={{
                    position: 'relative',
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '0 14px', height: 40,
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                    cursor: stage.available ? 'pointer' : 'not-allowed',
                    opacity: stage.available ? 1 : 0.3,
                    color: isActive ? c.active : stage.done ? 'var(--text-secondary)' : 'var(--text-muted)',
                    borderBottom: isActive ? `2px solid ${c.active}` : '2px solid transparent',
                    background: isActive ? `${c.active}11` : 'transparent',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {/* Done check or step number */}
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700,
                    background: stage.done ? c.badge : isActive ? c.active : 'var(--bg-overlay)',
                    color: stage.done || isActive ? '#fff' : 'var(--text-muted)',
                    boxShadow: isActive ? `0 0 8px ${c.active}66` : 'none',
                    transition: 'all 0.2s',
                  }}>
                    {stage.done ? '✓' : i + 1}
                  </span>
                  {stage.label}

                  {/* Ready pulse dot */}
                  {isReady && !isActive && (
                    <span style={{
                      position: 'absolute', top: 6, right: 4,
                      width: 6, height: 6, borderRadius: '50%',
                      background: '#00ff88',
                      animation: 'pulseReady 1.5s ease-in-out infinite',
                    }} />
                  )}
                </button>

                {i < pipelineStages.length - 1 && (
                  <span style={{ color: 'var(--border)', fontSize: 10, margin: '0 2px', userSelect: 'none' }}>→</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Right side: stats + sidebar toggle */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {/* Stats chip */}
          {activeStage === 'dfa' && dfaStats && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', paddingRight: 8 }}>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>{dfaStats.states}</span> states·
              <span style={{ color: '#34d399', fontWeight: 700 }}>{dfaStats.accept}</span> accept
            </span>
          )}
          {activeStage === 'minDfa' && minStats && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', paddingRight: 8 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{minStats.original}</span>
              {' → '}
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>{minStats.minimized}</span> states
            </span>
          )}

          {/* Right sidebar collapse toggle */}
          <button
            onClick={() => setRightSidebarOpen(o => !o)}
            title={rightSidebarOpen ? 'Collapse tools' : 'Expand tools'}
            style={{
              width: rightSidebarOpen ? 255 : 44,
              flexShrink: 0,
              height: 40,
              borderLeft: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              padding: '0 12px',
              gap: 8,
              background: 'rgba(255,255,255,0.02)',
              cursor: 'pointer',
              transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {rightSidebarOpen && (
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                color: 'var(--text-muted)', textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
              }}>Tools</span>
            )}
            <span style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0, lineHeight: 1 }}>
              {rightSidebarOpen ? '▶' : '◀'}
            </span>
          </button>
        </div>
      </div>

      {/* ── Main area: sidebar + canvas ──────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Left Sidebar ─────────────────────────────────────────────── */}
        <div style={{
          width: sidebarOpen ? 255 : 0,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ width: 255, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Title block */}
            <div style={{
              padding: '16px 16px 12px',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0,
            }}>
              <h1 style={{
                margin: 0,
                fontSize: 18, fontWeight: 700,
                fontFamily: 'var(--font-heading)',
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}>
                Automata Lab
              </h1>
              <p style={{
                margin: '2px 0 0',
                fontSize: 10, fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
              }}>
                Regex → ε-NFA → NFA → DFA → Min-DFA
              </p>

              {/* Mode toggle */}
              <div style={{
                display: 'flex', gap: 4, marginTop: 10,
                background: 'var(--bg-elevated)', borderRadius: 8,
                padding: 3, border: '1px solid var(--border-subtle)',
              }}>
                {[
                  { id: 'builder', label: '⚙ NFA Builder' },
                  { id: 'regex',   label: '✦ Regex' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setInputMode(m.id);
                      if (m.id === 'builder') setActiveStage('enfa');
                      else if (enfa) setActiveStage('enfa');
                    }}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 6,
                      fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                      background: inputMode === m.id ? 'var(--accent)' : 'transparent',
                      color: inputMode === m.id ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: inputMode === m.id ? '0 2px 8px rgba(110,86,207,0.35)' : 'none',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input panel (scrollable) */}
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              {inputMode === 'builder' ? (
                <NFABuilder
                  nfa={nfa}
                  onNFAChange={(n) => { setNfa(normalizeNfaAutomaton(n)); setNfaClean(null); resetFrom('nfa'); setActiveStage('enfa'); }}
                  onConvert={handleConvert}
                  onMinimize={handleMinimize}
                  hasDfa={!!dfa}
                  hasMinDfa={!!minDfa}
                />
              ) : (
                <RegexInput
                  onBuild={handleBuildFromRegex}
                  built={!!enfa}
                  hasNfaClean={!!nfaClean}
                  hasDfa={!!dfa}
                  hasMinDfa={!!minDfa}
                  onRemoveEpsilon={handleRemoveEpsilon}
                  onConvert={handleConvert}
                  onMinimize={handleMinimize}
                  activeStage={activeStage}
                  onStageChange={handleStageClick}
                />
              )}
            </div>


          </div>
        </div>

        {/* ── Canvas Area ────────────────────────────────────────────── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>

          {/* The graph */}
          {canvasNodes.length > 0 ? (
            <GraphView nodes={canvasNodes} edges={canvasEdges} />
          ) : (
            <EmptyCanvas activeStage={activeStage} inputMode={inputMode} />
          )}

          {/* Sim controls are now inside the right sidebar Steps tab */}

          {/* ── Stage label (bottom-left of canvas) ─────────────────── */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16,
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-muted)',
            background: 'rgba(13,17,23,0.7)',
            backdropFilter: 'blur(8px)',
            padding: '4px 10px', borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            zIndex: 5, userSelect: 'none',
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {pipelineStages.find(s => s.id === activeStage)?.label || '—'}
          </div>
        </div>

        {/* ── Right Sidebar ──────────────────────────────────────── */}
        <div style={{
          width: rightSidebarOpen ? 255 : 0,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ width: 255, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── Tab bar ─────────────────────────────────────────── */}
            <div style={{
              flexShrink: 0,
              display: 'flex',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
            }}>
              {[
                { id: 'steps', icon: '≡', label: activeStage === 'minDfa' ? "Hopcroft" : 'Steps' },
                { id: 'test',  icon: '▷', label: 'Test' },
                { id: 'table', icon: '⊞', label: 'Table' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setRightTab(tab.id)}
                  style={{
                    flex: 1, padding: '9px 4px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    fontFamily: 'var(--font-mono)', fontWeight: 700,
                    fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase',
                    cursor: 'pointer',
                    color: rightTab === tab.id ? '#38bdf8' : 'var(--text-muted)',
                    borderBottom: rightTab === tab.id ? '2px solid #38bdf8' : '2px solid transparent',
                    background: rightTab === tab.id ? 'rgba(56,189,248,0.07)' : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Tab content ──────────────────────────────────────── */}
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>

              {/* Steps tab */}
              {rightTab === 'steps' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                  {/* Inline sim controls */}
                  {(activeStage === 'dfa' || activeStage === 'minDfa') && activeSteps.length > 0 && (
                    <div style={{
                      flexShrink: 0, padding: '8px 12px',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'var(--bg-elevated)',
                    }}>
                      <SimBtn title="First" disabled={activeStepIdx <= 0}
                        onClick={() => setActiveStep(0)}>⏮</SimBtn>
                      <SimBtn title="Back" disabled={activeStepIdx <= 0}
                        onClick={() => setActiveStep(Math.max(0, activeStepIdx - 1))}>‹</SimBtn>
                      <SimBtn title={isPlaying ? 'Pause' : 'Play'} active={isPlaying}
                        onClick={() => setIsPlaying(p => !p)}>
                        {isPlaying ? '⏸' : '▶'}
                      </SimBtn>
                      <SimBtn title="Forward" disabled={activeStepIdx >= activeSteps.length - 1}
                        onClick={() => setActiveStep(activeStepIdx === -1 ? 0 : Math.min(activeSteps.length - 1, activeStepIdx + 1))}>›</SimBtn>
                      <SimBtn title="Last" disabled={activeStepIdx >= activeSteps.length - 1}
                        onClick={() => setActiveStep(activeSteps.length - 1)}>⏭</SimBtn>
                      <SimBtn title="Reset" onClick={simReset}>&#8634;</SimBtn>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10,
                        color: 'var(--text-muted)', marginLeft: 'auto',
                        minWidth: 36, textAlign: 'right',
                      }}>
                        {activeStepIdx >= 0 ? `${activeStepIdx + 1}/${activeSteps.length}` : `—/${activeSteps.length}`}
                      </span>
                    </div>
                  )}
                  {/* Step list */}
                  <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    {activeStage === 'minDfa' ? (
                      <MinStepPanel
                        steps={minDfa?.steps || []}
                        currentStep={minStep}
                        onStepChange={handleMinStepChange}
                        partitionMap={minDfa?.partitionMap}
                        stats={minStats}
                      />
                    ) : (
                      <StepPanel
                        steps={dfa?.steps || []}
                        currentStep={currentStep}
                        onStepChange={handleStepChange}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Test tab */}
              {rightTab === 'test' && (
                <StringTester
                  key={activeDFAKey}
                  dfa={activeDFA}
                  emptyMessage={testPanelMessage}
                  onPathChange={handlePathChange}
                />
              )}

              {/* Table tab */}
              {rightTab === 'table' && (
                tableInfo ? (
                  <RightSidebarTable
                    automaton={tableInfo.automaton}
                    type={tableInfo.type}
                    label={tableInfo.label}
                  />
                ) : (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:8, padding:20 }}>
                    <span style={{ fontSize: 32, opacity: 0.25 }}>∅</span>
                    <p style={{ fontSize: 11, fontFamily:'var(--font-mono)', color:'var(--text-muted)', textAlign:'center', margin:0, lineHeight: 1.6 }}>
                      No automaton built<br/>for this stage yet
                    </p>
                  </div>
                )
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sim Button ────────────────────────────────────────────────────────────
function SimBtn({ children, onClick, disabled, title, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`sim-btn ${active ? 'active' : ''}`}
    >
      {children}
    </button>
  );
}

// ── Panel Toggle Button ───────────────────────────────────────────────────
function PanelToggle({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 11px',
        background: active ? 'rgba(110,86,207,0.2)' : 'rgba(13,17,23,0.88)',
        border: `1px solid ${active ? 'rgba(110,86,207,0.7)' : 'var(--border)'}`,
        borderRadius: 8,
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
        color: active ? '#b09af0' : 'var(--text-secondary)',
        cursor: 'pointer',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        transition: 'all 0.18s ease',
      }}
    >
      <span style={{ fontSize: 12 }}>{icon}</span>
      {label}
    </button>
  );
}

// ── Empty canvas placeholder ──────────────────────────────────────────────
function EmptyCanvas({ activeStage, inputMode }) {
  const messages = {
    enfa:    { icon: '✦', text: 'Enter a regex in the sidebar and click "Build ε-NFA"', sub: 'Thompson\'s construction' },
    nfa:     { icon: '∿', text: inputMode === 'regex' ? 'Click "Remove ε-transitions → NFA" in sidebar' : 'Your NFA from the builder will appear here', sub: 'ε-closure elimination' },
    dfa:     { icon: '⚡', text: 'Click "Convert → DFA" in the sidebar', sub: 'Subset construction algorithm' },
    minDfa:  { icon: '✦', text: 'Click "Minimize DFA" in the sidebar', sub: "Hopcroft's algorithm" },
  };
  const msg = messages[activeStage] || messages.nfa;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 12, userSelect: 'none',
      background: 'var(--bg-base)',
    }}>
      {/* Dot grid background */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle, var(--border-subtle) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        opacity: 0.5,
      }} />

      <div style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 10,
        padding: '32px 48px',
        background: 'rgba(13,17,23,0.8)',
        backdropFilter: 'blur(16px)',
        borderRadius: 16, border: '1px solid var(--border-subtle)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <span style={{ fontSize: 40, opacity: 0.5 }}>{msg.icon}</span>
        <p style={{
          margin: 0, fontSize: 14, fontFamily: 'var(--font-body)',
          color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'center',
        }}>{msg.text}</p>
        <p style={{
          margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
        }}>{msg.sub}</p>
      </div>
    </div>
  );
}

// ── Right Sidebar Transition Table (vertical layout, no horizontal scroll) ──
function RightSidebarTable({ automaton, type }) {
  if (!automaton) return null;
  const isNFA   = type === 'enfa' || type === 'nfa';
  const normalized = isNFA ? normalizeNfaAutomaton(automaton) : normalizeDfaAutomaton(automaton);
  const { states = [], alphabet = [], transitions = {}, epsilon = {}, startState, acceptStates = [] } = normalized;
  const showEps = type === 'enfa';
  const cols    = showEps ? [...alphabet, 'ε'] : [...alphabet];

  const getCell = (state, sym) => {
    if (sym === 'ε') {
      const eps = epsilon?.[state] || [];
      return eps.length === 0 ? '∅' : eps.join(', ');
    }
    const val = transitions[state]?.[sym];
    if (isNFA) {
      if (!val || (Array.isArray(val) && val.length === 0)) return '∅';
      return Array.isArray(val) ? val.join(', ') : val;
    }
    return val || '∅';
  };

  const typeColors = { enfa: '#b44dff', nfa: '#6e56cf', dfa: '#00c870', minDfa: '#ffb800' };
  const hdrColor   = typeColors[type] || '#00c870';

  return (
    <div style={{ overflowY: 'auto', overflowX: 'hidden', height: '100%', padding: '8px 10px' }}>
      {states.map(state => {
        const isStart  = state === startState;
        const isAccept = acceptStates.includes(state);
        const isDead   = state === '∅';
        return (
          <div key={state} style={{
            marginBottom: 8, borderRadius: 7,
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
            background: isDead ? 'rgba(0,0,0,0.15)' : 'var(--bg-elevated)',
          }}>
            {/* State header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 8px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'rgba(255,255,255,0.02)',
            }}>
              {isStart  && <span style={{ color: '#6e56cf', fontSize: 10, flexShrink: 0 }}>→</span>}
              {isAccept && <span style={{ color: '#00c870', fontSize: 10, flexShrink: 0 }}>*</span>}
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
                color: isDead ? 'var(--text-muted)' : isAccept ? '#00e080' : isStart ? '#9080d0' : 'var(--text-secondary)',
                wordBreak: 'break-all',
              }}>
                {isNFA ? state : (state === '∅' ? '∅' : `{${state}}`)}
              </span>
            </div>
            {/* One row per symbol */}
            {cols.map((sym, si) => {
              const val     = getCell(state, sym);
              const isEmpty = val === '∅';
              return (
                <div key={sym} style={{
                  display: 'flex', alignItems: 'flex-start', padding: '3px 8px', gap: 6,
                  borderBottom: si < cols.length - 1 ? '1px solid rgba(33,38,45,0.6)' : 'none',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                    flexShrink: 0, minWidth: 12,
                    color: sym === 'ε' ? '#b44dff' : hdrColor,
                  }}>{sym}</span>
                  <span style={{
                    color: 'var(--border)', fontSize: 10, flexShrink: 0,
                    borderLeft: '1px solid var(--border-subtle)',
                    marginLeft: 2, marginRight: 4, alignSelf: 'stretch',
                  }} />
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: isEmpty ? 'var(--text-muted)' : hdrColor,
                    fontWeight: isEmpty ? 400 : 600,
                    wordBreak: 'break-word', lineHeight: 1.5,
                  }}>{val}</span>
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{
        marginTop: 6, fontSize: 9, fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: 8,
      }}>
        <span><span style={{ color: '#6e56cf' }}>→</span> start</span>
        <span><span style={{ color: '#00c870' }}>*</span> accept</span>
        {showEps && <span><span style={{ color: '#b44dff' }}>ε</span> epsilon</span>}
        <span style={{ marginLeft: 'auto' }}>{states.length} states · {alphabet.length} symbols</span>
      </div>
    </div>
  );
}
