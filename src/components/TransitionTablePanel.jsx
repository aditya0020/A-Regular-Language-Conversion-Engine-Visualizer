import FloatingPanel from './FloatingPanel';
import { normalizeDfaAutomaton, normalizeNfaAutomaton } from '../utils/automata';

/**
 * TransitionTablePanel
 * Shows the δ transition table for any automaton stage as a draggable floating panel.
 *
 * type: 'enfa' | 'nfa' | 'dfa' | 'minDfa'
 * automaton: the raw automaton object
 */
export default function TransitionTablePanel({ automaton, type, label, onClose, defaultPosition }) {
  if (!automaton) return null;

  const isNFA      = type === 'enfa' || type === 'nfa';
  const normalized = isNFA ? normalizeNfaAutomaton(automaton) : normalizeDfaAutomaton(automaton);
  const {
    states = [],
    alphabet = [],
    transitions = {},
    epsilon = {},
    startState,
    acceptStates = [],
  } = normalized;
  const showEps    = type === 'enfa';
  const cols       = showEps ? [...alphabet, 'ε'] : [...alphabet];

  const getCell = (state, sym) => {
    if (sym === 'ε') {
      const eps = epsilon?.[state] || [];
      return eps.length === 0 ? '∅' : `{${eps.join(', ')}}`;
    }
    const val = transitions[state]?.[sym];
    if (isNFA) {
      if (!val || (Array.isArray(val) && val.length === 0)) return '∅';
      return Array.isArray(val) ? `{${val.join(', ')}}` : val;
    }
    // DFA: single state string
    return val ? `{${val}}` : '∅';
  };

  const stateLabel = (s) => {
    if (isNFA) return s;          // NFA state names as-is
    if (s === '∅') return '∅';   // dead state
    return `{${s}}`;             // DFA state names wrapped in {}
  };

  const typeColors = {
    enfa:   { header: '#b44dff', dot: 'rgba(180,77,255,0.8)' },
    nfa:    { header: '#6e56cf', dot: 'rgba(110,86,207,0.8)' },
    dfa:    { header: '#00c870', dot: 'rgba(0,200,112,0.8)'  },
    minDfa: { header: '#ffb800', dot: 'rgba(255,184,0,0.8)'  },
  };
  const c = typeColors[type] || typeColors.dfa;

  return (
    <FloatingPanel
      title={`${label} — Transition Table`}
      icon="⊞"
      onClose={onClose}
      defaultPosition={defaultPosition || { x: 200, y: 80 }}
      width={460}
      height={400}
    >
      <div style={{ overflow: 'auto', height: '100%', padding: '10px 14px' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          fontFamily: 'var(--font-mono)', fontSize: 11,
        }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left', color: 'var(--text-muted)', width: 80 }}>
                δ
              </th>
              {cols.map(sym => (
                <th key={sym} style={{
                  ...th,
                  color: sym === 'ε' ? '#b44dff' : c.header,
                }}>
                  {sym}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {states.map((state) => {
              const isStart  = state === startState;
              const isAccept = acceptStates.includes(state);
              const isDead   = state === '∅';
              return (
                <tr key={state} style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: isDead ? 'rgba(0,0,0,0.2)' : 'transparent',
                  transition: 'background 0.1s',
                }}>
                  {/* State label cell */}
                  <td style={{
                    ...td, textAlign: 'left',
                    fontWeight: 700,
                    color: isDead ? 'var(--text-muted)' : 'var(--text-secondary)',
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      {isStart && (
                        <span style={{ color: '#6e56cf', fontSize: 10 }}>→</span>
                      )}
                      {isAccept && (
                        <span style={{ color: '#00c870', fontSize: 10 }}>*</span>
                      )}
                      <span style={{
                        color: isAccept ? '#00e080' : isStart ? '#9080d0' : 'var(--text-secondary)',
                      }}>
                        {stateLabel(state)}
                      </span>
                    </span>
                  </td>
                  {/* Transition cells */}
                  {cols.map(sym => {
                    const val = getCell(state, sym);
                    const isEmpty = val === '∅';
                    return (
                      <td key={sym} style={{
                        ...td,
                        color: isEmpty ? 'var(--text-muted)' : c.header,
                        fontWeight: isEmpty ? 400 : 600,
                      }}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Legend */}
        <div style={{
          marginTop: 12, display: 'flex', gap: 16,
          fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
        }}>
          <span><span style={{ color: '#6e56cf' }}>→</span> start state</span>
          <span><span style={{ color: '#00c870' }}>*</span> accept state</span>
          {showEps && <span><span style={{ color: '#b44dff' }}>ε</span> epsilon transitions</span>}
          <span style={{ marginLeft: 'auto', color: 'var(--bg-hover)' }}>
            {states.length} states · {alphabet.length} symbols
          </span>
        </div>
      </div>
    </FloatingPanel>
  );
}

const th = {
  padding: '7px 10px', textAlign: 'center',
  borderBottom: '1px solid var(--border)',
  fontWeight: 700, letterSpacing: '0.04em',
  background: 'rgba(13,17,23,0.5)',
  position: 'sticky', top: 0, zIndex: 1,
};
const td = {
  padding: '5px 10px', textAlign: 'center',
  fontSize: 11,
};
