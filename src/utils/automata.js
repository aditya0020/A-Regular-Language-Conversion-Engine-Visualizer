function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function normalizeTargets(targets) {
  if (Array.isArray(targets)) return unique(targets);
  return targets ? [targets] : [];
}

function collectTransitionStates(transitions, isMultiTarget) {
  const states = [];

  Object.entries(transitions ?? {}).forEach(([state, row]) => {
    states.push(state);

    Object.values(row ?? {}).forEach((target) => {
      if (isMultiTarget) {
        states.push(...normalizeTargets(target));
      } else if (Array.isArray(target)) {
        if (target[0]) states.push(target[0]);
      } else if (target) {
        states.push(target);
      }
    });
  });

  return states;
}

function collectAlphabet(transitions, explicitAlphabet = []) {
  return unique([
    ...explicitAlphabet,
    ...Object.values(transitions ?? {}).flatMap((row) => Object.keys(row ?? {})),
  ]);
}

export function normalizeNfaAutomaton(automaton) {
  if (!automaton) return null;

  const acceptInput = automaton.acceptStates ?? automaton.accept ?? [];
  const acceptStates = unique(Array.isArray(acceptInput) ? acceptInput : [acceptInput]);
  const startCandidate = automaton.startState ?? automaton.start ?? '';
  const states = unique([
    ...(automaton.states ?? []),
    startCandidate,
    ...acceptStates,
    ...Object.keys(automaton.epsilon ?? {}),
    ...Object.values(automaton.epsilon ?? {}).flatMap((targets) => normalizeTargets(targets)),
    ...collectTransitionStates(automaton.transitions, true),
  ]);
  const alphabet = collectAlphabet(automaton.transitions, automaton.alphabet ?? []);
  const startState = startCandidate || states[0] || '';

  const transitions = Object.fromEntries(
    states.map((state) => [
      state,
      Object.fromEntries(
        alphabet.map((symbol) => {
          const raw = automaton.transitions?.[state]?.[symbol];
          return [symbol, normalizeTargets(raw)];
        })
      ),
    ])
  );

  const epsilon = Object.fromEntries(
    states.map((state) => {
      const raw = automaton.epsilon?.[state];
      return [state, normalizeTargets(raw)];
    })
  );

  return {
    ...automaton,
    states,
    alphabet,
    transitions,
    epsilon,
    startState,
    acceptStates,
    start: startState,
    accept: acceptStates,
  };
}

export function normalizeDfaAutomaton(automaton) {
  if (!automaton) return null;

  const acceptInput = automaton.acceptStates ?? automaton.accept ?? [];
  const acceptStates = unique(Array.isArray(acceptInput) ? acceptInput : [acceptInput]);
  const startCandidate = automaton.startState ?? automaton.start ?? '';
  const states = unique([
    ...(automaton.states ?? []),
    startCandidate,
    ...acceptStates,
    ...collectTransitionStates(automaton.transitions, false),
  ]);
  const alphabet = collectAlphabet(automaton.transitions, automaton.alphabet ?? []);
  const startState = startCandidate || states[0] || '';

  const transitions = Object.fromEntries(
    states.map((state) => {
      const row = automaton.transitions?.[state] ?? {};
      return [
        state,
        Object.fromEntries(
          Object.entries(row).flatMap(([symbol, target]) => {
            const nextState = Array.isArray(target) ? target[0] : target;
            return nextState ? [[symbol, nextState]] : [];
          })
        ),
      ];
    })
  );

  return {
    ...automaton,
    states,
    alphabet,
    transitions,
    startState,
    acceptStates,
    start: startState,
    accept: acceptStates,
  };
}
