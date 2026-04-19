import { useState, useEffect, useRef, useCallback } from 'react';

const V = (n) => `var(${n})`;

// ── Random string from alphabet ────────────────────────────────────────────
function randomString(alphabet) {
  if (!alphabet?.length) return '';
  const len = 2 + Math.floor(Math.random() * 11); // 2–12 chars
  return Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

export default function StringTester({ dfa, onPathChange }) {
  const [input,  setInput]  = useState('');
  const [path,   setPath]   = useState([]);
  const [step,   setStep]   = useState(-1);
  const [result, setResult] = useState(null);
  const [isAuto, setIsAuto] = useState(false);
  const autoRef  = useRef(null);
  const prevStep = useRef(-1);

  // ── Notify parent on step change ───────────────────────────────────
  useEffect(() => {
    if (step < 0 || path.length === 0) return;
    const current = path[step];
    const visited = path.slice(0, step);
    const isRejectedFinal = step === path.length - 1 && result != null && !result.accepted;
    onPathChange(visited, current, isRejectedFinal);
  }, [step, path, result]);

  // ── Auto-play ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuto) { clearInterval(autoRef.current); return; }
    autoRef.current = setInterval(() => {
      setStep(prev => {
        if (prev >= path.length - 1) { setIsAuto(false); return prev; }
        return prev + 1;
      });
    }, 600);
    return () => clearInterval(autoRef.current);
  }, [isAuto, path.length]);

  // ── Simulation ─────────────────────────────────────────────────────
  const runSimulation = useCallback((overrideInput) => {
    if (!dfa) return;
    const str = overrideInput !== undefined ? overrideInput : input;
    let current = dfa.start;
    const p = [current];
    let accepted = false;
    let reason = '';

    for (const char of str) {
      if (!dfa.alphabet?.includes(char)) {
        reason = `'${char}' ∉ Σ = {${dfa.alphabet?.join(', ')}}`;
        setPath(p); setStep(0);
        setResult({ accepted: false, reason, dead: true });
        onPathChange([], p[0]);
        return;
      }
      const next = dfa.transitions[current]?.[char];
      if (!next) {
        reason = `Dead: no δ(${current},'${char}')`;
        setPath(p); setStep(0);
        setResult({ accepted: false, reason, dead: true });
        onPathChange([], p[0]);
        return;
      }
      current = next;
      p.push(current);
    }

    accepted = dfa.accept.includes(current);
    reason = accepted
      ? `Accepted — final state ${current} ∈ F`
      : `Rejected — ${current} ∉ F`;

    setPath(p); setStep(0);
    setResult({ accepted, reason });
    onPathChange([], p[0]);
    // Auto-start playback immediately — only if there are steps to animate
    if (p.length > 1) setIsAuto(true);
  }, [dfa, input]);

  // ── Random ─────────────────────────────────────────────────────────
  const handleRandom = () => {
    if (!dfa) return;
    const s = randomString(dfa.alphabet);
    setInput(s);
    setResult(null); setPath([]); setStep(-1); setIsAuto(false);
    onPathChange([], null);
    // run immediately
    setTimeout(() => runSimulation(s), 0);
  };

  // ── Controls ───────────────────────────────────────────────────────
  const stepBack = () => setStep(s => Math.max(0, s - 1));
  const stepFwd  = () => setStep(s => Math.min(path.length - 1, s + 1));
  const clear    = () => {
    setInput(''); setPath([]); setStep(-1); setResult(null); setIsAuto(false);
    onPathChange([], null);
  };

  const currentState  = step >= 0 && path[step] != null ? path[step] : null;
  const prevState     = step > 0 ? path[step - 1] : null;
  const activeChar    = step > 0 ? input[step - 1] : null;
  const atEnd         = path.length > 0 && step === path.length - 1;
  const progress      = path.length > 1 ? (step / (path.length - 1)) * 100 : (path.length === 1 ? 100 : 0);

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      padding: '14px 14px 10px', gap: 10, overflowY: 'auto', overflowX: 'hidden',
      fontFamily: V('--font-body'),
    }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0 }}>
        <div style={labelStyle}>String Simulator</div>
        {dfa && (
          <div style={{ fontSize: 9, fontFamily: V('--font-mono'), color: V('--text-muted'), marginTop: 2 }}>
            Σ = {'{'}<span style={{ color: '#38bdf8' }}>{dfa.alphabet?.join(', ')}</span>{'}'}
            {' · '}{dfa.states?.length} states
          </div>
        )}
      </div>

      {/* ── Input row ──────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {/* Text input */}
          <input
            value={input}
            onChange={e => {
              setInput(e.target.value);
              setResult(null); setPath([]); setStep(-1); setIsAuto(false);
              onPathChange([], null);
            }}
            onKeyDown={e => e.key === 'Enter' && runSimulation()}
            placeholder={dfa ? `e.g. ${(dfa.alphabet?.slice(0,3) || []).join('')}` : 'Build a DFA first'}
            disabled={!dfa}
            spellCheck={false}
            style={{
              flex: 1, minWidth: 0,
              background: V('--bg-elevated'),
              border: '1px solid var(--border)',
              borderRadius: 7, padding: '7px 10px',
              fontFamily: V('--font-mono'), fontSize: 13,
              color: V('--text-primary'), outline: 'none',
              opacity: dfa ? 1 : 0.4,
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { if (dfa) e.target.style.borderColor = '#6e56cf'; }}
            onBlur={e  => { e.target.style.borderColor = 'var(--border)'; }}
          />
          {/* Random */}
          <button
            onClick={handleRandom} disabled={!dfa} title="Random string"
            style={{
              flexShrink: 0, width: 34, borderRadius: 7,
              background: dfa ? 'rgba(245,158,11,0.12)' : V('--bg-elevated'),
              border: `1px solid ${dfa ? 'rgba(245,158,11,0.35)' : V('--border-subtle')}`,
              color: dfa ? '#fbbf24' : V('--text-muted'),
              fontSize: 16, cursor: dfa ? 'pointer' : 'not-allowed',
              opacity: dfa ? 1 : 0.4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (dfa) { e.currentTarget.style.background = 'rgba(245,158,11,0.22)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.55)'; } }}
            onMouseLeave={e => { if (dfa) { e.currentTarget.style.background = 'rgba(245,158,11,0.12)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.35)'; } }}
          >⚄</button>
          {/* Run */}
          <button
            onClick={() => runSimulation()} disabled={!dfa}
            style={{
              flexShrink: 0, borderRadius: 7, padding: '7px 12px',
              background: dfa ? 'linear-gradient(135deg,#6e56cf,#b44dff)' : V('--bg-elevated'),
              color: '#fff', border: 'none',
              fontFamily: V('--font-mono'), fontWeight: 700, fontSize: 12,
              cursor: dfa ? 'pointer' : 'not-allowed',
              opacity: dfa ? 1 : 0.4,
              boxShadow: dfa ? '0 2px 10px rgba(110,86,207,0.4)' : 'none',
              letterSpacing: '0.05em', transition: 'all 0.15s',
            }}
          >▶ Run</button>
        </div>
      </div>

      {/* ── Tape ───────────────────────────────────────────────────── */}
      {path.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          <div style={labelStyle}>Input Tape</div>
          <div style={{
            display: 'flex', gap: 3, flexWrap: 'nowrap',
            marginTop: 6, overflowX: 'auto', paddingBottom: 4,
          }}>
            {/* Start marker */}
            <div style={{
              ...tapeCell,
              color: step === 0 ? '#6e56cf' : V('--text-muted'),
              background: step === 0 ? 'rgba(110,86,207,0.18)' : 'transparent',
              border: `1px solid ${step === 0 ? 'rgba(110,86,207,0.5)' : 'var(--border-subtle)'}`,
              boxShadow: step === 0 ? '0 0 8px rgba(110,86,207,0.3)' : 'none',
              fontSize: 11,
            }}>▶</div>

            {input.length === 0 && (
              <div style={{ ...tapeCell, color: V('--text-muted'), fontSize: 11 }}>ε</div>
            )}

            {[...input].map((ch, i) => {
              const isActive = i === step - 1;
              const isDone   = i < step - 1;
              const isFail   = result && !result.accepted && i === step - 1;
              return (
                <div key={i} style={{
                  ...tapeCell,
                  background: isFail
                    ? 'rgba(255,80,80,0.18)'
                    : isActive
                    ? 'rgba(255,184,0,0.2)'
                    : isDone ? 'rgba(110,86,207,0.1)'
                    : V('--bg-elevated'),
                  border: `1px solid ${
                    isFail ? 'rgba(255,80,80,0.7)'
                    : isActive ? 'rgba(255,184,0,0.8)'
                    : isDone ? 'rgba(110,86,207,0.35)'
                    : 'var(--border)'}`,
                  color: isFail ? '#ff8080' : isActive ? '#ffb800' : isDone ? '#9080d0' : V('--text-secondary'),
                  boxShadow: isActive ? '0 0 10px rgba(255,184,0,0.35)' : 'none',
                  transform: isActive ? 'scale(1.12)' : 'scale(1)',
                  transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
                  fontWeight: 700,
                }}>{ch}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Live transition display ─────────────────────────────────── */}
      {path.length > 0 && (
        <div style={{
          flexShrink: 0,
          background: V('--bg-elevated'),
          border: `1px solid ${atEnd && result
            ? (result.accepted ? 'rgba(0,200,112,0.35)' : 'rgba(255,80,80,0.35)')
            : 'var(--border-subtle)'}`,
          borderRadius: 10, padding: '10px 12px',
          transition: 'border-color 0.4s',
          boxShadow: atEnd && result?.accepted
            ? '0 0 16px rgba(0,200,112,0.15)'
            : atEnd && result ? '0 0 16px rgba(255,80,80,0.12)' : 'none',
        }}>
          {/* State bubble row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {/* From state */}
            {prevState != null ? (
              <StateBubble label={prevState} color="#6e56cf" dim />
            ) : (
              <div style={{ width: 46, height: 46 }} />
            )}

            {/* Transition arrow with symbol */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              {activeChar != null ? (
                <span style={{
                  fontFamily: V('--font-mono'), fontSize: 13, fontWeight: 700,
                  color: '#ffb800',
                  background: 'rgba(255,184,0,0.15)',
                  padding: '1px 8px', borderRadius: 4,
                  border: '1px solid rgba(255,184,0,0.35)',
                  boxShadow: '0 0 8px rgba(255,184,0,0.2)',
                }}>{activeChar}</span>
              ) : (
                <span style={{ fontSize: 11, fontFamily: V('--font-mono'), color: V('--text-muted') }}>start</span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <div style={{ width: 20, height: 2, background: 'var(--border)', borderRadius: 1 }} />
                <div style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: `7px solid ${activeChar != null ? '#6e56cf' : 'var(--border)'}` }} />
              </div>
            </div>

            {/* Current state */}
            {currentState != null && (
              <StateBubble
                label={currentState}
                color={
                  atEnd && result?.accepted ? '#00c870'
                  : atEnd && result ? '#ff5555'
                  : '#b44dff'
                }
                glow
                pulse={!atEnd}
              />
            )}
          </div>

          {/* Step counter + accept/reject badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 9, fontFamily: V('--font-mono'), color: V('--text-muted') }}>
              Step <span style={{ color: V('--text-secondary'), fontWeight: 700 }}>{step}</span> / {path.length - 1}
            </span>
            {atEnd && result && (
              <span style={{
                fontSize: 11, fontWeight: 700, fontFamily: V('--font-mono'),
                padding: '2px 10px', borderRadius: 5,
                color: result.accepted ? '#00c870' : '#ff5555',
                background: result.accepted ? 'rgba(0,200,112,0.12)' : 'rgba(255,80,80,0.1)',
                border: `1px solid ${result.accepted ? 'rgba(0,200,112,0.35)' : 'rgba(255,80,80,0.3)'}`,
                boxShadow: result.accepted ? '0 0 10px rgba(0,200,112,0.2)' : '0 0 10px rgba(255,80,80,0.15)',
              }}>
                {result.accepted ? '✓ ACCEPT' : '✗ REJECT'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Progress bar ───────────────────────────────────────────── */}
      {path.length > 0 && (
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ position: 'relative', height: 5, borderRadius: 99, background: V('--bg-overlay'), overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${progress}%`,
              background: atEnd && result
                ? (result.accepted ? 'linear-gradient(90deg,#6e56cf,#00c870)' : 'linear-gradient(90deg,#6e56cf,#ff5555)')
                : 'linear-gradient(90deg,#6e56cf,#b44dff)',
              borderRadius: 99,
              transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: atEnd && result?.accepted ? '0 0 8px rgba(0,200,112,0.5)' : '0 0 6px rgba(110,86,207,0.5)',
            }} />
          </div>

          {/* Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: 5 }}>
            <CtrlBtn onClick={stepBack} disabled={step <= 0} title="Back">
              <span style={{ fontSize: 14 }}>⏮</span>
              <span style={{ fontSize: 8 }}>BACK</span>
            </CtrlBtn>

            <CtrlBtn
              onClick={() => setIsAuto(a => !a)} disabled={atEnd}
              active={isAuto} title={isAuto ? 'Pause' : 'Play'}
              activeStyle={{ background: 'linear-gradient(135deg,rgba(180,77,255,0.25),rgba(110,86,207,0.18))', borderColor: 'rgba(180,77,255,0.65)', color: '#d090ff' }}
            >
              <span style={{ fontSize: 14 }}>{isAuto ? '⏸' : '▶'}</span>
              <span style={{ fontSize: 8 }}>{isAuto ? 'PAUSE' : 'PLAY'}</span>
              {isAuto && (
                <span style={{
                  position: 'absolute', top: 5, right: 5,
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#b44dff', animation: 'pulseReady 1s ease-in-out infinite',
                }} />
              )}
            </CtrlBtn>

            <CtrlBtn onClick={stepFwd} disabled={atEnd} title="Next">
              <span style={{ fontSize: 14 }}>⏭</span>
              <span style={{ fontSize: 8 }}>NEXT</span>
            </CtrlBtn>

            <CtrlBtn onClick={clear} title="Reset"
              style={{ background: 'rgba(255,60,60,0.07)', borderColor: 'rgba(255,80,80,0.3)', color: '#ff8080' }}>
              <span style={{ fontSize: 14 }}>↺</span>
              <span style={{ fontSize: 8 }}>RESET</span>
            </CtrlBtn>
          </div>
        </div>
      )}

      {/* ── Path trace ─────────────────────────────────────────────── */}
      {path.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          <div style={labelStyle}>Path Trace</div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 3,
            alignItems: 'center', marginTop: 6,
          }}>
            {path.map((state, i) => {
              const isVisited = i < step;
              const isCurrent = i === step;
              const isFuture  = i > step;
              const isFinalOk  = i === path.length - 1 && atEnd && result?.accepted;
              const isFinalBad = i === path.length - 1 && atEnd && result && !result.accepted;

              return (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{
                    padding: '2px 7px', borderRadius: 5,
                    fontSize: 10, fontFamily: V('--font-mono'), fontWeight: 700,
                    transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                    background: isFinalOk  ? 'rgba(0,200,112,0.15)'
                      : isFinalBad ? 'rgba(255,80,80,0.12)'
                      : isCurrent  ? 'rgba(180,77,255,0.2)'
                      : isVisited  ? 'rgba(255,184,0,0.1)'
                      : V('--bg-elevated'),
                    color: isFinalOk  ? '#00c870'
                      : isFinalBad ? '#ff5555'
                      : isCurrent  ? '#d090ff'
                      : isVisited  ? '#c4a817'
                      : V('--text-muted'),
                    border: `1px solid ${
                      isFinalOk   ? 'rgba(0,200,112,0.4)'
                      : isFinalBad ? 'rgba(255,80,80,0.35)'
                      : isCurrent  ? 'rgba(180,77,255,0.5)'
                      : isVisited  ? 'rgba(255,184,0,0.28)'
                      : V('--border-subtle')}`,
                    boxShadow: isCurrent  ? '0 0 8px rgba(180,77,255,0.3)'
                      : isFinalOk ? '0 0 8px rgba(0,200,112,0.25)' : 'none',
                    opacity: isFuture ? 0.28 : 1,
                  }}>{state}</span>
                  {i < path.length - 1 && (
                    <span style={{
                      fontFamily: V('--font-mono'), fontSize: 9,
                      color: i < step ? '#ffb800' : V('--border'),
                      opacity: isFuture ? 0.2 : 1,
                      transition: 'color 0.3s ease',
                    }}>
                      {input[i] ? `${input[i]}→` : '→'}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Result reasoning ───────────────────────────────────────── */}
      {result && atEnd && (
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'flex-start', gap: 8,
          padding: '9px 12px', borderRadius: 8,
          fontFamily: V('--font-mono'), fontSize: 11,
          color: result.accepted ? '#00c870' : '#ff7070',
          background: result.accepted ? 'rgba(0,200,112,0.07)' : 'rgba(255,80,80,0.07)',
          border: `1px solid ${result.accepted ? 'rgba(0,200,112,0.28)' : 'rgba(255,80,80,0.25)'}`,
          boxShadow: result.accepted ? '0 0 14px rgba(0,200,112,0.1)' : '0 0 14px rgba(255,80,80,0.08)',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.2 }}>{result.accepted ? '✓' : '✗'}</span>
          <span style={{ lineHeight: 1.5, wordBreak: 'break-word' }}>{result.reason}</span>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────── */}
      {!dfa && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
          color: V('--text-muted'), fontFamily: V('--font-mono'), fontSize: 11,
          opacity: 0.6,
        }}>
          <span style={{ fontSize: 28 }}>⚙</span>
          <span>Build a DFA to enable testing</span>
        </div>
      )}

    </div>
  );
}

// ── State bubble ───────────────────────────────────────────────────────────
function StateBubble({ label, color, glow, pulse, dim }) {
  return (
    <div style={{
      width: 46, height: 46, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
      color: dim ? 'rgba(255,255,255,0.4)' : '#fff',
      background: dim
        ? `${color}22`
        : `radial-gradient(circle at 35% 35%, ${color}cc, ${color}66)`,
      border: `2px solid ${dim ? color + '33' : color}`,
      boxShadow: glow && !dim ? `0 0 16px ${color}66, 0 0 4px ${color}44` : 'none',
      transform: pulse ? 'scale(1.05)' : 'scale(1)',
      transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      flexShrink: 0,
      position: 'relative',
    }}>
      {label}
      {pulse && (
        <div style={{
          position: 'absolute', inset: -4, borderRadius: '50%',
          border: `2px solid ${color}44`,
          animation: 'pulseReady 1.5s ease-in-out infinite',
        }} />
      )}
    </div>
  );
}

// ── Control button ─────────────────────────────────────────────────────────
function CtrlBtn({ children, onClick, disabled, active, activeStyle, style, title }) {
  const base = {
    position: 'relative',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 2, padding: '6px 4px', borderRadius: 8, cursor: 'pointer',
    border: active ? '1px solid rgba(110,86,207,0.6)' : '1px solid var(--border)',
    background: active ? 'rgba(110,86,207,0.2)' : 'var(--bg-elevated)',
    color: disabled ? 'var(--text-muted)' : active ? '#b09af0' : 'var(--text-secondary)',
    opacity: disabled ? 0.3 : 1,
    transition: 'all 0.15s ease',
    fontFamily: 'var(--font-mono)', fontWeight: 700,
    ...(active ? activeStyle || {} : {}),
    ...style,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
  return (
    <button onClick={disabled ? undefined : onClick} title={title} style={base}>
      {children}
    </button>
  );
}

// ── Shared ─────────────────────────────────────────────────────────────────
const labelStyle = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.1em', color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)',
};

const tapeCell = {
  width: 30, height: 30, borderRadius: 6, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'var(--font-mono)', fontSize: 13,
};
