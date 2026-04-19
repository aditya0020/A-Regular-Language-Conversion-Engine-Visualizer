import { normalizeNfaAutomaton } from './automata';

/**
 * Stage 1 — Optimized Thompson's Construction  (Regex → ε-NFA)
 *
 * "Zero-Bloat" rules:
 *
 *   atom(a)
 *     → 2 states, 0 ε
 *
 *   concat(A · B)  [OPTIMIZED — THE BLOAT KILLER]
 *     → |A|+|B|−1 states, 0 ε
 *     Merge accept(A) with start(B): absorb start(B)'s outgoing edges into accept(A),
 *     then discard start(B). No ε-link ever created for concatenation.
 *     Safety: Thompson's invariant guarantees start(B) has zero incoming edges inside B.
 *
 *   union(A | B)  [PEEPHOLE CHEAT CODE for simple machines]
 *     If both A and B are "simple" (2 states, ε-free, all transitions start→accept):
 *       → 2 states shared!  Fold B's start-transitions onto A.start, pointing at A.accept.
 *       Gives ONE start, ONE accept, both literal arcs — no ε needed at all.
 *     Example: a|b  → {s0→a→s1, s0→b→s1}  (2 states vs 6 standard Thompson)
 *     Complex union falls back to standard Thompson (2 new states, 4 ε).
 *
 *   star/plus/optional — standard Thompson (2 new states + ε)
 *
 * State counts for (a|b)*ab (★ = peephole fires):
 *   a         → 2 states
 *   b         → 2 states
 *   a|b  ★    → 2 states  (peephole collapses 6→2)
 *   (a|b)*    → 4 states  (star wraps the 2-state union)
 *   (a|b)*a   → 5 states  (concat merge removes 1)
 *   (a|b)*ab  → 6 states  (concat merge removes 1)
 *
 * After Stage 2 (compressNFA: ε-elim → garbage-collect → bisimulation):
 *   → 3-state NFA  →  3-state DFA  →  3-state Min-DFA  ✓
 */

// ── Global state counter ─────────────────────────────────────────────────────
let _id = 0;
const newState = ()  => `t${_id++}`;
const resetId  = ()  => { _id = 0; };

// ── Helper: add ε-transition (deduplicated) ──────────────────────────────────
function addEps(epsilon, from, to) {
  if (!epsilon[from]) epsilon[from] = [];
  if (!epsilon[from].includes(to)) epsilon[from].push(to);
}

// ══════════════════════════════════════════════════════════════════════════════
// Primitive: "Simple Machine" detector
// A machine is simple if: 2 states, no ε-transitions, all symbol-transitions
// go FROM start TO accept (accept has zero outgoing transitions).
// Both raw atom() and peephole-union outputs satisfy this.
// ══════════════════════════════════════════════════════════════════════════════
function isSimpleMachine(M) {
  if (M.states.length !== 2) return false;

  // No ε-transitions anywhere
  for (const arr of Object.values(M.epsilon)) {
    if (arr.length > 0) return false;
  }

  // All transitions from start must target accept only
  for (const targets of Object.values(M.transitions[M.start] || {})) {
    for (const t of targets) {
      if (t !== M.accept) return false;
    }
  }

  // No outgoing transitions from accept
  for (const targets of Object.values(M.transitions[M.accept] || {})) {
    if (targets.length > 0) return false;
  }

  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// Thompson NFA Fragment Primitives
// Each function returns: { start, accept, states[], transitions{}, epsilon{} }
// ══════════════════════════════════════════════════════════════════════════════

// ── atom ─────────────────────────────────────────────────────────────────────
function atomNFA(sym) {
  const s0 = newState(), s1 = newState();
  return {
    start:       s0,
    accept:      s1,
    states:      [s0, s1],
    transitions: { [s0]: { [sym]: [s1] }, [s1]: {} },
    epsilon:     { [s0]: [],             [s1]: [] },
  };
}

// ── concat (OPTIMIZED — state merge) ─────────────────────────────────────────
// Absorb B.start into A.accept. No ε-link. Removes 1 state per concatenation.
function concatNFA(A, B) {
  const pivot = A.accept;
  const bRest = B.states.filter(s => s !== B.start);

  // Clone A's epsilon and add bRest entries
  const eps = {};
  for (const [s, v] of Object.entries(A.epsilon)) eps[s] = [...v];
  for (const s of bRest)  eps[s] = [...(B.epsilon[s] || [])];
  for (const t of (B.epsilon[B.start] || [])) addEps(eps, pivot, t);

  // Clone A's transitions and add bRest entries
  const trans = {};
  for (const [s, row] of Object.entries(A.transitions)) {
    trans[s] = {};
    for (const [sym, tgts] of Object.entries(row)) trans[s][sym] = [...tgts];
  }
  for (const s of bRest) {
    trans[s] = {};
    for (const [sym, tgts] of Object.entries(B.transitions[s] || {})) {
      trans[s][sym] = [...tgts];
    }
  }
  // Absorb B.start's symbol-transitions into pivot
  for (const [sym, tgts] of Object.entries(B.transitions[B.start] || {})) {
    if (!trans[pivot][sym]) trans[pivot][sym] = [];
    for (const t of tgts) {
      if (!trans[pivot][sym].includes(t)) trans[pivot][sym].push(t);
    }
  }

  return {
    start:       A.start,
    accept:      B.accept,
    states:      [...A.states, ...bRest],
    transitions: trans,
    epsilon:     eps,
  };
}

// ── union — PEEPHOLE path ─────────────────────────────────────────────────────
// Both A and B are "simple": fold B's start-transitions onto A.start,
// redirecting B.accept → A.accept. Result: 2 states, 0 ε.
function peepholeUnion(A, B) {
  const trans = {};
  // Clone A's transitions
  for (const [s, row] of Object.entries(A.transitions)) {
    trans[s] = {};
    for (const [sym, tgts] of Object.entries(row)) trans[s][sym] = [...tgts];
  }
  // Fold in B.start's transitions, redirecting B.accept → A.accept
  for (const [sym, tgts] of Object.entries(B.transitions[B.start] || {})) {
    if (!trans[A.start][sym]) trans[A.start][sym] = [];
    for (const t of tgts) {
      const redirected = (t === B.accept) ? A.accept : t;
      if (!trans[A.start][sym].includes(redirected)) {
        trans[A.start][sym].push(redirected);
      }
    }
  }
  return {
    start:       A.start,
    accept:      A.accept,
    states:      [A.start, A.accept],   // B.start and B.accept are eliminated
    transitions: trans,
    epsilon:     { [A.start]: [], [A.accept]: [] },
  };
}

// ── union — standard Thompson fallback ───────────────────────────────────────
function standardUnion(A, B) {
  const start = newState(), accept = newState();
  const eps = { ...A.epsilon, ...B.epsilon, [start]: [], [accept]: [] };
  addEps(eps, start,    A.start);
  addEps(eps, start,    B.start);
  addEps(eps, A.accept, accept);
  addEps(eps, B.accept, accept);
  return {
    start,
    accept,
    states:      [start, accept, ...A.states, ...B.states],
    transitions: { [start]: {}, [accept]: {}, ...A.transitions, ...B.transitions },
    epsilon:     eps,
  };
}

// ── union — dispatcher ────────────────────────────────────────────────────────
// Attempt peephole optimization; fall back to standard Thompson for complex machines.
function unionNFA(A, B) {
  if (isSimpleMachine(A) && isSimpleMachine(B)) {
    return peepholeUnion(A, B);   // ← The Cheat Code: 2 states instead of 6
  }
  return standardUnion(A, B);
}

// ── star ──────────────────────────────────────────────────────────────────────
// Standard Thompson: 2 new states, 4 ε-transitions.
function starNFA(A) {
  const start = newState(), accept = newState();
  const eps = { ...A.epsilon, [start]: [], [accept]: [] };
  addEps(eps, start,    A.start);    // enter loop
  addEps(eps, start,    accept);     // zero occurrences
  addEps(eps, A.accept, A.start);    // loop back
  addEps(eps, A.accept, accept);     // exit
  return {
    start,
    accept,
    states:      [start, accept, ...A.states],
    transitions: { [start]: {}, [accept]: {}, ...A.transitions },
    epsilon:     eps,
  };
}

// ── plus ──────────────────────────────────────────────────────────────────────
// Like star but no "skip" edge — forces at least one traversal.
function plusNFA(A) {
  const start = newState(), accept = newState();
  const eps = { ...A.epsilon, [start]: [], [accept]: [] };
  addEps(eps, start,    A.start);    // must enter once
  addEps(eps, A.accept, A.start);    // loop back
  addEps(eps, A.accept, accept);     // exit
  return {
    start,
    accept,
    states:      [start, accept, ...A.states],
    transitions: { [start]: {}, [accept]: {}, ...A.transitions },
    epsilon:     eps,
  };
}

// ── optional ──────────────────────────────────────────────────────────────────
function optionalNFA(A) {
  const start = newState(), accept = newState();
  const eps = { ...A.epsilon, [start]: [], [accept]: [] };
  addEps(eps, start,    A.start);
  addEps(eps, start,    accept);     // skip
  addEps(eps, A.accept, accept);
  return {
    start,
    accept,
    states:      [start, accept, ...A.states],
    transitions: { [start]: {}, [accept]: {}, ...A.transitions },
    epsilon:     eps,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Regex Parser — Tokeniser → Insert-Concat → Shunting-Yard → NFA Stack
// ══════════════════════════════════════════════════════════════════════════════

function tokenize(regex) {
  const tokens = [];
  for (let i = 0; i < regex.length; i++) {
    if (regex[i] === '\\' && i + 1 < regex.length) {
      tokens.push({ type: 'literal', ch: regex[++i] });
    } else if ('|*+?()'.includes(regex[i])) {
      tokens.push({ type: 'op', ch: regex[i] });
    } else {
      tokens.push({ type: 'literal', ch: regex[i] });
    }
  }
  return tokens;
}

// Insert explicit '·' (concatenation) operator between adjacent value-producing tokens.
function insertConcat(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    out.push(tokens[i]);
    if (i + 1 < tokens.length) {
      const cur = tokens[i];
      const nxt = tokens[i + 1];
      const curIsVal = cur.type === 'literal' ||
                       [')', '*', '+', '?'].includes(cur.ch);
      const nxtIsVal = nxt.type === 'literal' || nxt.ch === '(';
      if (curIsVal && nxtIsVal) out.push({ type: 'op', ch: '·' });
    }
  }
  return out;
}

// Shunting-Yard: infix tokens → postfix tokens
function toPostfix(tokens) {
  const PREC = { '|': 1, '·': 2, '*': 3, '+': 3, '?': 3 };
  const out = [], stack = [];

  for (const tok of tokens) {
    if (tok.type === 'literal') {
      out.push(tok);
    } else if (tok.ch === '(') {
      stack.push(tok);
    } else if (tok.ch === ')') {
      while (stack.length && stack[stack.length - 1].ch !== '(') out.push(stack.pop());
      stack.pop();
    } else {
      while (
        stack.length &&
        stack[stack.length - 1].ch !== '(' &&
        (PREC[stack[stack.length - 1].ch] ?? -1) >= PREC[tok.ch]
      ) out.push(stack.pop());
      stack.push(tok);
    }
  }
  while (stack.length) out.push(stack.pop());
  return out;
}

// Build NFA from postfix token stream
function buildFromPostfix(postfix) {
  const stack = [];

  for (const tok of postfix) {
    if (tok.type === 'literal') {
      stack.push(atomNFA(tok.ch));
    } else {
      switch (tok.ch) {
        case '·': { const B = stack.pop(), A = stack.pop(); stack.push(concatNFA(A, B)); break; }
        case '|': { const B = stack.pop(), A = stack.pop(); stack.push(unionNFA(A, B));  break; }
        case '*': stack.push(starNFA(stack.pop()));      break;
        case '+': stack.push(plusNFA(stack.pop()));      break;
        case '?': stack.push(optionalNFA(stack.pop())); break;
        default:  throw new Error(`Unknown operator: '${tok.ch}'`);
      }
    }
  }
  if (stack.length !== 1) throw new Error('Malformed regex: could not reduce to a single NFA');
  return stack[0];
}

// ── Alphabet extraction ───────────────────────────────────────────────────────
function extractAlphabet(regex) {
  const OPS = new Set(['(', ')', '|', '*', '+', '?', '·', '\\']);
  const alpha = new Set();
  let escaped = false;
  for (const c of regex) {
    if (escaped) { alpha.add(c); escaped = false; }
    else if (c === '\\') escaped = true;
    else if (!OPS.has(c)) alpha.add(c);
  }
  return [...alpha].sort();
}

// ══════════════════════════════════════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════════════════════════════════════

export function validateRegex(regex) {
  if (!regex || !regex.trim()) return 'Regex cannot be empty';
  let depth = 0;
  for (const c of regex) {
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth < 0) return 'Unmatched closing parenthesis )'; }
  }
  if (depth !== 0) return 'Unmatched opening parenthesis (';
  if (/\|[)|]/.test(regex) || /[(|]\|/.test(regex) ||
      regex.startsWith('|') || regex.endsWith('|')) {
    return 'Empty operand in alternation';
  }
  return null;
}

/**
 * Stage 1: regexToENFA(regex) — Optimized Thompson's ε-NFA
 *
 * Returns:
 * {
 *   states:      string[]
 *   alphabet:    string[]
 *   start:       string
 *   accept:      string[]    ← exactly 1 state in Thompson
 *   transitions: { [state]: { [sym]: string[] } }
 *   epsilon:     { [state]: string[] }   ← populated for |, *, +, ?
 * }
 */
export function regexToENFA(regex) {
  const err = validateRegex(regex);
  if (err) throw new Error(err);

  const alphabet = extractAlphabet(regex);
  if (alphabet.length === 0) throw new Error('Regex must contain at least one literal symbol');

  resetId();

  const tokens  = tokenize(regex);
  const concatd = insertConcat(tokens);
  const postfix = toPostfix(concatd);
  const frag    = buildFromPostfix(postfix);

  // Ensure every state has complete entries in both maps
  for (const s of frag.states) {
    if (!frag.transitions[s]) frag.transitions[s] = {};
    if (!frag.epsilon[s])     frag.epsilon[s]     = [];
    for (const sym of alphabet) {
      if (!frag.transitions[s][sym]) frag.transitions[s][sym] = [];
    }
  }

  return normalizeNfaAutomaton({
    states:      frag.states,
    alphabet,
    start:       frag.start,
    accept:      [frag.accept],
    transitions: frag.transitions,
    epsilon:     frag.epsilon,
  });
}

// ── Dev helper ────────────────────────────────────────────────────────────────
export function _debugThompson(regex) {
  const nfa = regexToENFA(regex);
  console.group(`Optimized Thompson ε-NFA for: ${JSON.stringify(regex)}`);
  console.log(`States (${nfa.states.length}):`, nfa.states.join(', '));
  console.log('Start:', nfa.start, '  Accept:', nfa.accept);
  nfa.states.forEach(s => {
    const sym = Object.entries(nfa.transitions[s] || {})
      .filter(([, t]) => t.length)
      .map(([sym, t]) => `${sym}→[${t}]`).join(' ');
    const eps = (nfa.epsilon[s] || []).join(',');
    console.log(`  ${s}: ${sym || '∅'}${eps ? `  ε→[${eps}]` : ''}`);
  });
  console.groupEnd();
  return nfa;
}
