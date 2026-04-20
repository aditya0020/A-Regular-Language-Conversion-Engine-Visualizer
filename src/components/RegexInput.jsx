import { useState, useRef, useCallback } from 'react';
import { validateRegex } from '../utils/regexToENFA';

// ── Data ──────────────────────────────────────────────────────────────────

const RANDOM_POOL = [
  '(a|b)*', 'a*b*', '(a|b)*abb', 'a+b+', '(ab)*', '(a|b)+',
  'a?b+c?', '(0|1)*101(0|1)*', '(aa|bb)*', '(a|b)*ba(a|b)*',
  '(ab|ba)*', 'a*(ba*b)*a*', '(0|1)*0(0|1)', '((a|b)(a|b))*',
  '(a|b)*a(a|b)', '(a|b|c)*b(a|b|c)*', 'a+b*a+', '(ab)*b',
];

// Operator palette — each inserts text at cursor
const OPS = [
  { label: '|',   title: 'Union  a|b',          ins: '|',   jump: 1  },
  { label: '*',   title: 'Kleene star  a*',      ins: '*',   jump: 1  },
  { label: '+',   title: 'Plus (1+)  a+',        ins: '+',   jump: 1  },
  { label: '?',   title: 'Optional  a?',         ins: '?',   jump: 1  },
  { label: '( )', title: 'Group  (…)',            ins: '()',  jump: 1  },
  { label: 'a*',  title: 'Wrap selection in a*', ins: null,  wrap: '*' },
];

const HISTORY_KEY = 'automata_regex_history';
const MAX_HIST    = 8;

function getHistory()    { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } }
function pushHistory(r)  {
  try {
    const h = [r, ...getHistory().filter(x => x !== r)].slice(0, MAX_HIST);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch {
    // Ignore storage errors and keep the current session usable.
  }
}

function clearHistoryLS() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // Ignore storage errors and keep the current session usable.
  }
}

// ── Tiny helpers ──────────────────────────────────────────────────────────
const V = (name) => `var(${name})`;   // CSS variable shorthand

function Divider() {
  return <div style={{ height: 1, background: V('--border-subtle'), margin: '2px 0' }} />;
}

function SectionHeader({ label, open, onToggle, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px 4px', cursor: 'pointer' }} onClick={onToggle}>
      <span style={{
        flex: 1, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', fontFamily: V('--font-mono'), color: V('--text-muted'),
      }}>
        {label}
      </span>
      {action}
      <span style={{
        fontSize: 8, color: V('--text-muted'), marginLeft: 6,
        transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 0.2s',
        display: 'inline-block',
      }}>▼</span>
    </div>
  );
}

// Coloured step button using existing CSS classes
function PipeBtn({ children, onClick, disabled, cls = 'purple' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`pipeline-action-btn ${cls}`}
      style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function RegexInput({
  onBuild,
  built        = false,
  hasNfaClean  = false,
  hasDfa       = false,
  hasMinDfa    = false,
  onRemoveEpsilon,
  onConvert,
  onMinimize,
  activeStage   = 'enfa',
  onStageChange,
}) {
  const [regex,        setRegex]        = useState('');
  const [error,        setError]        = useState(null);
  const [dirty,        setDirty]        = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [history,      setHistory]      = useState(getHistory);
  const [showHistory,  setShowHistory]  = useState(false);
  const [showRef,      setShowRef]      = useState(false);
  const inputRef = useRef(null);

  // ── Core actions ────────────────────────────────────────────────────────
  const handleBuild = () => {
    const value = regex.trim();
    const err = validateRegex(value);
    if (err) { setError(err); return; }
    setError(null);
    setDirty(false);
    try {
      onBuild(value);
      pushHistory(value);
      setHistory(getHistory());
    } catch (e) { setError(e.message); }
  };

  const load = (r) => {
    setRegex(r); setError(null); setDirty(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const loadRandom = (e) => {
    e.stopPropagation();
    const pool = RANDOM_POOL.filter(r => r !== regex);
    load(pool[Math.floor(Math.random() * pool.length)]);
  };

  const copyRegex = () => {
    if (!regex) return;
    if (!navigator.clipboard?.writeText) {
      setError('Clipboard is not available in this browser');
      return;
    }
    navigator.clipboard.writeText(regex).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      setError('Could not copy the regex to the clipboard');
    });
  };

  const clearInput = () => { setRegex(''); setError(null); inputRef.current?.focus(); };

  // Insert operator at caret (or wrap selection)
  const insertOp = useCallback(({ ins, jump, wrap }) => {
    const el = inputRef.current;
    if (!el) return;
    const s = el.selectionStart ?? regex.length;
    const e = el.selectionEnd   ?? regex.length;
    let next, cursor;

    if (wrap) {
      // Wrap selected text: sel + suffix
      const sel  = regex.slice(s, e) || 'a';
      next   = regex.slice(0, s) + sel + wrap + regex.slice(e);
      cursor = s + sel.length + wrap.length;
    } else {
      next   = regex.slice(0, s) + ins + regex.slice(e);
      cursor = s + jump;
    }

    setRegex(next);
    setError(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }, [regex]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const alphabet = regex
    ? [...new Set(regex.split('').filter(c => !'()|*+?\\·ε '.includes(c)))].sort()
    : [];

  // Pipeline progress: 0-4
  const step = !built ? 0 : !hasNfaClean ? 1 : !hasDfa ? 2 : !hasMinDfa ? 3 : 4;
  const STEPS = [
    { label: 'ε-NFA', color: '#b44dff' },
    { label: 'NFA',   color: '#6e56cf' },
    { label: 'DFA',   color: '#00c870' },
    { label: 'Min',   color: '#ffb800' },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', width: '100%',
      background: V('--bg-surface'),
      overflow: 'hidden',
    }}>

      {/* ── Header: title + pipeline progress ──────────────────────── */}
      <div style={{
        flexShrink: 0, padding: '12px 16px 10px',
        borderBottom: `1px solid ${V('--border-subtle')}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, fontFamily: V('--font-mono'),
            color: V('--text-secondary'), textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Regex Input</span>
          <span style={{ fontSize: 10, fontFamily: V('--font-mono'), color: V('--text-muted') }}>
            Thompson's
          </span>
        </div>

        {/* 4-step progress track */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {STEPS.map((s, i) => {
            const done    = i < step;
            const current = i === step - 1;
            return (
              <div key={s.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{
                  height: 3, borderRadius: 2,
                  background: done ? s.color : current ? s.color + '55' : V('--bg-overlay'),
                  boxShadow: done ? `0 0 6px ${s.color}66` : 'none',
                  transition: 'background 0.4s, box-shadow 0.4s',
                }} />
                <span style={{
                  fontSize: 8, fontFamily: V('--font-mono'), textAlign: 'center',
                  color: done || current ? s.color : V('--border'),
                  transition: 'color 0.4s',
                }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

        {/* ── Regex input field ──────────────────────────────────────── */}
        <div style={{ padding: '12px 16px 0' }}>

          {/* Input row */}
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              value={regex}
              onChange={e => { setRegex(e.target.value); setError(null); setDirty(true); }}
              onKeyDown={e => e.key === 'Enter' && handleBuild()}
              placeholder="e.g. (a|b)*ab"
              spellCheck={false}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: V('--bg-elevated'),
                border: `1px solid ${error ? '#7f1d1d' : V('--border')}`,
                borderRadius: 8,
                padding: '9px 58px 9px 11px',
                fontFamily: V('--font-mono'), fontSize: 13,
                color: V('--text-primary'),
                outline: 'none', transition: 'border-color 0.15s',
              }}
              onFocus={e => { if (!error) e.target.style.borderColor = '#6e56cf'; }}
              onBlur={e  => { if (!error) e.target.style.borderColor = V('--border'); }}
            />
            {/* Clear + Copy icons */}
            <div style={{
              position: 'absolute', right: 6, top: '50%',
              transform: 'translateY(-50%)', display: 'flex', gap: 3,
            }}>
              {regex && (
                <button onClick={clearInput} title="Clear"
                  style={iconBtnStyle}>✕</button>
              )}
              <button onClick={copyRegex} title={copied ? 'Copied!' : 'Copy regex'} disabled={!regex}
                style={{ ...iconBtnStyle, color: copied ? '#00c870' : V('--text-muted'), background: copied ? 'rgba(0,255,136,0.1)' : V('--bg-overlay') }}>
                {copied ? '✓' : '⎘'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p style={{ margin: '5px 0 0', fontSize: 11, fontFamily: V('--font-mono'), color: '#f87171', display: 'flex', gap: 5, alignItems: 'flex-start' }}>
              <span>⚠</span><span>{error}</span>
            </p>
          )}

          {/* Alphabet + length */}
          {regex && !error && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: 10, fontFamily: V('--font-mono'), color: V('--text-muted') }}>
                Σ = {'{' + (alphabet.length ? alphabet.join(', ') : '∅') + '}'}
              </span>
              <span style={{ fontSize: 10, fontFamily: V('--font-mono'), color: V('--border') }}>
                {regex.length} ch
              </span>
            </div>
          )}
        </div>

        {/* ── Operator palette ──────────────────────────────────────── */}
        <div style={{ padding: '10px 16px 4px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: V('--font-mono'), color: V('--text-muted'), marginBottom: 5 }}>
            Operators
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {OPS.map((op) => (
              <button key={op.label} onClick={() => insertOp(op)} title={op.title}
                style={opChipStyle}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6e56cf'; e.currentTarget.style.background = 'rgba(110,86,207,0.15)'; e.currentTarget.style.color = '#c4b5fd'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = V('--border'); e.currentTarget.style.background = V('--bg-elevated'); e.currentTarget.style.color = '#818cf8'; }}
              >{op.label}</button>
            ))}
            {/* Random */}
            <button onClick={loadRandom} title="Load random regex"
              style={{
                ...opChipStyle,
                color: V('--text-muted'),
                flexGrow: 1,
                textAlign: 'center',
                padding: '6px 12px',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.color = '#fbbf24'; e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = V('--border'); e.currentTarget.style.color = V('--text-muted'); e.currentTarget.style.background = V('--bg-elevated'); }}
            ><span style={{ fontSize: 16 }}>⚄</span> Random</button>
          </div>
        </div>

        <Divider />

        {/* ── History ──────────────────────────────────────────────── */}
        <SectionHeader
          label={`Recent${history.length ? ` (${history.length})` : ''}`}
          open={showHistory}
          onToggle={() => setShowHistory(o => !o)}
          action={history.length > 0 && (
            <button
              onClick={e => { e.stopPropagation(); clearHistoryLS(); setHistory([]); }}
              title="Clear history"
              style={{ fontSize: 9, fontFamily: V('--font-mono'), color: V('--border'), background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = V('--border')}
            >clear</button>
          )}
        />
        {showHistory && (
          <div style={{ padding: '2px 16px 8px' }}>
            {history.length === 0 ? (
              <span style={{ fontSize: 11, fontFamily: V('--font-mono'), color: V('--border') }}>No history yet</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {history.map((r, i) => (
                  <button key={i} onClick={() => load(r)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 8px', borderRadius: 5, cursor: 'pointer', textAlign: 'left',
                      background: 'transparent', border: '1px solid transparent', transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = V('--bg-elevated'); e.currentTarget.style.borderColor = V('--border-subtle'); }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                  >
                    <span style={{ fontSize: 9, color: V('--border'), fontFamily: V('--font-mono'), minWidth: 10 }}>{i + 1}</span>
                    <code style={{ fontSize: 12, fontFamily: V('--font-mono'), color: V('--text-secondary'), flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r}</code>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Divider />

        {/* ── Reference ────────────────────────────────────────────── */}
        <SectionHeader label="Reference" open={showRef} onToggle={() => setShowRef(o => !o)} />
        {showRef && (
          <div style={{ padding: '2px 16px 10px' }}>
            <div style={{
              background: V('--bg-elevated'), borderRadius: 6,
              border: `1px solid ${V('--border-subtle')}`, overflow: 'hidden',
            }}>
              {[
                ['a',      'Literal symbol'],
                ['ab',     'Concatenation'],
                ['a|b',    'Union (OR)'],
                ['a*',     'Kleene star (0+)'],
                ['a+',     'Plus (1+)'],
                ['a?',     'Optional (0 or 1)'],
                ['(a|b)',  'Grouping'],
              ].map(([op, desc], i, arr) => (
                <div key={op} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 10px',
                  borderBottom: i < arr.length - 1 ? `1px solid ${V('--border-subtle')}` : 'none',
                }}>
                  <code style={{ fontSize: 11, fontFamily: V('--font-mono'), fontWeight: 700, color: '#818cf8', width: 46, flexShrink: 0 }}>{op}</code>
                  <span style={{ fontSize: 10, color: V('--text-muted'), fontFamily: V('--font-body') }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Divider />

        {/* ── Stage navigator (Prev / Next) ──────────────────── */}
        {(() => {
          // Build ordered list of stages that are available
          const ORDER = [
            { id: 'enfa',   label: 'ε-NFA',   avail: built },
            { id: 'nfa',    label: 'NFA',     avail: hasNfaClean },
            { id: 'dfa',    label: 'DFA',     avail: hasDfa },
            { id: 'minDfa', label: 'Min-DFA', avail: hasMinDfa },
          ];
          const available = ORDER.filter(s => s.avail);
          const idx       = available.findIndex(s => s.id === activeStage);
          const hasPrev   = idx > 0;
          const hasNext   = idx < available.length - 1 && idx !== -1;
          if (available.length < 2) return null;    // nothing to navigate yet

          return (
            <div style={{ padding: '8px 16px 6px' }}>
              <div style={{
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)', marginBottom: 6,
              }}>Canvas View</div>

              {/* Stage chips row */}
              <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
                {available.map(s => {
                  const isActive = s.id === activeStage;
                  const colors   = { 'enfa': '#b44dff', 'nfa': '#6e56cf', 'dfa': '#00c870', 'minDfa': '#ffb800' };
                  const c = colors[s.id];
                  return (
                    <button key={s.id} onClick={() => onStageChange?.(s.id)}
                      title={`View ${s.label}`}
                      style={{
                        flex: 1, padding: '4px 2px', borderRadius: 5,
                        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.15s',
                        background: isActive ? `${c}22` : 'var(--bg-elevated)',
                        border: `1px solid ${isActive ? c : 'var(--border-subtle)'}`,
                        color: isActive ? c : 'var(--text-muted)',
                        boxShadow: isActive ? `0 0 8px ${c}33` : 'none',
                        textAlign: 'center',
                      }}
                    >{s.label}</button>
                  );
                })}
              </div>

              {/* Prev / Next arrows */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  disabled={!hasPrev}
                  onClick={() => hasPrev && onStageChange?.(available[idx - 1].id)}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6,
                    background: hasPrev ? 'var(--bg-elevated)' : 'transparent',
                    border: `1px solid ${hasPrev ? 'var(--border)' : 'var(--border-subtle)'}`,
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                    color: hasPrev ? 'var(--text-secondary)' : 'var(--border)',
                    cursor: hasPrev ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (hasPrev) { e.currentTarget.style.borderColor = '#6e56cf'; e.currentTarget.style.color = 'var(--text-primary)'; }}}
                  onMouseLeave={e => { if (hasPrev) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}}
                >
                  ‹ {hasPrev ? available[idx - 1].label : 'Prev'}
                </button>
                <button
                  disabled={!hasNext}
                  onClick={() => hasNext && onStageChange?.(available[idx + 1].id)}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6,
                    background: hasNext ? 'var(--bg-elevated)' : 'transparent',
                    border: `1px solid ${hasNext ? 'var(--border)' : 'var(--border-subtle)'}`,
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                    color: hasNext ? 'var(--text-secondary)' : 'var(--border)',
                    cursor: hasNext ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (hasNext) { e.currentTarget.style.borderColor = '#6e56cf'; e.currentTarget.style.color = 'var(--text-primary)'; }}}
                  onMouseLeave={e => { if (hasNext) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}}
                >
                  {hasNext ? available[idx + 1].label : 'Next'} ›
                </button>
              </div>
            </div>
          );
        })()}

      </div>{/* end scroll body */}

      {/* ── Pipeline button slot (fixed at bottom) ──────────────────── */}
      <div style={{
        flexShrink: 0,
        padding: '10px 14px 14px',
        borderTop: `1px solid ${V('--border-subtle')}`,
        display: 'flex', flexDirection: 'column', gap: 6,
        background: V('--bg-surface'),
      }}>

        {/* Show Build button when: not yet built, OR regex changed since last build */}
        {(!built || dirty) && (
          <PipeBtn onClick={handleBuild} disabled={!regex.trim()} cls="purple">
            Build ε-NFA
          </PipeBtn>
        )}

        {/* Step 2 — ε → NFA */}
        {built && !dirty && !hasNfaClean && (
          <PipeBtn onClick={onRemoveEpsilon} cls="purple">
            ε → NFA  (remove ε-transitions)
          </PipeBtn>
        )}

        {/* Step 3 — NFA → DFA */}
        {built && !dirty && hasNfaClean && !hasDfa && (
          <PipeBtn onClick={onConvert} cls="indigo">
            NFA → DFA
          </PipeBtn>
        )}

        {/* Step 4 — Minimize */}
        {built && !dirty && hasDfa && !hasMinDfa && (
          <PipeBtn onClick={onMinimize} cls="amber">
            Minimize DFA
          </PipeBtn>
        )}

        {/* All done */}
        {built && !dirty && hasMinDfa && (
          <div style={{
            padding: '8px 0', borderRadius: 8, textAlign: 'center',
            background: 'rgba(0,255,136,0.06)',
            border: '1px solid rgba(0,255,136,0.2)',
            fontSize: 12, fontFamily: V('--font-mono'),
            fontWeight: 700, color: '#00c870',
          }}>
            ✓ Pipeline complete
          </div>
        )}

      </div>
    </div>
  );
}

// ── Shared micro-styles ───────────────────────────────────────────────────
const iconBtnStyle = {
  width: 22, height: 22, borderRadius: 4,
  background: 'var(--bg-overlay)', border: 'none',
  color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s',
  flexShrink: 0,
};

const opChipStyle = {
  padding: '3px 9px', borderRadius: 5,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
  color: '#818cf8', cursor: 'pointer', transition: 'all 0.14s',
};
