import { useEffect, useRef, useState } from 'react';
import { normalizeNfaAutomaton } from '../utils/automata';
import { NFA_PRESETS } from '../utils/nfaPresets';

const V = (n) => `var(${n})`;

const ALPHA_POOLS = [
  ['a', 'b'],
  ['0', '1'],
  ['a', 'b', 'c'],
  ['x', 'y', 'z'],
  ['p', 'q', 'r'],
  ['0', '1', '2'],
  ['a', 'b', 'c', 'd'],
  ['u', 'v', 'w'],
  ['0', '1', '2', '3'],
  ['a', 'b', 'c', 'd', 'e'],
];

function randomNFA() {
  const numStates = 3 + Math.floor(Math.random() * 6);
  const pool = ALPHA_POOLS[Math.floor(Math.random() * ALPHA_POOLS.length)];
  const alphaSize = 1 + Math.floor(Math.random() * Math.min(3, pool.length));
  const alphabet = pool.slice(0, alphaSize);
  const states = Array.from({ length: numStates }, (_, i) => `q${i}`);
  const start = 'q0';

  const numAccept = 1 + Math.floor(Math.random() * Math.max(1, Math.floor(numStates / 2)));
  const acceptSet = new Set();
  while (acceptSet.size < numAccept) acceptSet.add(Math.floor(Math.random() * numStates));
  const accept = [...acceptSet].map((index) => states[index]);

  const transitions = {};
  const epsilon = {};

  states.forEach((state) => {
    transitions[state] = {};
    alphabet.forEach((symbol) => {
      if (Math.random() < 0.55) {
        const targetCount = Math.random() < 0.25 ? 2 : 1;
        const targets = new Set();
        for (let attempt = 0; attempt < targetCount * 3 && targets.size < targetCount; attempt += 1) {
          targets.add(states[Math.floor(Math.random() * numStates)]);
        }
        transitions[state][symbol] = [...targets];
      } else {
        transitions[state][symbol] = [];
      }
    });

    epsilon[state] = [];
    if (Math.random() < 0.25) {
      const target = states[Math.floor(Math.random() * numStates)];
      if (target !== state) epsilon[state] = [target];
    }
  });

  return { states, alphabet, start, accept, transitions, epsilon };
}

function randomPreset() {
  return NFA_PRESETS[Math.floor(Math.random() * NFA_PRESETS.length)];
}

function SectionHeader({ label, open, onToggle, count }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        padding: '7px 16px 5px',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontFamily: V('--font-mono'),
          color: V('--text-muted'),
        }}
      >
        {label}
        {count != null && (
          <span
            style={{
              marginLeft: 6,
              fontSize: 8,
              background: V('--bg-overlay'),
              color: V('--text-muted'),
              padding: '1px 5px',
              borderRadius: 8,
              border: `1px solid ${V('--border-subtle')}`,
            }}
          >
            {count}
          </span>
        )}
      </span>
      <span
        style={{
          fontSize: 8,
          color: V('--text-muted'),
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.2s',
          display: 'inline-block',
        }}
      >
        ▼
      </span>
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: V('--border-subtle'), margin: '2px 0' }} />;
}

function TransitionCell({ value, onCommit }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!focused && inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [focused, value]);

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={value}
      placeholder="∅"
      onChange={(event) => onCommit(event.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        setFocused(false);
        onCommit(event.target.value);
      }}
      onKeyDown={(event) => event.key === 'Enter' && inputRef.current?.blur()}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        background: V('--bg-overlay'),
        border: `1px solid ${V('--border-subtle')}`,
        borderRadius: 4,
        padding: '3px 4px',
        fontFamily: V('--font-mono'),
        fontSize: 10,
        color: V('--text-secondary'),
        textAlign: 'center',
        outline: 'none',
        transition: 'border-color 0.15s',
      }}
      onFocusCapture={(event) => {
        event.target.style.borderColor = '#38bdf8';
      }}
      onBlurCapture={(event) => {
        event.target.style.borderColor = V('--border-subtle');
      }}
    />
  );
}

function PipeBtn({ children, onClick, cls = 'indigo' }) {
  const palette = {
    indigo: {
      bg: 'rgba(110,86,207,0.18)',
      border: 'rgba(110,86,207,0.45)',
      color: '#a08fef',
      hoverBg: 'rgba(110,86,207,0.28)',
      hoverBorder: 'rgba(110,86,207,0.6)',
      hoverColor: '#c0b0ff',
    },
    amber: {
      bg: 'rgba(255,184,0,0.12)',
      border: 'rgba(255,184,0,0.35)',
      color: '#e0a820',
      hoverBg: 'rgba(255,184,0,0.2)',
      hoverBorder: 'rgba(255,184,0,0.5)',
      hoverColor: '#ffcc40',
    },
  };

  const colors = palette[cls] || palette.indigo;

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '9px 12px',
        borderRadius: 8,
        fontFamily: V('--font-mono'),
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.02em',
        cursor: 'pointer',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.color,
        transition: 'all 0.18s ease',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = colors.hoverBg;
        event.currentTarget.style.borderColor = colors.hoverBorder;
        event.currentTarget.style.color = colors.hoverColor;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = colors.bg;
        event.currentTarget.style.borderColor = colors.border;
        event.currentTarget.style.color = colors.color;
      }}
    >
      {children}
    </button>
  );
}

export default function NFABuilder({
  nfa,
  onNFAChange,
  onConvert,
  onMinimize,
  hasDfa = false,
  hasMinDfa = false,
}) {
  const [newState, setNewState] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState(NFA_PRESETS[0]?.id ?? '');
  const [showStates, setShowStates] = useState(true);
  const [showAlpha, setShowAlpha] = useState(true);
  const [showSA, setShowSA] = useState(true);
  const [showTrans, setShowTrans] = useState(true);

  const automaton = normalizeNfaAutomaton(nfa);
  const { states, alphabet, startState, acceptStates, transitions, epsilon } = automaton;
  const selectedPreset = NFA_PRESETS.find((preset) => preset.id === selectedPresetId) ?? NFA_PRESETS[0];

  const applyAutomaton = (nextAutomaton) => {
    onNFAChange(normalizeNfaAutomaton(nextAutomaton));
  };

  const parseTargets = (raw) => {
    const targets = new Set();
    raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => states.includes(item))
      .forEach((item) => targets.add(item));
    return [...targets];
  };

  const addState = () => {
    const state = newState.trim();
    if (!state || states.includes(state)) return;

    const nextTransitions = { ...transitions, [state]: Object.fromEntries(alphabet.map((symbol) => [symbol, []])) };
    const nextEpsilon = { ...epsilon, [state]: [] };
    applyAutomaton({ ...automaton, states: [...states, state], transitions: nextTransitions, epsilon: nextEpsilon });
    setNewState('');
  };

  const removeState = (toRemove) => {
    if (states.length <= 1) return;

    const nextStates = states.filter((state) => state !== toRemove);
    const nextTransitions = {};
    const nextEpsilon = {};

    nextStates.forEach((state) => {
      nextTransitions[state] = {};
      alphabet.forEach((symbol) => {
        nextTransitions[state][symbol] = (transitions[state]?.[symbol] || []).filter((target) => target !== toRemove);
      });
      nextEpsilon[state] = (epsilon[state] || []).filter((target) => target !== toRemove);
    });

    applyAutomaton({
      ...automaton,
      states: nextStates,
      startState: startState === toRemove ? nextStates[0] : startState,
      acceptStates: acceptStates.filter((state) => state !== toRemove),
      transitions: nextTransitions,
      epsilon: nextEpsilon,
    });
  };

  const addSymbol = () => {
    const symbol = newSymbol.trim();
    if (!symbol || symbol === 'ε' || alphabet.includes(symbol) || symbol.length > 3) return;

    const nextTransitions = {};
    states.forEach((state) => {
      nextTransitions[state] = { ...transitions[state], [symbol]: [] };
    });

    applyAutomaton({ ...automaton, alphabet: [...alphabet, symbol], transitions: nextTransitions });
    setNewSymbol('');
  };

  const removeSymbol = (symbolToRemove) => {
    if (alphabet.length <= 1) return;

    const nextAlphabet = alphabet.filter((symbol) => symbol !== symbolToRemove);
    const nextTransitions = {};

    states.forEach((state) => {
      nextTransitions[state] = {};
      nextAlphabet.forEach((symbol) => {
        nextTransitions[state][symbol] = transitions[state]?.[symbol] || [];
      });
    });

    applyAutomaton({ ...automaton, alphabet: nextAlphabet, transitions: nextTransitions });
  };

  const commitTransition = (state, symbol, raw) => {
    applyAutomaton({
      ...automaton,
      transitions: {
        ...transitions,
        [state]: {
          ...transitions[state],
          [symbol]: parseTargets(raw),
        },
      },
    });
  };

  const commitEpsilon = (state, raw) => {
    applyAutomaton({
      ...automaton,
      epsilon: {
        ...epsilon,
        [state]: parseTargets(raw),
      },
    });
  };

  const loadSelectedPreset = () => {
    if (!selectedPreset) return;
    applyAutomaton(selectedPreset.automaton);
  };

  const loadRandomPreset = () => {
    const preset = randomPreset();
    setSelectedPresetId(preset.id);
    applyAutomaton(preset.automaton);
  };

  const loadRandomFreeform = () => {
    applyAutomaton(randomNFA());
  };

  const hasEps = Object.values(epsilon || {}).some((targets) => targets.length > 0);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: V('--bg-surface'),
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: '12px 16px 10px',
          borderBottom: `1px solid ${V('--border-subtle')}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: V('--font-mono'),
              color: V('--text-secondary'),
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            NFA Builder
          </span>
          <span style={{ fontSize: 10, fontFamily: V('--font-mono'), color: V('--text-muted') }}>Manual</span>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { label: `${states.length} states`, color: '#38bdf8' },
            { label: `Σ={${alphabet.join(',')}}`, color: '#34d399' },
            { label: `start: ${startState}`, color: V('--text-muted') },
            { label: `accept: {${acceptStates.join(',')}}`, color: '#fb923c' },
            hasEps ? { label: 'has ε', color: '#a78bfa' } : null,
          ]
            .filter(Boolean)
            .map((chip, index) => (
              <span
                key={index}
                style={{
                  fontSize: 9,
                  fontFamily: V('--font-mono'),
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: V('--bg-overlay'),
                  border: `1px solid ${V('--border-subtle')}`,
                  color: chip.color,
                }}
              >
                {chip.label}
              </span>
            ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ padding: '4px 14px 8px' }}>
          <div
            style={{
              background: V('--bg-elevated'),
              border: `1px solid ${V('--border-subtle')}`,
              borderRadius: 8,
              padding: 10,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontFamily: V('--font-mono'),
                color: V('--text-muted'),
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}
            >
              10 predefined epsilon-NFAs
            </div>

            <select
              value={selectedPresetId}
              onChange={(event) => setSelectedPresetId(event.target.value)}
              style={{
                width: '100%',
                background: V('--bg-overlay'),
                border: `1px solid ${V('--border')}`,
                borderRadius: 6,
                padding: '7px 8px',
                fontFamily: V('--font-mono'),
                fontSize: 11,
                color: V('--text-primary'),
                outline: 'none',
              }}
            >
              {NFA_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>

            <p
              style={{
                fontSize: 10,
                lineHeight: 1.5,
                fontFamily: V('--font-mono'),
                color: V('--text-secondary'),
                margin: '8px 0 0',
                minHeight: 32,
              }}
            >
              {selectedPreset?.description}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
              <button onClick={loadSelectedPreset} style={actionButtonStyle('#38bdf8')}>
                Load preset
              </button>
              <button onClick={loadRandomPreset} style={actionButtonStyle('#f59e0b')}>
                Random preset
              </button>
            </div>

            <button
              onClick={loadRandomFreeform}
              style={{ ...actionButtonStyle('#a78bfa'), width: '100%', marginTop: 6 }}
            >
              Random freeform NFA
            </button>
          </div>

          <p
            style={{
              fontSize: 9,
              fontFamily: V('--font-mono'),
              color: V('--text-muted'),
              margin: '4px 0 0',
              textAlign: 'center',
            }}
          >
            Meaningful examples like divisible by 5, contains 1001, odd 1s, even 0s, and more
          </p>
        </div>

        <Divider />

        <SectionHeader label="States (Q)" open={showStates} onToggle={() => setShowStates((open) => !open)} count={states.length} />
        {showStates && (
          <div style={{ padding: '2px 14px 8px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {states.map((state) => (
                <span
                  key={state}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '2px 7px',
                    borderRadius: 5,
                    background: state === startState ? 'rgba(56,189,248,0.1)' : V('--bg-elevated'),
                    border: `1px solid ${state === startState ? 'rgba(56,189,248,0.4)' : V('--border-subtle')}`,
                    fontFamily: V('--font-mono'),
                    fontSize: 11,
                    fontWeight: 700,
                    color: acceptStates.includes(state)
                      ? '#fb923c'
                      : state === startState
                        ? '#38bdf8'
                        : V('--text-secondary'),
                  }}
                >
                  {state === startState && <span style={{ fontSize: 8 }}>▶</span>}
                  {acceptStates.includes(state) && <span style={{ fontSize: 8 }}>✱</span>}
                  {state}
                  {states.length > 1 && (
                    <button
                      onClick={() => removeState(state)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: V('--text-muted'),
                        fontSize: 10,
                        padding: '0 1px',
                        lineHeight: 1,
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.color = '#f87171';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.color = V('--text-muted');
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              <input
                value={newState}
                onChange={(event) => setNewState(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && addState()}
                placeholder="e.g. q3"
                style={addInputStyle}
              />
              <button onClick={addState} style={addBtnStyle('#38bdf8')}>
                + Add
              </button>
            </div>
          </div>
        )}

        <Divider />

        <SectionHeader label="Alphabet (Σ)" open={showAlpha} onToggle={() => setShowAlpha((open) => !open)} count={alphabet.length} />
        {showAlpha && (
          <div style={{ padding: '2px 14px 8px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {alphabet.map((symbol) => (
                <span
                  key={symbol}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '2px 7px',
                    borderRadius: 5,
                    background: 'rgba(52,211,153,0.08)',
                    border: '1px solid rgba(52,211,153,0.3)',
                    fontFamily: V('--font-mono'),
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#34d399',
                  }}
                >
                  {symbol}
                  {alphabet.length > 1 && (
                    <button
                      onClick={() => removeSymbol(symbol)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: V('--text-muted'),
                        fontSize: 10,
                        padding: '0 1px',
                        lineHeight: 1,
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.color = '#f87171';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.color = V('--text-muted');
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 7px',
                  borderRadius: 5,
                  background: 'rgba(167,139,250,0.08)',
                  border: '1px solid rgba(167,139,250,0.3)',
                  fontFamily: V('--font-mono'),
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#a78bfa',
                }}
              >
                ε
              </span>
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              <input
                value={newSymbol}
                onChange={(event) => setNewSymbol(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && addSymbol()}
                placeholder="e.g. c"
                maxLength={3}
                style={addInputStyle}
              />
              <button onClick={addSymbol} style={addBtnStyle('#34d399')}>
                + Add
              </button>
            </div>
          </div>
        )}

        <Divider />

        <SectionHeader label="Start & Accept" open={showSA} onToggle={() => setShowSA((open) => !open)} />
        {showSA && (
          <div style={{ padding: '2px 14px 8px' }}>
            <div
              style={{
                background: V('--bg-elevated'),
                border: `1px solid ${V('--border-subtle')}`,
                borderRadius: 7,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 44px 44px',
                  padding: '5px 10px',
                  borderBottom: `1px solid ${V('--border-subtle')}`,
                }}
              >
                <span style={tableHeaderStyle}>State</span>
                <span style={{ ...tableHeaderStyle, textAlign: 'center', color: '#38bdf8' }}>▶ Start</span>
                <span style={{ ...tableHeaderStyle, textAlign: 'center', color: '#fb923c' }}>✱ Accept</span>
              </div>

              {states.map((state, index) => (
                <div
                  key={state}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 44px 44px',
                    padding: '5px 10px',
                    borderBottom: index < states.length - 1 ? `1px solid ${V('--border-subtle')}` : 'none',
                    background: startState === state ? 'rgba(56,189,248,0.04)' : 'transparent',
                  }}
                >
                  <span
                    style={{
                      fontFamily: V('--font-mono'),
                      fontSize: 12,
                      fontWeight: 700,
                      color: acceptStates.includes(state)
                        ? '#fb923c'
                        : state === startState
                          ? '#38bdf8'
                          : V('--text-secondary'),
                      alignSelf: 'center',
                    }}
                  >
                    {state}
                  </span>

                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <input
                      type="radio"
                      name="nfa-start"
                      checked={startState === state}
                      onChange={() => applyAutomaton({ ...automaton, startState: state })}
                      style={{ accentColor: '#38bdf8', width: 14, height: 14, cursor: 'pointer' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={acceptStates.includes(state)}
                      onChange={() =>
                        applyAutomaton({
                          ...automaton,
                          acceptStates: acceptStates.includes(state)
                            ? acceptStates.filter((item) => item !== state)
                            : [...acceptStates, state],
                        })
                      }
                      style={{ accentColor: '#fb923c', width: 14, height: 14, cursor: 'pointer' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Divider />

        <SectionHeader label="Transitions (δ)" open={showTrans} onToggle={() => setShowTrans((open) => !open)} />
        {showTrans && (
          <div style={{ padding: '2px 14px 10px' }}>
            <p style={{ fontSize: 9, fontFamily: V('--font-mono'), color: V('--text-muted'), margin: '0 0 6px' }}>
              Comma-separated state names. The canvas updates as you type valid targets.
            </p>
            <div
              style={{
                background: V('--bg-elevated'),
                border: `1px solid ${V('--border-subtle')}`,
                borderRadius: 7,
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${V('--border-subtle')}` }}>
                    <th style={{ ...thStyle, width: 32 }}>δ</th>
                    {alphabet.map((symbol) => (
                      <th key={symbol} style={{ ...thStyle, color: '#38bdf8' }}>
                        {symbol}
                      </th>
                    ))}
                    <th style={{ ...thStyle, color: '#a78bfa' }}>ε</th>
                  </tr>
                </thead>
                <tbody>
                  {states.map((state, index) => (
                    <tr
                      key={state}
                      style={{
                        borderBottom: index < states.length - 1 ? `1px solid ${V('--border-subtle')}` : 'none',
                      }}
                    >
                      <td
                        style={{
                          padding: '4px 6px',
                          fontFamily: V('--font-mono'),
                          fontSize: 10,
                          fontWeight: 700,
                          color: acceptStates.includes(state)
                            ? '#fb923c'
                            : state === startState
                              ? '#38bdf8'
                              : V('--text-secondary'),
                        }}
                      >
                        {state}
                        {state === startState && <span style={{ color: '#38bdf8', fontSize: 8 }}> ▶</span>}
                        {acceptStates.includes(state) && <span style={{ color: '#fb923c', fontSize: 8 }}> ✱</span>}
                      </td>

                      {alphabet.map((symbol) => (
                        <td key={symbol} style={{ padding: '3px 3px' }}>
                          <TransitionCell
                            value={(transitions[state]?.[symbol] || []).join(',')}
                            onCommit={(raw) => commitTransition(state, symbol, raw)}
                          />
                        </td>
                      ))}

                      <td style={{ padding: '3px 3px' }}>
                        <TransitionCell
                          value={(epsilon[state] || []).join(',')}
                          onCommit={(raw) => commitEpsilon(state, raw)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: '10px 14px 14px',
          borderTop: `1px solid ${V('--border-subtle')}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          background: V('--bg-surface'),
        }}
      >
        {!hasDfa && <PipeBtn onClick={onConvert} cls="indigo">NFA → DFA</PipeBtn>}
        {hasDfa && !hasMinDfa && <PipeBtn onClick={onMinimize} cls="amber">Minimize DFA</PipeBtn>}

        {hasMinDfa && (
          <div
            style={{
              padding: '8px 0',
              borderRadius: 8,
              textAlign: 'center',
              background: 'rgba(0,200,112,0.06)',
              border: '1px solid rgba(0,200,112,0.2)',
              fontSize: 12,
              fontFamily: V('--font-mono'),
              fontWeight: 700,
              color: '#00c870',
            }}
          >
            ✓ Pipeline complete
          </div>
        )}

        {hasDfa && (
          <button
            onClick={onConvert}
            style={{
              background: 'none',
              border: 'none',
              padding: '1px 0',
              fontSize: 11,
              fontFamily: V('--font-mono'),
              color: V('--text-muted'),
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              textAlign: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.color = '#7dd3fc';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.color = V('--text-muted');
            }}
          >
            Reconvert NFA → DFA
          </button>
        )}
      </div>
    </div>
  );
}

const addInputStyle = {
  flex: 1,
  minWidth: 0,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '5px 9px',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--text-primary)',
  outline: 'none',
};

const addBtnStyle = (color) => ({
  flexShrink: 0,
  padding: '5px 12px',
  borderRadius: 6,
  background: `${color}22`,
  border: `1px solid ${color}55`,
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 700,
  color,
  cursor: 'pointer',
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
});

const actionButtonStyle = (color) => ({
  borderRadius: 6,
  padding: '7px 8px',
  background: `${color}18`,
  border: `1px solid ${color}55`,
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 700,
  color,
  cursor: 'pointer',
  transition: 'all 0.15s',
});

const thStyle = {
  padding: '5px 4px',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 700,
  textAlign: 'center',
  color: 'var(--text-muted)',
};

const tableHeaderStyle = {
  fontSize: 9,
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
};
