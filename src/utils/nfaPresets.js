function buildRow(symbols, target) {
  return Object.fromEntries(symbols.map((symbol) => [symbol, target ?? []]));
}

function wrapWithEpsilonStart({ id, name, description, automaton }) {
  const startState = 'qs';
  const baseEpsilon = automaton.epsilon ?? {};
  const transitions = {
    [startState]: buildRow(automaton.alphabet),
    ...automaton.transitions,
  };
  const epsilon = {
    [startState]: [automaton.startState],
  };

  automaton.states.forEach((state) => {
    epsilon[state] = [...(baseEpsilon[state] ?? [])];
  });

  return {
    id,
    name,
    description,
    automaton: {
      states: [startState, ...automaton.states],
      alphabet: [...automaton.alphabet],
      startState,
      acceptStates: [...automaton.acceptStates],
      transitions,
      epsilon,
    },
  };
}

export const NFA_PRESETS = [
  wrapWithEpsilonStart({
    id: 'divisible-by-5',
    name: 'Binary divisible by 5',
    description: 'All binary strings whose numeric value is divisible by 5.',
    automaton: {
      states: ['r0', 'r1', 'r2', 'r3', 'r4'],
      alphabet: ['0', '1'],
      startState: 'r0',
      acceptStates: ['r0'],
      transitions: {
        r0: { '0': ['r0'], '1': ['r1'] },
        r1: { '0': ['r2'], '1': ['r3'] },
        r2: { '0': ['r4'], '1': ['r0'] },
        r3: { '0': ['r1'], '1': ['r2'] },
        r4: { '0': ['r3'], '1': ['r4'] },
      },
    },
  }),
  wrapWithEpsilonStart({
    id: 'contains-1001',
    name: 'Contains 1001',
    description: 'Binary strings that contain 1001 as a substring.',
    automaton: {
      states: ['q0', 'q1', 'q2', 'q3', 'q4'],
      alphabet: ['0', '1'],
      startState: 'q0',
      acceptStates: ['q4'],
      transitions: {
        q0: { '0': ['q0'], '1': ['q1'] },
        q1: { '0': ['q2'], '1': ['q1'] },
        q2: { '0': ['q3'], '1': ['q1'] },
        q3: { '0': ['q0'], '1': ['q4'] },
        q4: { '0': ['q4'], '1': ['q4'] },
      },
    },
  }),
  wrapWithEpsilonStart({
    id: 'ends-with-01',
    name: 'Ends with 01',
    description: 'Binary strings whose final two symbols are 01.',
    automaton: {
      states: ['q0', 'q1', 'q2'],
      alphabet: ['0', '1'],
      startState: 'q0',
      acceptStates: ['q2'],
      transitions: {
        q0: { '0': ['q1'], '1': ['q0'] },
        q1: { '0': ['q1'], '1': ['q2'] },
        q2: { '0': ['q1'], '1': ['q0'] },
      },
    },
  }),
  wrapWithEpsilonStart({
    id: 'even-zeros',
    name: 'Even number of 0s',
    description: 'Strings over {0,1} containing an even count of 0 symbols.',
    automaton: {
      states: ['even', 'odd'],
      alphabet: ['0', '1'],
      startState: 'even',
      acceptStates: ['even'],
      transitions: {
        even: { '0': ['odd'], '1': ['even'] },
        odd: { '0': ['even'], '1': ['odd'] },
      },
    },
  }),
  wrapWithEpsilonStart({
    id: 'odd-ones',
    name: 'Odd number of 1s',
    description: 'Strings over {0,1} containing an odd count of 1 symbols.',
    automaton: {
      states: ['even', 'odd'],
      alphabet: ['0', '1'],
      startState: 'even',
      acceptStates: ['odd'],
      transitions: {
        even: { '0': ['even'], '1': ['odd'] },
        odd: { '0': ['odd'], '1': ['even'] },
      },
    },
  }),
  wrapWithEpsilonStart({
    id: 'even-length',
    name: 'Even length',
    description: 'Binary strings with an even total length.',
    automaton: {
      states: ['even', 'odd'],
      alphabet: ['0', '1'],
      startState: 'even',
      acceptStates: ['even'],
      transitions: {
        even: { '0': ['odd'], '1': ['odd'] },
        odd: { '0': ['even'], '1': ['even'] },
      },
    },
  }),
  wrapWithEpsilonStart({
    id: 'at-least-two-ones',
    name: 'At least two 1s',
    description: 'Binary strings containing two or more 1 symbols.',
    automaton: {
      states: ['q0', 'q1', 'q2'],
      alphabet: ['0', '1'],
      startState: 'q0',
      acceptStates: ['q2'],
      transitions: {
        q0: { '0': ['q0'], '1': ['q1'] },
        q1: { '0': ['q1'], '1': ['q2'] },
        q2: { '0': ['q2'], '1': ['q2'] },
      },
    },
  }),
  wrapWithEpsilonStart({
    id: 'starts-with-ab',
    name: 'Starts with ab',
    description: 'Strings over {a,b} whose first two symbols are ab.',
    automaton: {
      states: ['q0', 'q1', 'q2', 'sink'],
      alphabet: ['a', 'b'],
      startState: 'q0',
      acceptStates: ['q2'],
      transitions: {
        q0: { a: ['q1'], b: ['sink'] },
        q1: { a: ['sink'], b: ['q2'] },
        q2: { a: ['q2'], b: ['q2'] },
        sink: { a: ['sink'], b: ['sink'] },
      },
    },
  }),
  wrapWithEpsilonStart({
    id: 'contains-aba',
    name: 'Contains aba',
    description: 'Strings over {a,b} that contain aba as a substring.',
    automaton: {
      states: ['q0', 'q1', 'q2', 'q3'],
      alphabet: ['a', 'b'],
      startState: 'q0',
      acceptStates: ['q3'],
      transitions: {
        q0: { a: ['q1'], b: ['q0'] },
        q1: { a: ['q1'], b: ['q2'] },
        q2: { a: ['q3'], b: ['q0'] },
        q3: { a: ['q3'], b: ['q3'] },
      },
    },
  }),
  wrapWithEpsilonStart({
    id: 'exactly-one-a',
    name: 'Exactly one a',
    description: 'Strings over {a,b} with exactly one occurrence of a.',
    automaton: {
      states: ['q0', 'q1', 'q2'],
      alphabet: ['a', 'b'],
      startState: 'q0',
      acceptStates: ['q1'],
      transitions: {
        q0: { a: ['q1'], b: ['q0'] },
        q1: { a: ['q2'], b: ['q1'] },
        q2: { a: ['q2'], b: ['q2'] },
      },
    },
  }),
];
