/**
 * Hopcroft's Algorithm - DFA -> Minimized DFA
 */

import { normalizeDfaAutomaton } from './automata';

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function getReachable({ startState, start, transitions, alphabet }) {
  const origin = startState ?? start;
  const visited = new Set(origin ? [origin] : []);
  const queue = origin ? [origin] : [];

  while (queue.length) {
    const s = queue.shift();
    for (const sym of alphabet) {
      const t = transitions[s]?.[sym];
      if (t && !visited.has(t)) {
        visited.add(t);
        queue.push(t);
      }
    }
  }

  return visited;
}

function findGroup(partitions, state) {
  return partitions.find((group) => group.has(state));
}

export function hopcroftMinimize(dfa) {
  const normalized = normalizeDfaAutomaton(dfa);
  const { alphabet, startState, acceptStates, transitions } = normalized;

  // Minimize only the reachable fragment, but keep sink states when reachable
  // so the resulting DFA remains total for simulation.
  const reachable = getReachable(normalized);
  const liveStates = [...reachable];

  const F = new Set(liveStates.filter((state) => acceptStates.includes(state)));
  const nF = new Set(liveStates.filter((state) => !acceptStates.includes(state)));

  let P = [];
  if (F.size > 0) P.push(F);
  if (nF.size > 0) P.push(nF);

  const W = [];
  if (F.size > 0 && nF.size > 0) W.push(F.size <= nF.size ? F : nF);
  else if (F.size > 0) W.push(F);
  else if (nF.size > 0) W.push(nF);

  const steps = [{
    description: `Initial partition: Accept={${[...F].sort()}} | Non-Accept={${[...nF].sort()}}`,
    partitions: P.map((group) => [...group].sort()),
  }];

  while (W.length > 0) {
    const A = W.shift();

    for (const sym of alphabet) {
      const X = new Set(liveStates.filter((state) => {
        const target = transitions[state]?.[sym];
        return target && A.has(target);
      }));

      if (X.size === 0) continue;

      const nextP = [];
      for (const Y of P) {
        const inter = new Set([...Y].filter((state) => X.has(state)));
        const diff = new Set([...Y].filter((state) => !X.has(state)));

        if (inter.size > 0 && diff.size > 0) {
          nextP.push(inter, diff);

          const wIdx = W.findIndex((group) => setsEqual(group, Y));
          if (wIdx >= 0) {
            W.splice(wIdx, 1);
            W.push(inter, diff);
          } else {
            W.push(inter.size <= diff.size ? inter : diff);
          }

          steps.push({
            description: `On '${sym}': split {${[...Y].sort()}} -> {${[...inter].sort()}} U {${[...diff].sort()}}`,
            partitions: P.map((group) => [...group].sort()),
          });
        } else {
          nextP.push(Y);
        }
      }

      P = nextP;
    }
  }

  const newStates = P.map((_, i) => `M${i}`);
  const newAccept = [];
  const newTrans = {};
  const partMap = {};

  P.forEach((group, i) => {
    const name = `M${i}`;
    partMap[name] = [...group].sort();

    if ([...group].some((state) => acceptStates.includes(state))) {
      newAccept.push(name);
    }

    newTrans[name] = {};
    const rep = [...group][0];
    for (const sym of alphabet) {
      const target = transitions[rep]?.[sym];
      if (!target) continue;

      const targetGroup = findGroup(P, target);
      if (targetGroup) {
        newTrans[name][sym] = `M${P.indexOf(targetGroup)}`;
      }
    }
  });

  const startGroup = findGroup(P, startState);
  const newStart = startGroup ? `M${P.indexOf(startGroup)}` : 'M0';

  steps.push({
    description: `Done - ${liveStates.length} states -> ${newStates.length} minimized states`,
    partitions: P.map((group) => [...group].sort()),
  });

  return normalizeDfaAutomaton({
    states: newStates,
    alphabet,
    startState: newStart,
    acceptStates: newAccept,
    transitions: newTrans,
    steps,
    partitionMap: partMap,
    originalStateCount: liveStates.length,
    minimizedStateCount: newStates.length,
  });
}
