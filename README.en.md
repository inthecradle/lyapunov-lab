# LYAPUNOV LAB

[日本語](README.md) | English

[**Open the app**](https://inthecradle.github.io/lyapunov-lab/) · [GitHub repository](https://github.com/inthecradle/lyapunov-lab)

An educational web app for exploring equations, state space, and time graphs through synchronized interaction. Built with React, TypeScript, Vite, SVG, and KaTeX. The 3D terrain is a computed surface projected onto SVG; it requires neither WebGL nor an additional rendering library. All calculations run in the browser, with no API or database.

The application interface is currently in Japanese. This document explains its features and development setup in English.

## COGNITIVE DYNAMICS SERIES

All four installments are published. Explore them by topic, or use each Lab's footer to move between apps. The current Lab is highlighted.

| Release | Lab                                                                   | Theorem | Topic                                                  |
| ------- | --------------------------------------------------------------------- | ------- | ------------------------------------------------------ |
| 1       | [LYAPUNOV LAB](https://inthecradle.github.io/lyapunov-lab/)           | 01      | Convergence and stability                              |
| 2       | [EVOLUTION LAB](https://inthecradle.github.io/evolution-lab/)         | 12      | Fitness and evolutionary gradients                     |
| 3       | [HJB LAB](https://inthecradle.github.io/hjb-lab/)                     | 08      | Value landscapes and optimal control                   |
| 4       | [INVERSE LIMIT LAB](https://inthecradle.github.io/inverse-limit-lab/) | 16      | Consistency across abstraction levels and fixed points |

## Getting started

Node.js 24 LTS is recommended (minimum: 22.12). Run these commands from the repository root:

```sh
npm ci
npm run dev
```

Open the local URL shown in the terminal, usually `http://127.0.0.1:5173/`.

## Features and scope

Explore comparison estimates, convergence, and forward invariance related to Theorem 1 through concrete models.

- A 3D grid surface with a central depression and a flat surrounding region, a TCZ boundary, a state point, trajectories, and camera controls (the displayed height compresses V)
- Switching between 3D terrain and 2D contours while preserving time and parameters
- Contours, the TCZ, and vector fields in the 2D view
- Dragging the state point or moving it with arrow keys; adjusting the initial position, threshold, terrain shape, decay rate, and rotation rate
- Play, pause, reset, and a time slider synchronized with the graphs
- A signed residual, a positive-part gauge, tangents, an exponential upper bound, and a V/y display toggle
- Bidirectional highlighting between mathematical symbols and diagrams, with a six-step proof navigated using previous/next buttons
- A default trajectory that enters the TCZ in finite time and then drifts inside, with continuous position and velocity
- Past trajectories and current velocity inside the TCZ, with the entry time marked on the graph
- Intuition, equations, and proof display modes, plus comprehension questions
- Mobile layouts, keyboard controls, and no automatic animation on page load

The three menus are “Comparison estimates” (比較評価), “Break the conditions” (条件を壊す), and “Forward invariance” (前方不変性). Experiments include slower decay, circulation, outward motion, and boundary directions. Proof steps and guarantee indicators change with the selected experiment. LaSalle is not available in the visualization menu; its reference model and numerical tests are retained.

The default “Enter the TCZ and drift” (TCZに入って漂う) combines an approach trajectory satisfying V̇ = −βV outside the TCZ with an interior drift model. Inside, V can rise and fall while remaining at or below θ. Position and velocity are continuous, but the interior trajectory is an additional smooth elliptical construction for this teaching model, not a trajectory derived from the source paper. “Match the upper bound” (上限と一致させる) provides a comparison example that approaches the boundary asymptotically.

Use the navigation at the top to switch between Theorems 1, 2, and 3. See [the Theorem 1 mathematical model](docs/mathematics.en.md) for its equations, assumptions, and references.

### Shared models for Theorems 2 and 3

- Three agents' shared representations in a 2D plane or 3D terrain, with draggable initial positions, arrow-key editing, and numeric controls
- All agents start inside their individual V_i=0 regions, with personal states r=[0.8, −0.6, 0.5]. Their shared representations start at different positions, separating personal comfort from disagreement between agents
- Theorem 2 starts directly with a fixed disagreement-cost terrain Q. It excludes individual costs V_i and should not be used to compare depths with the individual wells. Equal couplings give an exact decomposition of social cost; unequal couplings give a lower bound
- Theorem 3’s 3D view begins with three individual wells on one plane as a labeled conceptual illustration. Play morphs them into a common well over four seconds, then starts convergence. The main view displays A_i, while the popup displays the weighted ηA_i; for η>0, both have their minimum at the LUB. Changes to well centers, widths, and depths are illustrative and do not change the cost functions or forces
- Three agents and their trajectories on one surface. Disconnected groups in Theorem 2 retain their connected component's well; isolated agents stay on the reference plane
- Camera and view changes preserve state and time; initial position edits also update W and the LUB
- Green regions show Q≤θ from the initial state in Theorem 2, and ηAᵢ≤θ_A from model time zero after Theorem 3's intro. These are necessary per-field bounds, distinct from the full composite-cost threshold. Green marks during the intro indicate illustrative valley bottoms, not threshold membership
- During Theorem 3's morph, model time stays at zero and agent coordinates and costs remain unchanged. Pause and resume preserve progress; Skip intro starts convergence, while Replay morph resets model time to zero and restarts the illustration. A slider on the main view freezes any intermediate shape. Explicit playback is not automatically skipped for reduced-motion settings. Theorem 2 has no morph
- Both collective models play at 0.1× speed; chart axes and the main clock show convergence playback seconds, with model time and the four-second introduction shown separately
- Compact layouts (width ≤760px) play inline on the existing graph; desktop layouts open a 3D popup. Resizing to a compact layout preserves model time and playback state. A 3D view also preserves morph progress; a 2D view skips the intro and continues convergence
- The popup supports pausing, resuming, skipping, and replaying Theorem 3's morph. Closing it or pressing Escape pauses playback; reopening resumes from the saved position. Play after the end restarts at time zero, including the intro in Theorem 3's 3D view
- The popup and main view share grid generation, colors, and height compression. The terrain and height transform stay fixed during convergence, while rotation and elevation remain adjustable. Initial outlines and current positions can be compared, with terrain threshold regions and composite-cost membership shown separately. For η=0 in Theorem 3, the popup's ηA_i terrain is flat
- The popup's height comparison uses a fixed linear scale starting at zero. Theorem 2 stacks each agent's initial and current C_i=V_i+Σ_jγ_ijS_ij; the three agents' costs sum to ℒ. Theorem 3 shows initial and current ηAᵢ, the decrease, and the threshold
- A fixed coordinate frame and shared camera for Theorems 2 and 3, with the collective centroid and its trail in yellow. Theorem 2 preserves the centroid; Theorem 3 moves it toward the LUB when η>0
- Presets for individual stability, connected consensus, and disconnected groups
- Individual coupling coefficients γ₁₂, γ₁₃, and γ₂₃; time graphs for V_i, disagreement, and the composite cost ℒ / ℒ_A
- In Theorem 2, changing γ preserves the 3D height reference and cost-chart scale so costs, slopes, and convergence speeds can be compared. Strengthening just one edge can leave the lower-bound terrain Q unchanged; the stacked bars and time graphs show the actual costs
- An additional LUB residual and adjustable abstraction weight in Theorem 3
- Theorem 3 has a separate threshold θ_A, initially 0.03 and adjustable from 0 to 0.3. Theorem 2 retains its own θ, initially 0.1 and adjustable from 0 to 1
- The same initial state and coupling settings retained when switching between Theorems 2 and 3, with time reset to zero
- Separate guarantees for exponential residual decay, global alignment, and convergence to the LUB

Individual state variables are separate from shared representations. Disconnected groups can align internally without reaching global consensus. When every agent has a positive attraction to the same LUB, that target remains reachable even without graph connectivity.

The original cost formulas are separated from the concrete functions and deterministic gradient flow selected for numerical visualization. The ordered double sum counts both directions of each symmetric pair. Threshold convergence is distinguished from convergence to zero. This is not a fitted model of human cognition or a solver for the paper's optimal-control problem. See [the collective mathematics documentation](docs/collective-mathematics.en.md) for equations, analytical solutions, and guarantee conditions. A 3D abstraction hierarchy and stochastic uncertainty are outside this implementation.

## Validation

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

Numerical tests cover comparison estimates, consistency between vector fields and analytical solutions, and invariance. Desktop and mobile end-to-end tests cover synchronization, selecting equations and diagrams, interior initial conditions, playback controls, manual proof-step navigation, guarantee indicators when conditions are broken, TCZ entry, and interior drift. End-to-end tests use the previously built `dist` directory.

For Theorems 2 and 3, tests cover the morph-to-convergence transition, pause/resume, skipping and replaying the intro, restarting after the end, closing and reopening the popup, and transfers from desktop playback to compact 2D and 3D views. Shared terrain-mesh tests check vertex reuse, geometric continuity at the morph endpoint, drawing order, and finite coordinates and colors. `format:check` runs Prettier checks on source code and related files.

## Published site and updates

Live site: [Lyapunov Lab](https://inthecradle.github.io/lyapunov-lab/)

Repository: [inthecradle/lyapunov-lab](https://github.com/inthecradle/lyapunov-lab)

Pushing to `main` runs `.github/workflows/pages.yml`. After numerical tests, the build, and browser tests succeed, the site is deployed automatically to GitHub Pages.

The footer in the published build links to the live sites for all four Labs.

`node_modules`, `dist`, and test output are excluded by `.gitignore`. The deployed artifact is the generated `dist` directory.

The app uses `base: './'` and navigation within a single page, so asset paths do not depend on a specific repository name or custom domain. It does not use SPA routing that changes the URL path and does not rely on a GitHub Pages 404 fallback.

## Source layout

```text
src/model/lyapunov.ts                             Mathematical models and analytical solutions
src/model/collective.ts                           Theorem 2 and 3 models and arbitrary-time solutions
src/model/collectiveTerrainMesh.ts                Shared terrain grid and colors for both views
src/components/CollectiveLab.tsx                  Theorem 2 and 3 settings and view composition
src/hooks/useCollectivePlayback.ts                Intro/model clocks, playback, seeking, and view transitions
src/components/CollectiveTransport.tsx            Theorem 2 and 3 playback controls
src/components/CollectiveStateSpace2D.tsx         Shared representations and initial-position editing
src/components/CollectiveTerrain3D.tsx            Main 3D terrain and introductory morph
src/components/CollectiveTimeGraph.tsx            Potential histories and their components
src/components/CollectivePlaybackDialog.tsx       Desktop playback popup
src/components/CollectivePlaybackTerrain.tsx      Popup 3D terrain
src/components/CollectiveTerrainSurface.tsx       Memoized SVG surface rendering
src/components/CollectivePlaybackHeightChart.tsx  Theorem 3 height comparison
src/components/CollectiveAgentCostChart.tsx       Theorem 2 per-agent cost comparison
src/proof.ts                                      Proof steps for comparison estimates
src/experimentProof.ts                            Proofs and guarantee indicators by experiment
src/components/ExperimentControls.tsx             Experiment and condition selection
src/interaction.ts                                Shared identifiers for equations and diagrams
src/components/StateSpace.tsx                     State-space rendering and interaction
src/components/TimeGraph.tsx                      Time graphs and tangents
src/components/MathToken.tsx                      Interactive mathematical symbols
src/components/ParameterControls.tsx              Parameter controls
src/App.tsx                                       Playback and learning-step coordination
```

Theorem 1 retains its single-agent types and rendering. Theorems 2 and 3 use a separate model and view with the same selection, playback, and seeking interaction pattern. Their analytical solutions are evaluated at arbitrary times, avoiding accumulated integration errors when seeking backward.

`collectiveTerrainMesh.ts` centralizes grid generation and colors for the main view and popup. Each of the 41×41 vertices shared by the 40×40 patches is evaluated and projected once, reducing vertex evaluations from 6,400 to 1,681. `CollectiveTerrainSurface.tsx` memoizes the rendered surface so agent and trajectory updates during convergence do not repeat rendering work for the fixed grid. These are display-only changes; model costs, forces, and analytical solutions are unchanged.

`useCollectivePlayback.ts` owns the separate introduction and convergence clocks, animation cancellation, and playback behavior across 2D/3D views and viewport sizes. Compact 2D playback proceeds without waiting for an invisible introduction.

## Shared series design

The header and footer are defined in `src/components/SeriesChrome.tsx` and `series-chrome.css`. Keep `SeriesChrome.tsx` identical across the three React apps: LYAPUNOV LAB, EVOLUTION LAB, and INVERSE LIMIT LAB. Keep `series-chrome.css` identical across all four Labs, including the static HTML app HJB LAB. Each app builds independently; synchronize all applicable copies when changing the shared design.
