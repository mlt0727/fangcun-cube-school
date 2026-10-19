# Fangcun · Learn to Solve a Cube, Step by Step

A Chinese-language learning website for 3×3 and 4×4 cubes, built with HTML, CSS, and vanilla JavaScript. No dependency installation, API keys, backend, or database are required. It can be deployed under a repository subpath on GitHub Pages.

Live site: [Fangcun Cube School](https://mlt0727.github.io/fangcun-cube-school/)

Source: [mlt0727/fangcun-cube-school](https://github.com/mlt0727/fangcun-cube-school)

## Run locally

Install Node.js 24 or newer, then run the following in the project directory:

~~~sh
npm start
~~~

Open the local address printed in the terminal; the default is `http://127.0.0.1:4173`. Use the HTTP address instead of opening the HTML file directly, because browsers restrict ES modules and Workers on file URLs.

~~~sh
npm test
npm run build
npm run benchmark
~~~

Build output is written to `dist/`. The application loads no CDNs, remote scripts, or fonts at runtime.

## Use the site

1. Choose a 3×3 or 4×4 cube. A valid scrambled example is shown by default.
2. To enter a physical cube, select **Clear coloring**, choose a color, and paint each sticker. For 3×3, keep white on top, green in front, and red on the right. For 4×4, choose one fixed orientation and enter the faces relative to the top, front, and right; white on top, green in front, and red on the right is the solved target. The beginner guide explains how to orient the other faces during entry. The 3×3 centers cannot be edited.
3. Select **Start learning**. The program checks color counts, piece combinations, and corner twists. It also checks edge flips and permutation parity for 3×3, and wing-edge colors and handedness for 4×4. Invalid states do not produce a solution.
4. Read the goal and explanation for the current move group, then select **Next step** repeatedly or play the animation. Controls support pausing mid-turn, precise backward stepping, replaying the current algorithm, returning to the first step, seeking through progress, changing speed, and dragging to inspect the cube.
5. The **Complete lesson list** below the player contains a Chinese explanation of every algorithm group and every turn. It can also be downloaded as text.

The interface uses Chinese; the control names above are English translations. Lessons solve the yellow layer first while keeping the white-up, green-front reference fixed. Changing the viewing angle does not change the faces referenced by an algorithm. Colors are saved in the device's localStorage; clearing browser data removes them. Lesson progress is not saved across page reloads.

## Teaching algorithms

The 3×3 solver uses a seven-stage layer-by-layer method: bottom cross → bottom corners → middle edges → top cross → top-edge permutation → top-corner permutation → top-corner orientation. Each stage searches only the limited set of target-piece positions using the basic turns or algorithms allowed for that stage. Later algorithms preserve completed stages. It does not take a globally shortest solution and label portions as teaching stages.

The 4×4 solver first **builds centers by color, then pairs the twelve edges**. Centers are completed in white, yellow, green, blue, and red order; the orange face follows automatically. The search tracks only the four centers of the current color, using outer-layer alignment and short inner-turn/setup/undo-inner-turn sequences while preserving completed center faces. Centers of the same color have no individual identities. Edge pairing uses pure three-wing cycles to place matching wings next to one another. Paired edges do not have to reach their final positions, and already paired edges remain paired. Each pairing algorithm consists of setup moves, an eight-move cycle, and undoing the setup; centers and previously paired edges are guaranteed to be restored only at the end of the complete group. An already reduced state goes directly to the 3×3 lesson.

After reduction, the solver checks the actual state for edge-flip (OLL) and edge-swap (PLL) parity, applies only the special algorithms needed, and then reuses the seven-stage 3×3 lesson. Solutions are not globally shortest. Every actual turn retains a Chinese explanation and animation, and each stage shows its move count.

`npm run benchmark` uses seed `20261017` to generate 30 independent 4×4 states, each scrambled with 35 moves, and replays every solution in full. The comparison before and after the 2026-10-17 correction was:

| Stage | Mean moves before | Mean moves after |
| --- | ---: | ---: |
| Centers | 286.0 | 28.2 |
| Edge pairing | 287.9 | 69.3 |
| Parity correction | 3.8 | 11.2 |
| 3×3 layer-by-layer method | 119.7 | 126.1 |
| Total | 697.4 | 234.7 |

The updated samples took 162–278 moves in total. Each algorithm symbol counts as one move, including a 180° turn or a wide turn. This sample range is not an upper bound for all states. Regression tests check move counts, the final solved state, and preservation of completed work during edge pairing. An input consisting of a single `R` now takes one move instead of 149; a single `2R` also takes one move.

The solvers support ordinary six-color cubes without pictures. Same-color 4×4 centers are interchangeable; independently oriented picture centers are outside the scope. The net defines the color scheme. Other physical color schemes require adjusting the color mapping to match corner relationships; custom color schemes are not currently supported.

Both solvers accept only color arrays and require no scramble history. Every generated solution is replayed in full on the sticker-turn model and passed to the interface only after all six faces are verified as solved. A state snapshot for every turn supports backward stepping and replay. Solving runs in a Web Worker; editing colors or switching cube sizes cancels stale calculations and animations.

References: [J Perm's beginner 3×3 method](https://jperm.net/3x3) and [J Perm's 4×4 reduction and special cases](https://jperm.net/4x4). The wing algorithm `2R U 2R' D 2R U' 2R' D'` combines with conjugating setup moves to cycle three wings; its local effect is checked by the geometric model. The OLL algorithm comes from the linked 4×4 tutorial, with the whole-cube `x` rotation expanded into the equivalent `Rw Lw'` and adjacent turns merged to preserve the fixed reference orientation. The build assigns a shared content version to all modules and Worker dependencies so stale caches do not keep running older algorithms.

## Deploy to GitHub Pages

1. Upload this directory to your GitHub repository with `main` as the default branch.
2. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
3. Push to `main` or manually run **Deploy to GitHub Pages** in Actions.

The workflow runs tests and builds the static site before publishing `dist/`. The deployment environment in the workflow shows the published URL. Pages requires the appropriate repository and account permissions; preparing a local project does not itself publish the website.

## Files

- `src/cube.js`: turns and actual-state validation for 3×3 and 4×4 cubes.
- `src/solver.js`: 3×3 layer-by-layer teaching and integration with the 4×4 flow.
- `src/reduction.js`: 4×4 center building by color, wing pairing, special parity cases, and reduction.
- `src/timeline.js`: individual turns, Chinese explanations, and state snapshots.
- `src/app.js`: coloring, CSS 3D animation, playback controls, and the complete lesson list.
- `tests/`: geometric invariants, invalid states, randomized layer-by-layer verification, and timeline checks.
