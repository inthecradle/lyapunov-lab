# LYAPUNOV LAB

[日本語](README.md) | English

An educational web app for exploring equations, state space, and time graphs through synchronized interaction. Built with React, TypeScript, Vite, SVG, and KaTeX. The 3D terrain is a computed surface projected onto SVG; it requires neither WebGL nor an additional rendering library. All calculations run in the browser, with no API or database.

The application interface is currently in Japanese. This document explains its features and development setup in English.

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
- Bidirectional highlighting between mathematical symbols and diagrams, with a six-step proof playback
- A default trajectory that enters the TCZ in finite time and then drifts inside, with continuous position and velocity
- Past trajectories and current velocity inside the TCZ, with the entry time marked on the graph
- Intuition, equations, and proof display modes, plus comprehension questions
- Mobile layouts, keyboard controls, and no automatic animation on page load

The three menus are “Comparison estimates” (比較評価), “Break the conditions” (条件を壊す), and “Forward invariance” (前方不変性). Experiments include slower decay, circulation, outward motion, and boundary directions. Proof steps and guarantee indicators change with the selected experiment. LaSalle is not available in the visualization menu; its reference model and numerical tests are retained.

The default “Enter the TCZ and drift” (TCZに入って漂う) combines an approach trajectory satisfying V̇ = −βV outside the TCZ with an interior drift model. Inside, V can rise and fall while remaining at or below θ. Position and velocity are continuous, but the interior trajectory is an additional smooth elliptical construction for this teaching model, not a trajectory derived from the source paper. “Match the upper bound” (上限と一致させる) provides a comparison example that approaches the boundary asymptotically.

Simulations for Theorems 2 and 3 are not implemented. Their entries at the bottom of the page indicate planned extensions. See [the mathematical model](docs/mathematics.en.md) for the equations, assumptions, and references.

## Validation

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Numerical tests cover comparison estimates, consistency between vector fields and analytical solutions, and invariance. Desktop and mobile end-to-end tests cover synchronization, selecting equations and diagrams, interior initial conditions, playback controls, complete proof playback, guarantee indicators when conditions are broken, TCZ entry, and interior drift. End-to-end tests use the previously built `dist` directory.

## Published site and updates

Live site: [Lyapunov Lab](https://inthecradle.github.io/lyapunov-lab/)

Repository: [inthecradle/lyapunov-lab](https://github.com/inthecradle/lyapunov-lab)

Pushing to `main` runs `.github/workflows/pages.yml`. After numerical tests, the build, and browser tests succeed, the site is deployed automatically to GitHub Pages.

`node_modules`, `dist`, and test output are excluded by `.gitignore`. The deployed artifact is the generated `dist` directory.

The app uses `base: './'` and navigation within a single page, so asset paths do not depend on a specific repository name or custom domain. It does not use SPA routing that changes the URL path and does not rely on a GitHub Pages 404 fallback.

## Source layout

```text
src/model/lyapunov.ts         Mathematical models and analytical solutions
src/proof.ts                 Proof steps for comparison estimates
src/experimentProof.ts       Proofs and guarantee indicators by experiment
src/components/ExperimentControls  Experiment and condition selection
src/interaction.ts           Shared identifiers for equations and diagrams
src/components/StateSpace    State-space rendering and interaction
src/components/TimeGraph     Time graphs and tangents
src/components/MathToken     Interactive mathematical symbols
src/components/ParameterControls  Parameter controls
src/App.tsx                  Playback and learning-step coordination
```

The structure supports future Theorem 2 and 3 models and proof steps, reusing selection and playback controls through shared identifiers. The initial types are designed for a single-agent, two-dimensional model.
