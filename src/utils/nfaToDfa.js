/**
 * 4-Stage Automata Compilation Pipeline
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Stage 1 — buildOptimizedNFA()   : Glushkov Position Automaton  (in regexToENFA.js)
 * Stage 2 — compressNFA()         : ε-Elimination + Bisimulation Merging  ← HERE
 * Stage 3 — subsetConstruction()  : Powerset / Subset Construction         ← HERE
 * Stage 4 — minimizeDFA()         : Hopcroft's Algorithm                   (in minimizeDFA.js)
 *
 * NFA shape used throughout:
 * {
 *   states:      string[]
 *   alphabet:    string[]
 *   start:       string
 *   accept:      string[]
 *   transitions: { [state]: { [sym]: string[] } }
 *   epsilon:     { [state]: string[] }
 * }
 */

import { normalizeDfaAutomaton, normalizeNfaAutomaton } from './automata';

// ── Utility: ε-closure ────────────────────────────────────────────────────────

/**
 * Compute the ε-closure of an array of states.
 * Returns a sorted array of all states reachable via ≥0 ε-transitions.
 */
export function epsilonClosure(states, nfa) {
  const stack   = [...states];
  const closure = new Set(states);
  while (stack.length) {
    const s = stack.pop();
    for (const t of (nfa.epsilon?.[s] ?? [])) {
      if (!closure.has(t)) { closure.add(t); stack.push(t); }
    }
  }
  return [...closure].sort();
}

// ── Utility: move ─────────────────────────────────────────────────────────────

/**
 * Image of `states` under one symbol transition (no ε-closure applied).
 */
export function move(states, symbol, nfa) {
  const result = new Set();
  for (const s of states) {
    for (const t of (nfa.transitions[s]?.[symbol] ?? [])) result.add(t);
  }
  return [...result];
}

// ══════════════════════════════════════════════════════════════════════════════
// STAGE 2A — ε-Elimination
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Eliminate all ε-transitions from an NFA.
 *
 * For each state s:
 *   closure(s)  = ε-closure({s})
 *   δ'(s, a)    = ε-closure( move(closure(s), a) )
 *   s ∈ F'      ⟺  closure(s) ∩ F ≠ ∅
 *
 * The result has the same states as the input (no new states created).
 * Since Glushkov's NFA has no ε-transitions, this is a fast identity-like pass.
 */
export function removeEpsilonTransitions(nfa) {
  const normalized = normalizeNfaAutomaton(nfa);
  const { states, alphabet, startState, acceptStates } = normalized;
  const acceptSet = new Set(acceptStates);

  const newTransitions = {};
  const newAccept      = [];

  for (const state of states) {
    const closure = epsilonClosure([state], nfa);
    if (closure.some(s => acceptSet.has(s))) newAccept.push(state);

    newTransitions[state] = {};
    for (const sym of alphabet) {
      const reachable = epsilonClosure(move(closure, sym, nfa), nfa);
      newTransitions[state][sym] = reachable.length ? reachable : [];
    }
  }

  return normalizeNfaAutomaton({
    states,
    alphabet,
    startState,
    acceptStates: newAccept,
    transitions: newTransitions,
    epsilon:     Object.fromEntries(states.map(s => [s, []])),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// STAGE 2B — Bisimulation Equivalence Merging
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Merge bisimulation-equivalent states in an ε-free NFA.
 *
 * Two states p, q are bisimulation-equivalent iff:
 *   (a)  p ∈ F  ⟺  q ∈ F                    (same accept status)
 *   (b)  ∀ a ∈ Σ: postImg(p,a) ≅ postImg(q,a)
 *        where post-image equality is judged by PARTITION CLASS,
 *        not raw state IDs (so we iterate until stable).
 *
 * Algorithm: partition-refinement (similar to Hopcroft but for NFAs).
 *   1. Initial repr = identity (every state is its own representative)
 *   2. In each round, compute each state's SIGNATURE:
 *        accStatus(repr[s]) + sorted repr-mapped transition targets per symbol
 *   3. Group states by signature; elect lex-smallest state as representative
 *   4. Repeat until repr is unchanged → stable
 *   5. Build merged NFA from unique representatives
 *
 * Correctness proof sketch for (a|b)*ab (Glushkov, 5 states):
 *   Round 1: sig(q0)=sig(q1)=sig(q2) → all merge to q0 → repr reduces to 3 states
 *   Round 2: no further merging → stable
 *   Result: 3-state NFA {q0, q3, q4}; subset construction → 3-state DFA (already minimal)
 */
function bisimulationMerge(nfa) {
  const { states, alphabet, start, accept, transitions } = nfa;
  const acceptSet = new Set(accept);

  // repr[s] = canonical representative of s's equivalence class
  // Start with identity: every state represents itself
  let repr = Object.fromEntries(states.map(s => [s, s]));

  let changed = true;
  while (changed) {
    changed = false;

    // ── Compute signature for each original state ────────────────────────
    // The signature of s is derived from REPR[s]'s transitions (canonical form).
    // Targets are mapped through repr so states in the same class look identical.
    const computeSig = (s) => {
      const src   = repr[s];
      const parts = [acceptSet.has(src) ? '1' : '0'];
      for (const sym of alphabet) {
        const raw    = transitions[src]?.[sym] ?? [];
        const mapped = [...new Set(raw.map(t => repr[t]))].sort();
        parts.push(sym + ':' + mapped.join(','));
      }
      return parts.join('|');
    };

    // ── Group all original states by signature ───────────────────────────
    const groups = new Map();       // sig → original state[]
    for (const s of states) {
      const key = computeSig(s);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }

    // ── Elect representatives (lex-smallest in each group) ───────────────
    for (const group of groups.values()) {
      const rep = [...group].sort()[0];
      for (const s of group) {
        if (repr[s] !== rep) { repr[s] = rep; changed = true; }
      }
    }
  }

  // ── Assemble merged NFA ───────────────────────────────────────────────────
  const repStates = [...new Set(Object.values(repr))].sort();
  const newStart  = repr[start];
  // An accept state's representative is itself accepting (we never merge across accept boundary)
  const newAccept = [...new Set(accept.map(s => repr[s]))];

  const newTransitions = {};
  const newEpsilon     = {};
  for (const rep of repStates) {
    newTransitions[rep] = {};
    newEpsilon[rep]     = [];
    for (const sym of alphabet) {
      // Use the representative's original transitions, remapped through repr
      const raw    = transitions[rep]?.[sym] ?? [];
      const merged = [...new Set(raw.map(t => repr[t]))].sort();
      newTransitions[rep][sym] = merged;
    }
  }

  return {
    states:      repStates,
    alphabet,
    start:       newStart,
    accept:      newAccept,
    transitions: newTransitions,
    epsilon:     newEpsilon,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// STAGE 2B — Garbage Collection  (remove unreachable states)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * BFS from start state. Prune every state not transitively reachable.
 * Runs AFTER ε-elimination (so follows only symbol-transitions; no ε remain).
 *
 * Eliminates "ghost" states left behind when Thompson's bridges are severed
 * during ε-closure rerouting but the original nodes were never cleaned up.
 */
export function removeUnreachableStates(nfa) {
  const normalized = normalizeNfaAutomaton(nfa);
  const { states, alphabet, startState, acceptStates, transitions, epsilon } = normalized;

  // BFS / DFS — follow symbol-transitions AND any residual ε-transitions
  const reachable = new Set(startState ? [startState] : []);
  const queue     = startState ? [startState] : [];

  while (queue.length) {
    const s = queue.shift();
    // Symbol transitions
    for (const sym of alphabet) {
      for (const t of (transitions[s]?.[sym] ?? [])) {
        if (!reachable.has(t)) { reachable.add(t); queue.push(t); }
      }
    }
    // ε-transitions (if any remain)
    for (const t of (epsilon?.[s] ?? [])) {
      if (!reachable.has(t)) { reachable.add(t); queue.push(t); }
    }
  }

  const liveStates      = states.filter(s => reachable.has(s));
  const newAccept       = acceptStates.filter(s => reachable.has(s));
  const newTransitions  = {};
  const newEpsilon      = {};

  for (const s of liveStates) {
    newTransitions[s] = {};
    newEpsilon[s]     = (epsilon?.[s] ?? []).filter(t => reachable.has(t));
    for (const sym of alphabet) {
      newTransitions[s][sym] = (transitions[s]?.[sym] ?? []).filter(t => reachable.has(t));
    }
  }

  return normalizeNfaAutomaton({
    states: liveStates,
    alphabet,
    startState,
    acceptStates: newAccept,
    transitions: newTransitions,
    epsilon: newEpsilon,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// STAGE 2 — NFA Compression (public entry point)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Compress an NFA via three ordered sub-steps:
 *
 *   Step 2A  removeEpsilonTransitions  — reroute all symbol transitions via ε-closure,
 *                                        delete ε-arcs, promote accepting status
 *   Step 2B  removeUnreachableStates   — BFS garbage-collect any ghost states that
 *                                        became unreachable after ε-elimination
 *   Step 2C  bisimulationMerge         — partition-refine and merge equivalent states
 *
 * Pipeline state counts for (a|b)*ab (Thompson + peephole Stage 1):
 *   ε-NFA (Stage 1)   →  6 states
 *   After Step 2A     →  6 states  (all reachable, no ε remain)
 *   After Step 2B     →  6 states  (nothing to garbage-collect here)
 *   After Step 2C     →  3 states  (t4≡t1 merge; further reduction)
 *   DFA (Stage 3)     →  3 states  (already minimal after bisimulation)
 *   Min-DFA (Stage 4) →  3 states  ✓
 */
export function compressNFA(nfa) {
  const noEps    = removeEpsilonTransitions(nfa);   // Stage 2A
  const noGhosts = removeUnreachableStates(noEps);  // Stage 2B — garbage collect
  return bisimulationMerge(noGhosts);               // Stage 2C
}

// ══════════════════════════════════════════════════════════════════════════════
// STAGE 3 — Subset (Powerset) Construction  NFA → DFA
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Convert a compressed NFA to a DFA via powerset construction.
 *
 * Because the input NFA is already bisimulation-minimal, the DFA produced
 * here is much smaller than naive Thompson → subset would give.
 * For (a|b)*ab the compressed NFA has 3 states → DFA has exactly 3 states
 * (already the minimal DFA, before even running Hopcroft).
 *
 * Returns:
 * {
 *   start:       string
 *   states:      string[]
 *   stateMap:    Map<key, string[]>   — DFA key → NFA state set
 *   transitions: { [key]: { [sym]: key } }
 *   accept:      string[]
 *   alphabet:    string[]
 *   steps:       object[]            — for step-by-step visualization
 * }
 */
export function subsetConstruction(nfa) {
  const DEAD = '∅';
  const normalized = normalizeNfaAutomaton(nfa);

  const startClosure = epsilonClosure([normalized.startState], normalized);
  const startKey     = startClosure.length ? startClosure.join(',') : DEAD;

  const stateMap    = new Map([[startKey, startClosure]]);
  const transitions = {};
  const visited     = new Set();
  const queue       = [startKey];
  const steps       = [];

  while (queue.length) {
    const key = queue.shift();
    if (visited.has(key)) continue;
    visited.add(key);
    transitions[key] = {};

    const nfaStates = stateMap.get(key) ?? [];

    for (const sym of normalized.alphabet) {
      let closure, closureKey;

      if (key === DEAD) {
        closure    = [];
        closureKey = DEAD;
      } else {
        const moved = move(nfaStates, sym, normalized);
        closure     = epsilonClosure(moved, normalized);
        closureKey  = closure.length ? closure.join(',') : DEAD;

        steps.push({
          from:        key,
          symbol:      sym,
          to:          closureKey,
          movedRaw:    moved,
          description:
            `δ({${key}}, '${sym}') = move({${key}}, '${sym}') = ` +
            `{${moved.join(', ') || '∅'}} → ε-closure = {${closureKey}}`,
        });
      }

      transitions[key][sym] = closureKey;

      if (!stateMap.has(closureKey)) {
        stateMap.set(closureKey, closure);
        queue.push(closureKey);
      }
    }
  }

  const acceptSet = new Set(normalized.acceptStates);
  const accept    = [...stateMap.keys()].filter(key =>
    (stateMap.get(key) ?? []).some(s => acceptSet.has(s))
  );

  return normalizeDfaAutomaton({
    startState:  startKey,
    states:      [...stateMap.keys()],
    stateMap,
    transitions,
    acceptStates: accept,
    alphabet:    normalized.alphabet,
    steps,
  });
}
