/**
 * Hopcroft's Algorithm — DFA → Minimized DFA
 */

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function getReachable({ start, transitions, alphabet }) {
  const visited = new Set([start]);
  const queue   = [start];
  while (queue.length) {
    const s = queue.shift();
    for (const sym of alphabet) {
      const t = transitions[s]?.[sym];
      if (t && t !== '∅' && !visited.has(t)) { visited.add(t); queue.push(t); }
    }
  }
  return visited;
}

function findGroup(P, state) {
  return P.find(p => p.has(state));
}

function pName(p) {
  return [...p].sort().join('‖');
}

export function hopcroftMinimize(dfa) {
  const { alphabet, start, accept, transitions } = dfa;

  // Work only with reachable, non-dead states
  const reachable  = getReachable(dfa);
  const liveStates = [...reachable].filter(s => s !== '∅');

  const F  = new Set(liveStates.filter(s => accept.includes(s)));
  const nF = new Set(liveStates.filter(s => !accept.includes(s)));

  if (F.size === 0) return { ...dfa, steps: [], partitionMap: {}, minimizedStateCount: liveStates.length };

  // Initial partition P = { F, Q-F }
  let P = [];
  if (F.size  > 0) P.push(F);
  if (nF.size > 0) P.push(nF);

  // Worklist — start with smaller set
  const W = [F.size <= nF.size ? F : nF];

  const steps = [{
    description: `Initial partition: Accept={${[...F].sort()}} | Non-Accept={${[...nF].sort()}}`,
    partitions: P.map(p => [...p].sort()),
  }];

  while (W.length > 0) {
    const A = W.shift();

    for (const sym of alphabet) {
      // X = states whose transition on sym lands in A
      const X = new Set(liveStates.filter(s => {
        const t = transitions[s]?.[sym];
        return t && A.has(t);
      }));

      if (X.size === 0) continue;

      const nextP = [];
      for (const Y of P) {
        const inter = new Set([...Y].filter(s =>  X.has(s)));
        const diff  = new Set([...Y].filter(s => !X.has(s)));

        if (inter.size > 0 && diff.size > 0) {
          nextP.push(inter, diff);

          const wIdx = W.findIndex(w => setsEqual(w, Y));
          if (wIdx >= 0) {
            W.splice(wIdx, 1);
            W.push(inter, diff);
          } else {
            W.push(inter.size <= diff.size ? inter : diff);
          }

          steps.push({
            description: `On '${sym}': split {${[...Y].sort()}} → {${[...inter].sort()}} ∪ {${[...diff].sort()}}`,
            partitions: P.map(p => [...p].sort()),
          });
        } else {
          nextP.push(Y);
        }
      }
      P = nextP;
    }
  }

  // ── Build minimized DFA ────────────────────────────────────────────
  const newStates  = P.map((_, i) => `M${i}`);
  const newAccept  = [];
  const newTrans   = {};
  const partMap    = {};

  P.forEach((p, i) => {
    const name = `M${i}`;
    partMap[name] = [...p].sort();

    if ([...p].some(s => accept.includes(s))) newAccept.push(name);

    newTrans[name] = {};
    const rep = [...p][0];
    for (const sym of alphabet) {
      const t = transitions[rep]?.[sym];
      if (t && t !== '∅') {
        const tGroup = findGroup(P, t);
        if (tGroup) {
          const tIdx = P.indexOf(tGroup);
          newTrans[name][sym] = `M${tIdx}`;
        }
      }
    }
  });

  const startGroup = findGroup(P, start);
  const newStart   = startGroup ? `M${P.indexOf(startGroup)}` : `M0`;

  steps.push({
    description: `✅ Done — ${liveStates.length} states → ${newStates.length} minimized states`,
    partitions: P.map(p => [...p].sort()),
  });

  return {
    states:  newStates,
    alphabet,
    start:   newStart,
    accept:  newAccept,
    transitions: newTrans,
    steps,
    partitionMap: partMap,
    originalStateCount:   liveStates.length,
    minimizedStateCount:  newStates.length,
  };
}
