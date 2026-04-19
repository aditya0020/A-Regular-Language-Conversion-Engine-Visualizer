import { useState, useCallback, useEffect, useRef } from 'react';
import { normalizeNfaAutomaton } from '../utils/automata';

const V = (n) => `var(${n})`;


// ── Random NFA generator ───────────────────────────────────────────────────
const ALPHA_POOLS = [
  ['a','b'], ['0','1'], ['a','b','c'], ['x','y','z'],
  ['p','q','r'], ['0','1','2'], ['a','b','c','d'],
  ['u','v','w'], ['0','1','2','3'], ['a','b','c','d','e'],
];

function randomNFA() {
  const numStates  = 3 + Math.floor(Math.random() * 6);        // 3–8
  const pool       = ALPHA_POOLS[Math.floor(Math.random() * ALPHA_POOLS.length)];
  const alphaSize  = 1 + Math.floor(Math.random() * Math.min(3, pool.length));
  const alphabet   = pool.slice(0, alphaSize);
  const states     = Array.from({ length: numStates }, (_, i) => `q${i}`);
  const start      = 'q0';

  const numAccept  = 1 + Math.floor(Math.random() * Math.max(1, Math.floor(numStates / 2)));
  const acceptSet  = new Set();
  while (acceptSet.size < numAccept) acceptSet.add(Math.floor(Math.random() * numStates));
  const accept = [...acceptSet].map(i => states[i]);

  const transitions = {};
  const epsilon     = {};

  states.forEach(s => {
    transitions[s] = {};
    alphabet.forEach(sym => {
      if (Math.random() < 0.55) {
        const numT = Math.random() < 0.25 ? 2 : 1;
        const tset = new Set();
        for (let k = 0; k < numT * 3 && tset.size < numT; k++)
          tset.add(states[Math.floor(Math.random() * numStates)]);
        transitions[s][sym] = [...tset];
      } else {
        transitions[s][sym] = [];
      }
    });
    epsilon[s] = [];
    if (Math.random() < 0.25) {
      const t = states[Math.floor(Math.random() * numStates)];
      if (t !== s) epsilon[s] = [t];
    }
  });

  return { states, alphabet, start, accept, transitions, epsilon };
}

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ label, open, onToggle, count }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', width: '100%',
        padding: '7px 16px 5px', cursor: 'pointer',
        background: 'none', border: 'none', textAlign: 'left',
      }}
    >
      <span style={{
        flex: 1, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', fontFamily: V('--font-mono'), color: V('--text-muted'),
      }}>
        {label}
        {count != null && (
          <span style={{
            marginLeft: 6, fontSize: 8,
            background: V('--bg-overlay'), color: V('--text-muted'),
            padding: '1px 5px', borderRadius: 8,
            border: `1px solid ${V('--border-subtle')}`,
          }}>{count}</span>
        )}
      </span>
      <span style={{
        fontSize: 8, color: V('--text-muted'),
        transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 0.2s', display: 'inline-block',
      }}>▼</span>
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: V('--border-subtle'), margin: '2px 0' }} />;
}

// ── Transition cell ────────────────────────────────────────────────────────
function TransitionCell({ value, onCommit }) {
  const [raw, setRaw]         = useState(value);
  const [focused, setFocused] = useState(false);
  const inputRef              = useRef(null);

  // Sync parent value → local only when the cell isn't focused
  // (e.g. after Random / preset load resets the whole NFA)
  useEffect(() => {
    if (!focused) setRaw(value);
  }, [value, focused]);

  const handleChange = (e) => {
    const next = e.target.value;
    setRaw(next);
    onCommit(next);   // ← live update on every keystroke
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={raw}
      placeholder="∅"
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); onCommit(raw); }}
      onKeyDown={e => e.key === 'Enter' && inputRef.current?.blur()}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: V('--bg-overlay'),
        border: `1px solid ${V('--border-subtle')}`,
        borderRadius: 4, padding: '3px 4px',
        fontFamily: V('--font-mono'), fontSize: 10,
        color: V('--text-secondary'), textAlign: 'center',
        outline: 'none', transition: 'border-color 0.15s',
      }}
      onFocusCapture={e => { e.target.style.borderColor = '#38bdf8'; }}
      onBlurCapture={e  => { e.target.style.borderColor = V('--border-subtle'); }}
    />
  );
}

// ── Pipeline button ────────────────────────────────────────────────────────
function PipeBtn({ children, onClick, cls = 'indigo' }) {
  const map = {
    indigo: { bg: 'rgba(110,86,207,0.18)', border: 'rgba(110,86,207,0.45)', color: '#a08fef', hBg: 'rgba(110,86,207,0.28)', hBorder: 'rgba(110,86,207,0.6)', hColor: '#c0b0ff' },
    amber:  { bg: 'rgba(255,184,0,0.12)',  border: 'rgba(255,184,0,0.35)',  color: '#e0a820', hBg: 'rgba(255,184,0,0.2)',  hBorder: 'rgba(255,184,0,0.5)',  hColor: '#ffcc40' },
  };
  const c = map[cls] || map.indigo;
  return (
    <button onClick={onClick}
      style={{
        width: '100%', padding: '9px 12px', borderRadius: 8,
        fontFamily: V('--font-mono'), fontSize: 12, fontWeight: 700,
        letterSpacing: '0.02em', cursor: 'pointer',
        background: c.bg, border: `1px solid ${c.border}`, color: c.color,
        transition: 'all 0.18s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = c.hBg; e.currentTarget.style.borderColor = c.hBorder; e.currentTarget.style.color = c.hColor; }}
      onMouseLeave={e => { e.currentTarget.style.background = c.bg; e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.color; }}
    >
      {children}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function NFABuilder({ nfa, onNFAChange, onConvert, onMinimize, hasDfa = false, hasMinDfa = false }) {
  const [newState,  setNewState]  = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [showStates,  setShowStates]  = useState(true);
  const [showAlpha,   setShowAlpha]   = useState(true);
  const [showSA,      setShowSA]      = useState(true);
  const [showTrans,   setShowTrans]   = useState(true);
  const automaton = normalizeNfaAutomaton(nfa);
  const { states, alphabet, startState, acceptStates, transitions, epsilon } = automaton;

  // ── State ops ──────────────────────────────────────────────────────────
  const addState = () => {
    const s = newState.trim();
    if (!s || states.includes(s)) return;
    const t = { ...transitions };
    const e = { ...epsilon };
    t[s] = Object.fromEntries(alphabet.map(sym => [sym, []]));
    e[s] = [];
    onNFAChange(normalizeNfaAutomaton({ ...automaton, states: [...states, s], transitions: t, epsilon: e }));
    setNewState('');
  };

  const removeState = (toRemove) => {
    if (states.length <= 1) return;
    const nextStates = states.filter(s => s !== toRemove);
    const nextTransitions = {};
    const nextEpsilon = {};
    nextStates.forEach(s => {
      nextTransitions[s] = {};
      alphabet.forEach(sym => {
        nextTransitions[s][sym] = (transitions[s]?.[sym] || []).filter(t => t !== toRemove);
      });
      nextEpsilon[s] = (epsilon[s] || []).filter(t => t !== toRemove);
    });
    onNFAChange(normalizeNfaAutomaton({
      ...automaton,
      states: nextStates,
      startState: startState === toRemove ? nextStates[0] : startState,
      acceptStates: acceptStates.filter(s => s !== toRemove),
      transitions: nextTransitions,
      epsilon: nextEpsilon,
    }));
  };

  // ── Alphabet ops ───────────────────────────────────────────────────────
  const addSymbol = () => {
    const sym = newSymbol.trim();
    if (!sym || sym === 'ε' || alphabet.includes(sym) || sym.length > 3) return;
    const nextTransitions = {};
    states.forEach(s => {
      nextTransitions[s] = { ...transitions[s], [sym]: [] };
    });
    onNFAChange({ ...automaton, alphabet: [...alphabet, sym], transitions: nextTransitions });
    setNewSymbol('');
  };

  const removeSymbol = (sym) => {
    if (alphabet.length <= 1) return;
    const nextAlphabet = alphabet.filter(s => s !== sym);
    const nextTransitions = {};
    states.forEach(s => {
      nextTransitions[s] = {};
      nextAlphabet.forEach(a => { nextTransitions[s][a] = transitions[s]?.[a] || []; });
    });
    onNFAChange({ ...automaton, alphabet: nextAlphabet, transitions: nextTransitions });
  };

  // ── Transitions ────────────────────────────────────────────────────────
  const commitTransition = useCallback((state, sym, raw) => {
    const targets = raw.split(',').map(s => s.trim()).filter(s => states.includes(s));
    onNFAChange({ ...automaton, transitions: { ...transitions, [state]: { ...transitions[state], [sym]: targets } } });
  }, [automaton, onNFAChange, states, transitions]);

  const commitEpsilon = useCallback((state, raw) => {
    const targets = raw.split(',').map(s => s.trim()).filter(s => states.includes(s));
    onNFAChange({ ...automaton, epsilon: { ...epsilon, [state]: targets } });
  }, [automaton, epsilon, onNFAChange, states]);

  // ── Summary line ───────────────────────────────────────────────────────
  const hasEps = Object.values(epsilon || {}).some(arr => arr.length > 0);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', width: '100%',
      background: V('--bg-surface'), overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, padding: '12px 16px 10px',
        borderBottom: `1px solid ${V('--border-subtle')}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, fontFamily: V('--font-mono'),
            color: V('--text-secondary'), textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>NFA Builder</span>
          <span style={{ fontSize: 10, fontFamily: V('--font-mono'), color: V('--text-muted') }}>
            Manual
          </span>
        </div>
        {/* Mini summary */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { label: `${states.length} states`, color: '#38bdf8' },
            { label: `Σ={${alphabet.join(',')}}`, color: '#34d399' },
            { label: `start: ${startState}`, color: V('--text-muted') },
            { label: `accept: {${acceptStates.join(',')}}`, color: '#fb923c' },
            hasEps ? { label: 'has ε', color: '#a78bfa' } : null,
          ].filter(Boolean).map((chip, i) => (
            <span key={i} style={{
              fontSize: 9, fontFamily: V('--font-mono'), padding: '1px 6px',
              borderRadius: 4, background: V('--bg-overlay'),
              border: `1px solid ${V('--border-subtle')}`, color: chip.color,
            }}>{chip.label}</span>
          ))}
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>


        {/* ── Random button ─────────────────────────────────────────── */}
        <div style={{ padding: '4px 14px 8px' }}>
          <button
            onClick={() => onNFAChange(randomNFA())}
            style={{
              width: '100%', padding: '9px 0', borderRadius: 7, cursor: 'pointer',
              background: V('--bg-elevated'),
              border: `1px solid ${V('--border')}`,
              fontFamily: V('--font-mono'), fontSize: 13, fontWeight: 700,
              color: V('--text-muted'),
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.color = '#fbbf24'; e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = V('--border'); e.currentTarget.style.color = V('--text-muted'); e.currentTarget.style.background = V('--bg-elevated'); }}
          >
            <span style={{ fontSize: 16 }}>⚄</span> Random NFA
          </button>
          <p style={{ fontSize: 9, fontFamily: V('--font-mono'), color: V('--text-muted'), margin: '4px 0 0', textAlign: 'center' }}>
            3–8 states · varied alphabets · may include ε
          </p>
        </div>

        <Divider />

        {/* ── States ────────────────────────────────────────────────── */}
        <SectionHeader label="States (Q)" open={showStates} onToggle={() => setShowStates(o => !o)} count={states.length} />
        {showStates && (
          <div style={{ padding: '2px 14px 8px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {states.map(s => (
                <span key={s} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 7px', borderRadius: 5,
                  background: s === startState ? 'rgba(56,189,248,0.1)' : V('--bg-elevated'),
                  border: `1px solid ${s === startState ? 'rgba(56,189,248,0.4)' : V('--border-subtle')}`,
                  fontFamily: V('--font-mono'), fontSize: 11, fontWeight: 700,
                  color: acceptStates.includes(s) ? '#fb923c' : s === startState ? '#38bdf8' : V('--text-secondary'),
                }}>
                  {s === startState && <span style={{ fontSize: 8 }}>▶</span>}
                  {acceptStates.includes(s) && <span style={{ fontSize: 8 }}>✱</span>}
                  {s}
                  {states.length > 1 && (
                    <button onClick={() => removeState(s)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: V('--text-muted'), fontSize: 10, padding: '0 1px', lineHeight: 1,
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                      onMouseLeave={e => e.currentTarget.style.color = V('--text-muted')}
                    >×</button>
                  )}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                value={newState}
                onChange={e => setNewState(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addState()}
                placeholder="e.g. q3"
                style={addInputStyle}
              />
              <button onClick={addState} style={addBtnStyle('#38bdf8')}>+ Add</button>
            </div>
          </div>
        )}

        <Divider />

        {/* ── Alphabet ──────────────────────────────────────────────── */}
        <SectionHeader label="Alphabet (Σ)" open={showAlpha} onToggle={() => setShowAlpha(o => !o)} count={alphabet.length} />
        {showAlpha && (
          <div style={{ padding: '2px 14px 8px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {alphabet.map(sym => (
                <span key={sym} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 7px', borderRadius: 5,
                  background: 'rgba(52,211,153,0.08)',
                  border: '1px solid rgba(52,211,153,0.3)',
                  fontFamily: V('--font-mono'), fontSize: 12, fontWeight: 700, color: '#34d399',
                }}>
                  {sym}
                  {alphabet.length > 1 && (
                    <button onClick={() => removeSymbol(sym)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: V('--text-muted'), fontSize: 10, padding: '0 1px', lineHeight: 1,
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                      onMouseLeave={e => e.currentTarget.style.color = V('--text-muted')}
                    >×</button>
                  )}
                </span>
              ))}
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '2px 7px', borderRadius: 5,
                background: 'rgba(167,139,250,0.08)',
                border: '1px solid rgba(167,139,250,0.3)',
                fontFamily: V('--font-mono'), fontSize: 12, fontWeight: 700, color: '#a78bfa',
              }}>ε</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                value={newSymbol}
                onChange={e => setNewSymbol(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSymbol()}
                placeholder="e.g. c"
                maxLength={3}
                style={addInputStyle}
              />
              <button onClick={addSymbol} style={addBtnStyle('#34d399')}>+ Add</button>
            </div>
          </div>
        )}

        <Divider />

        {/* ── Start & Accept ────────────────────────────────────────── */}
        <SectionHeader label="Start & Accept" open={showSA} onToggle={() => setShowSA(o => !o)} />
        {showSA && (
          <div style={{ padding: '2px 14px 8px' }}>
            <div style={{
              background: V('--bg-elevated'),
              border: `1px solid ${V('--border-subtle')}`,
              borderRadius: 7, overflow: 'hidden',
            }}>
              {/* Header row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 44px 44px',
                padding: '5px 10px', borderBottom: `1px solid ${V('--border-subtle')}`,
              }}>
                <span style={tableHeaderStyle}>State</span>
                <span style={{ ...tableHeaderStyle, textAlign: 'center', color: '#38bdf8' }}>▶ Start</span>
                <span style={{ ...tableHeaderStyle, textAlign: 'center', color: '#fb923c' }}>✱ Accept</span>
              </div>
              {states.map((s, i) => (
                <div key={s} style={{
                  display: 'grid', gridTemplateColumns: '1fr 44px 44px',
                  padding: '5px 10px',
                  borderBottom: i < states.length - 1 ? `1px solid ${V('--border-subtle')}` : 'none',
                  background: startState === s ? 'rgba(56,189,248,0.04)' : 'transparent',
                }}>
                  <span style={{
                    fontFamily: V('--font-mono'), fontSize: 12, fontWeight: 700,
                    color: acceptStates.includes(s) ? '#fb923c' : startState === s ? '#38bdf8' : V('--text-secondary'),
                    alignSelf: 'center',
                  }}>{s}</span>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <input type="radio" name="nfa-start" checked={startState === s}
                      onChange={() => onNFAChange({ ...automaton, startState: s })}
                      style={{ accentColor: '#38bdf8', width: 14, height: 14, cursor: 'pointer' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <input type="checkbox" checked={acceptStates.includes(s)}
                      onChange={() => onNFAChange({
                        ...automaton,
                        acceptStates: acceptStates.includes(s)
                          ? acceptStates.filter(x => x !== s)
                          : [...acceptStates, s],
                      })}
                      style={{ accentColor: '#fb923c', width: 14, height: 14, cursor: 'pointer' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Divider />

        {/* ── Transition table ──────────────────────────────────────── */}
        <SectionHeader label="Transitions (δ)" open={showTrans} onToggle={() => setShowTrans(o => !o)} />
        {showTrans && (
          <div style={{ padding: '2px 14px 10px' }}>
            <p style={{ fontSize: 9, fontFamily: V('--font-mono'), color: V('--text-muted'), margin: '0 0 6px' }}>
              Comma-separated state names · canvas updates as you type
            </p>
            <div style={{
              background: V('--bg-elevated'),
              border: `1px solid ${V('--border-subtle')}`,
              borderRadius: 7, overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${V('--border-subtle')}` }}>
                    <th style={{ ...thStyle, width: 32 }}>δ</th>
                    {alphabet.map(sym => (
                      <th key={sym} style={{ ...thStyle, color: '#38bdf8' }}>{sym}</th>
                    ))}
                    <th style={{ ...thStyle, color: '#a78bfa' }}>ε</th>
                  </tr>
                </thead>
                <tbody>
                  {states.map((state, i) => (
                    <tr key={state} style={{
                      borderBottom: i < states.length - 1 ? `1px solid ${V('--border-subtle')}` : 'none',
                    }}>
                      <td style={{ padding: '4px 6px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: acceptStates.includes(state) ? '#fb923c' : startState === state ? '#38bdf8' : 'var(--text-secondary)' }}>
                        {state}
                        {state === startState && <span style={{ color: '#38bdf8', fontSize: 8 }}> ▶</span>}
                        {acceptStates.includes(state) && <span style={{ color: '#fb923c', fontSize: 8 }}> ✱</span>}
                      </td>
                      {alphabet.map(sym => (
                        <td key={sym} style={{ padding: '3px 3px' }}>
                          <TransitionCell
                            key={`${state}-${sym}`}
                            value={(transitions[state]?.[sym] || []).join(',')}
                            onCommit={raw => commitTransition(state, sym, raw)}
                          />
                        </td>
                      ))}
                      <td style={{ padding: '3px 3px' }}>
                        <TransitionCell
                          key={`${state}-eps`}
                          value={(epsilon[state] || []).join(',')}
                          onCommit={raw => commitEpsilon(state, raw)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>{/* end scroll */}

      {/* ── Pipeline buttons ────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, padding: '10px 14px 14px',
        borderTop: `1px solid ${V('--border-subtle')}`,
        display: 'flex', flexDirection: 'column', gap: 6,
        background: V('--bg-surface'),
      }}>
        {!hasDfa && <PipeBtn onClick={onConvert} cls="indigo">NFA → DFA</PipeBtn>}
        {hasDfa && !hasMinDfa && <PipeBtn onClick={onMinimize} cls="amber">Minimize DFA</PipeBtn>}
        {hasMinDfa && (
          <div style={{
            padding: '8px 0', borderRadius: 8, textAlign: 'center',
            background: 'rgba(0,200,112,0.06)', border: '1px solid rgba(0,200,112,0.2)',
            fontSize: 12, fontFamily: V('--font-mono'), fontWeight: 700, color: '#00c870',
          }}>✓ Pipeline complete</div>
        )}
        {hasDfa && (
          <button onClick={onConvert}
            style={{
              background: 'none', border: 'none', padding: '1px 0',
              fontSize: 11, fontFamily: V('--font-mono'), color: V('--text-muted'),
              cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3,
              textAlign: 'center', transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#7dd3fc'}
            onMouseLeave={e => e.currentTarget.style.color = V('--text-muted')}
          >Reconvert NFA → DFA</button>
        )}
      </div>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────
const addInputStyle = {
  flex: 1, minWidth: 0,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 6, padding: '5px 9px',
  fontFamily: 'var(--font-mono)', fontSize: 12,
  color: 'var(--text-primary)', outline: 'none',
};

const addBtnStyle = (color) => ({
  flexShrink: 0,
  padding: '5px 12px', borderRadius: 6,
  background: `${color}22`,
  border: `1px solid ${color}55`,
  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
  color: color, cursor: 'pointer', transition: 'all 0.15s',
  whiteSpace: 'nowrap',
});

const thStyle = {
  padding: '5px 4px', fontFamily: 'var(--font-mono)',
  fontSize: 10, fontWeight: 700, textAlign: 'center',
  color: 'var(--text-muted)',
};

const tableHeaderStyle = {
  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)',
};
