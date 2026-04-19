# Automata Lab

Interactive Theory of Computation simulator for building, converting, visualizing, and testing finite automata in the browser.



## Overview

This project is a React + Vite web app that turns core automata theory algorithms into an interactive visual pipeline. It lets you work in two ways:

- `Regex mode`: start from a regular expression and generate the corresponding automata step by step.
- `NFA Builder mode`: manually create an NFA or epsilon-NFA and convert it forward through the pipeline.

The app is designed for learning, demonstrations, and Theory of Computation assignments. Instead of showing only final answers, it also shows intermediate constructions, partition splits, transition tables, and animated string simulation paths.

## What the app does

The simulator supports the following flow:

`Regex -> epsilon-NFA -> NFA -> DFA -> Min-DFA`

and also:

`Manual NFA/epsilon-NFA -> NFA -> DFA -> Min-DFA`

Each stage is drawn as an interactive graph and can be explored from the sidebar and canvas.

## Pipeline behavior

### Regex mode

Regex mode uses two different constructions for two different purposes:

1. `Regex -> epsilon-NFA`
   Uses an optimized Thompson-style construction from `src/utils/regexToENFA.js`.

2. `Regex -> NFA`
   Builds a minimal epsilon-free NFA from the regex using Glushkov's position automaton plus bisimulation merging from `src/utils/minimalNFA.js`.

3. `NFA -> DFA`
   Uses subset construction from `src/utils/nfaToDfa.js`.

4. `DFA -> Min-DFA`
   Uses Hopcroft's minimization algorithm from `src/utils/minimizeDFA.js`.

This means the NFA shown after the epsilon-NFA stage is not just a visual cleanup of the Thompson machine. In regex mode, it is rebuilt as a compact epsilon-free NFA specifically for a cleaner and smaller teaching representation.

### NFA Builder mode

Builder mode starts from the automaton you create manually in the UI.

1. `epsilon-NFA/NFA -> NFA`
   Applies epsilon-elimination, unreachable-state removal, and bisimulation-style state merging.

2. `NFA -> DFA`
   Runs subset construction.

3. `DFA -> Min-DFA`
   Runs Hopcroft minimization.

This path is useful when you want to enter transitions yourself and see how the formal conversions behave on a custom machine.

## Algorithms used

### 1. Optimized Thompson construction

Implemented in `src/utils/regexToENFA.js`.

Highlights:

- tokenizes the regex
- inserts explicit concatenation operators
- converts infix regex to postfix with the shunting-yard method
- builds an epsilon-NFA from postfix fragments
- supports `|`, concatenation, `*`, `+`, `?`, and parentheses
- includes optimizations such as concatenation state merging and a simple-union peephole path

### 2. Glushkov position automaton

Implemented in `src/utils/minimalNFA.js`.

Highlights:

- parses regex into an AST
- computes `nullable`, `first`, `last`, and `follow` sets
- builds an epsilon-free position automaton
- merges bisimulation-equivalent states to obtain a compact NFA

### 3. Epsilon-closure based epsilon removal

Implemented in `src/utils/nfaToDfa.js`.

For each state, the app computes epsilon-closures and rebuilds transitions without epsilon edges.

### 4. Unreachable-state removal

Also in `src/utils/nfaToDfa.js`.

After conversion, unreachable states are removed with a graph traversal from the start state.

### 5. Bisimulation-style NFA compression

Used in both `src/utils/nfaToDfa.js` and `src/utils/minimalNFA.js`.

States with equivalent transition signatures and the same acceptance behavior are merged to reduce machine size.

### 6. Subset construction

Implemented in `src/utils/nfaToDfa.js`.

Highlights:

- treats sets of NFA states as DFA states
- records every transition step
- creates an explicit dead state when needed
- feeds the step panel used in the UI

### 7. Hopcroft minimization

Implemented in `src/utils/minimizeDFA.js`.

Highlights:

- partitions accepting and non-accepting states
- repeatedly splits partitions using distinguishability
- builds equivalence classes for the minimized DFA
- records each split for the minimization step panel

### 8. BFS-based graph layout

Implemented in `src/utils/graphLayout.js`.

The visualizer places states using a breadth-first layered layout so the graphs stay readable and deterministic.

## Simulation and visualization features

### Graph view

- interactive automata graphs built with React Flow
- custom state nodes for start, accept, highlighted, path, and dead states
- custom self-loop and bezier edges
- automatic layout based on graph structure
- zoom, pan, minimap, and drag support

### Regex workspace

- regex validation before building
- operator palette for `|`, `*`, `+`, `?`, and grouping
- quick insertion helpers
- recent regex history stored in local storage
- random regex generator

### NFA Builder

- add and remove states
- add and remove alphabet symbols
- mark start and accept states
- edit symbol and epsilon transitions in a live transition table
- random NFA generator

### Step-by-step construction panels

- subset construction steps shown one by one
- transition descriptions such as move and epsilon-closure results
- Hopcroft partition splits shown step by step
- equivalence classes for minimized states
- progress bars and next/previous navigation

### String simulator

- test strings on the DFA or minimized DFA
- validates symbols against the alphabet
- animates the current state and traversed path
- shows the full path trace
- marks accept and reject outcomes clearly

### Transition table view

- right sidebar table for the currently selected machine
- works for epsilon-NFA, NFA, DFA, and Min-DFA
- shows start and accept markers directly in the table

## Tech stack

- `React 19`
- `Vite`
- `@xyflow/react` for graph rendering
- `Tailwind CSS`
- plain JavaScript for algorithm implementations

## Project structure

```text
src/
  App.jsx                     # Main app shell and pipeline orchestration
  main.jsx                    # React entry point
  index.css                   # Global styles

  components/
    RegexInput.jsx            # Regex input workspace
    NFABuilder.jsx            # Manual NFA editor
    GraphView.jsx             # Graph canvas wrapper
    StepPanel.jsx             # Subset construction step viewer
    MinStepPanel.jsx          # Hopcroft step viewer
    StringTester.jsx          # DFA and Min-DFA string simulation
    CustomNode.jsx            # Custom graph node
    SelfLoopEdge.jsx          # Custom self-loop edge
    BezierEdge.jsx            # Custom directed edge

  utils/
    regexToENFA.js            # Regex -> epsilon-NFA
    minimalNFA.js             # Regex -> minimal epsilon-free NFA
    nfaToDfa.js               # Epsilon removal, compression, subset construction
    minimizeDFA.js            # DFA minimization
    graphLayout.js            # Graph layout and edge mapping
```

## Running locally

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

## Educational value

This project is useful for:

- Theory of Computation coursework
- classroom demonstrations
- visual understanding of regex and automata conversions
- comparing intermediate and minimized forms of automata
- exploring how acceptance changes as strings move through a DFA

## Notes

- Regex mode emphasizes both construction and simplification.
- Builder mode emphasizes custom input and formal conversion.
- The application is a teaching tool first, so the UI exposes internal steps rather than hiding them.
