# Visualization Models for Theorems 2 and 3

[日本語](collective-mathematics.md) | English

## Correspondence with the source

The references are Theorems 2 and 3, assumptions A5 and A6, and Appendices A.3 and A.4 of Hideto Tomabechi's _Five Theorems of Evolution_ (進化の5定理), Japanese edition dated July 12, 2026.

- [Original source (Japanese)](https://tomabechi.jp/TomabechiEvolution5theoremsJA.html)

The source's policy formulation minimizes the integral of the individual cost V_i and Σ_j γ_ij S_ij in Theorem 2. Theorem 3 additionally includes η_i A and minimizes the expectation of the resulting integral. The expectation addresses epistemic uncertainty about the location of the LUB. The app displays these policy formulations separately from the concrete functions used in its calculations.

The composite costs from the appendices are displayed using the source's notation:

```text
ℒ(x,t)   = Σ_i V_i(x_i,t) + Σ_{i,j} γ_ij S_ij(x_i,x_j)
ℒ_A(x,t) = Σ_i V_i(x_i,t) + Σ_{i,j} γ_ij S_ij(x_i,x_j) + η A(x)
```

V_i is not replaced by R_i, and the pair-specific coefficients γ_ij are not moved outside the sum. No additional force κ toward individual targets is introduced.

The source does not uniquely specify the concrete functions or vector fields below. This implementation is a fixed three-agent example that makes the source's cost terms numerical. It does not solve the source's argmin problem to obtain an optimal policy, and it does not verify all of the source's assumptions.

## States and functions chosen for the numerical model

Agent i has state x_i=(r_i,z_i), where r_i∈ℝ and z_i∈[0,1]². Its abstraction map is φ_i(x_i)=z_i. The comparison concerns the images of these maps rather than the full states. With the interval I=[−1,1] for the individual variable, the model uses the following nonnegative C¹ functions:

```text
V_i(x_i) = ½ dist(r_i,I)²
S_ij(x_i,x_j) = ½ ||z_i−z_j||²
A_i(x_i) = ½ ||z_i−L||²
A(x) = Σ_i A_i(x_i)
```

I is the interval of individual-variable values for which V_i=0 in this concrete model. It differs from the collective Shared-TCZ threshold set. Different r_i values inside the interval are retained; agreement between representations does not mean that the full states become identical.

The defaults are r(0)=[0.8, −0.6, 0.5], so all agents start inside their individual V_i=0 regions. Their shared representations differ: z_1(0)=(0.8,0.2), z_2(0)=(0.2,0.8), and z_3(0)=(0.35,0.35). With the default couplings γ_ij=0.8, the initial sum of individual costs is zero and the disagreement cost is 0.936. Theorem 2's composite cost ℒ(0)=0.936 exceeds its threshold θ=0.1. This illustrates that individual comfort does not necessarily satisfy the collective sharing condition. Individual states retain their initial values during playback. Decay from outside the individual region is tested separately with explicitly chosen initial conditions.

The fixed worlds W_i∈[0,1]² use the componentwise order:

```text
u ≼ v ⇔ u₁≤v₁ and u₂≤v₂
L = LUB(W₁,W₂,W₃) = (max_i W_i₁, max_i W_i₂)
```

L is an upper bound of every W_i, and L≼U for every common upper bound U. For example, the LUB of (0.8,0.2) and (0.2,0.8) is (0.8,0.8). Their mean (0.5,0.5) is not an upper bound; (1,1) is an upper bound but is not the least one. This numerical order is an illustrative construction, not an empirical measure of human abstraction levels.

The LUB is known and fixed. The expectation is evaluated in the case with no uncertainty; this is not a general justification for removing the source's expectation operator.

Editing an agent's initial condition sets its initial representation z_i(0) and world W_i to the same coordinates. Dragging, arrow keys, and numerical inputs all update both, recompute the LUB, and reset time to zero. This sets up an experiment; it does not assume that W_i moves during playback. W_i and the LUB remain fixed when calculating each trajectory.

## Coupling coefficients and the double sum

The implementation's gamma=[γ₁₂,γ₁₃,γ₂₃] contains nonnegative symmetric coefficients: γ_ji=γ_ij, S_ji=S_ij, and S_ii=0. The source's Σ_{i,j} counts both directions, so the calculation is:

```text
Σ_{i,j} γ_ij S_ij = 2 Σ_{i<j} γ_ij S_ij
```

Each slider sets γ_ij itself. There is no reinterpretation as counting each undirected edge once, and no hidden factor of 1/2.

In the API, `individual` is ΣV_i, `social` is Σijγ_ijS_ij, `abstraction` is η_eff A, and `total` is the composite cost. Theorem 2 uses η_eff=0; Theorem 3 uses η_eff=η. `pairCosts` contains S_ij before weighting, `personalCosts` contains V_i, and `abstractionCosts` contains A_i.

Disagreement can still be measured between uncoupled agents, so `disagreement`=max_{i<j}||z_i−z_j|| is displayed separately from the weighted cost `social`. The model also measures `targetDistance`=max_i||z_i−L||, including when η=0.

## Chosen vector field and dissipation

The deterministic closed loop below uses the negative gradient of the composite cost as velocity. This is a choice for numerical visualization, not a solution for the source's optimal policy.

```text
ṙ_i = −(r_i−clip_I(r_i))
ż_i = −2 Σ_j γ_ij(z_i−z_j) − η_eff(z_i−L)
ℒ̇ (or ℒ̇_A) = −Σ_i dist(r_i,I)² − Σ_i ||∇_{z_i}ℒ (or ℒ_A)||² ≤ 0
```

The factor 2 in the velocity comes from differentiating the symmetric double sum. Individual variables starting outside I approach its boundary asymptotically; exact arrival at the boundary in finite time generally does not occur. The square containing z is forward invariant. Trajectories are not clipped back into the square during rendering.

## Threshold sets and the source's conclusions

For the composite cost F=ℒ or ℒ_A, the source considers the following comparison inequality outside the threshold set Ω_θ={x:F≤θ}, using θ_A for Theorem 3:

```text
Ḟ ≤ −α(F−θ)
(F(t)−θ)₊ ≤ (F(0)−θ)₊ exp(−αt)
F(t) ≤ θ + (F(0)−θ)₊ exp(−αt)
```

Approaching a set with θ>0 alone does not imply that disagreement or the abstraction residual converges exactly to zero. Inside the set, the bounds are S_ij≤θ/γ_min for positive couplings and A≤θ_A/η in Theorem 3 when η>0. The source's discussion of zero disagreement involves taking the threshold toward zero or imposing additional regularity conditions.

The app displays the threshold line, a comparison upper bound for F, and the positive-part residual (F−θ)₊. `thresholdReached` means F≤θ; it does not test S_ij=0 or A=0. Changing θ does not alter this concrete model's vector field or trajectories.

This concrete model satisfies the stronger inequality Ḟ≤−αF. Let L_γ be the coupling graph Laplacian, H=2L_γ+η_eff I₃, and Λ₊ the set of positive eigenvalues of H. The model uses α=2 min({1}∪Λ₊). Zero-eigenvalue directions carry no cost, so they are excluded from the minimum. If H=0, α=2.

In the API, `bound` is the threshold-based upper bound on the total cost shown above, `residual` is (F−θ)₊, and `residualBound` is its exponential upper bound. The concrete model enters every positive-threshold sublevel set in finite time, but finite-time arrival is not claimed from the source's threshold-based inequality alone.

## Source assumptions and convergence targets of the concrete model

Assumption A5 in the source requires a connected coupling graph and a uniform positive lower bound on coupling strengths. The disconnected setting is a comparison experiment that removes this assumption. Setting η=0 in Theorem 3 also provides a comparison by removing the abstraction term; it is different from eliminating uncertainty.

The convergence targets of this symmetric gradient flow are:

- η_eff=0, connected graph: all representations converge to the arithmetic mean of the initial representations. This mean is not called the LUB.
- η_eff=0, disconnected graph: each connected component converges to its own initial mean. Disagreement between components may remain even when F→0.
- η_eff=0, all γ=0: representations stay at their initial positions.
- η_eff>0: this concrete model attracts every agent to the same known L, so all representations converge to L even when the graph is disconnected. This does not remove the source's connectivity assumption.

Exact convergence to these means or to the LUB follows from the particular functions and vector field chosen here. The same trajectories are not determined by the source's general policy formulation alone. In `collectiveGuarantees`, `connected` describes connectivity of the graph formed by positive γ values; `alignment` and `lub` report convergence properties of this concrete model.

## Evaluation at arbitrary times and validation

The individual variable is evaluated as r_i(t)=clip_I(r_i(0))+(r_i(0)−clip_I(r_i(0)))exp(−t). Representations follow ż=−Hz+η_eff L, decomposed into the mean direction and its orthogonal complement, with exponential evolution of the symmetric matrix's eigenmodes. `expm1` reduces cancellation errors for small exponents. There is no accumulated time-integration error, so seeking backward reproduces the same state at the same time.

Unit tests independently enumerate all nine ordered pairs in the double sum and check the vector field's factor 2, cost derivatives, bounds for unequal couplings and disconnected graphs, comparisons inside and outside the threshold, invariance of trajectories under changes to θ, and the distinction between means and the LUB. Browser tests cover individual coefficient controls, displayed values, the distinction between threshold membership and disagreement, playback, backward seeking, and theorem switching.

Display tests check reuse of shared vertices, geometric agreement between the morph endpoint and the cost terrain, depth ordering, finite coordinates and colors during the morph, and the transition to a plane when there is no target well. Browser tests also verify that model time and costs remain unchanged during the intro, pause/resume, skipping and replaying the intro, restarting after the end, reopening the popup, and transfers from desktop playback to compact 2D and 3D views.

The scope is three fixed agents, fixed worlds, nonnegative symmetric couplings, a known LUB, and deterministic dynamics. Distributions of epistemic uncertainty, a dynamic LUB, asymmetric couplings, general lattices of semantic worlds, and HJB-based optimal-policy solutions are not implemented. Parameter changes start a trajectory under the new fixed conditions at time zero.

## 3D terrain and the source's well illustrations

Following the source's illustration connecting Theorems 1, 2, and 3, the app uses the same surrounding plane and central depression as Theorem 1, placing all three agents and their trajectories on one surface. The state remains two-dimensional; the vertical direction displays cost. The initial view is 3D.

### Theorem 2: a fixed disagreement-cost terrain Q

Let L_γ be the coupling graph Laplacian, m₀ the arithmetic mean of the initial representations, and λ₂ the second-smallest eigenvalue of L_γ. The symmetric Theorem 2 model preserves the mean. Its social cost satisfies:

```text
social = Σ_{i,j} γ_ij S_ij = Σ_{i<j} γ_ij ||z_i−z_j||²
Q(q) = λ₂ ||q−m₀||²
Σ_i Q(z_i) ≤ social
```

If all three coupling coefficients equal γ, then λ₂=3γ and equality holds. Q then gives an exact decomposition of social cost into a common well. At the default γ=.8, λ₂=2.4. Unequal couplings are explicitly labeled as displaying a lower bound on social cost. The time graph shows the actual `social` cost and composite cost ℒ.

Theorem 2 displays its fixed disagreement-cost terrain Q immediately. It has no introduction in which individual wells merge and become deeper. Q excludes the individual costs V_i, so its depth should not be compared with the individual wells. Q is a display quantity; it is not added to the control policy or vector field. The source does not designate an absolute mean position as a well bottom. This display uses preservation of the initial mean in the concrete symmetric-coupling model. Under unequal couplings, an individual agent's height need not decrease at every instant.

For disconnected graphs, wells are determined per connected component. In the “03 Split the group” preset (03 集団を分断), agents 1 and 2 share the well Q₁₂(q)=2γ₁₂||q−m₁₂||² centered at their initial mean m₁₂. Q₁₂(z₁)+Q₁₂(z₂) equals the original social cost of that pair. Isolated agent 3 has zero displayed cost and is placed on the surrounding reference plane to show that the well does not attract it. The surface has no wells only when all couplings are zero. This is a display distinction; no cost or force is added to an isolated agent.

### Theorem 3: a common abstraction potential with its minimum at the LUB

All three agents are placed in one well using the existing A_i(q)=½||q−LUB||². Its minimum is A_i=0 at the LUB. This is separate from the full composite cost ℒ_A, which is shown in the time graph. A_i remains defined when η=0, but the vector field then has no attraction toward the LUB.

The main view displays A_i, while the popup displays the weighted ηA_i. For η>0, both have their minimum at the same LUB. For η=0, the main view retains the A_i well and the popup's ηA_i is zero everywhere, producing a flat plane. The displayed cost must be distinguished from height normalization; visual well depth should not be used to compare cost magnitudes as η changes.

### Height compression shared with Theorem 1

The vertical direction uses the same `compressedHeight` as Theorem 1:

```text
display height = −210 max(0, 1 − cost/(.85 M))³
```

M is a constant controlling the displayed range. This transform depicts low costs as a depression that joins a flat plane smoothly in the distance. A negative display height does not mean a negative cost. After the introduction, numerical labels and `data-height` retain the original nonnegative costs, distinct from compressed display heights. During the illustrative intro, agents' terrain markers omit `data-height` and use `data-display-height` for their drawn heights. The upper reference plane is not the zero-cost plane.

Theorem 2 uses M=2.4R²/1.12², where R is the fixed drawing radius. The height reference therefore stays unchanged when γ changes. The value 2.4 is the second-smallest eigenvalue at the default equal couplings γ=0.8. The actual coefficient λ₂ in Q is recomputed from the updated γ values, so normalization does not cancel differences in γ. Under unequal couplings, strengthening a particular edge can leave λ₂ unchanged. For example, both γ=[0.8,0.8,0.8] and [2,0.8,0.8] have λ₂=2.4, although actual disagreement costs and trajectories change. Q as a lower bound is kept distinct from each agent's actual cost.

Changing the camera, selecting an agent, or switching between 2D and 3D does not alter the calculations or the meaning of the terrain. Editing initial positions updates W_i and the LUB and resets time to zero. Depressions and contours should not be equated with the full collective-cost threshold set. No additional force, negative cost, or new potential well is introduced to reproduce the depth of the source's conceptual illustration.

### Terrain rendering in the main view and popup

[collectiveTerrainMesh.ts](../src/model/collectiveTerrainMesh.ts) centralizes grid generation, colors, and depth sorting. Each of the 41×41 vertices shared by the 40×40 patches is evaluated and projected once. This reduces vertex evaluations from 6,400, when every patch calculated its own four corners, to 1,681. Adjacent patches share the same vertices. Cost terrains and the illustrative introduction use the same projection while retaining separate height calculations.

[CollectiveTerrainSurface.tsx](../src/components/CollectiveTerrainSurface.tsx) centralizes and memoizes SVG surface rendering. Agent and trajectory updates during convergence do not repeat rendering work for the fixed grid; changes to morph progress, viewpoint, or settings update it. These display-only calculations are not passed to the cost functions, vector field, or analytical solution. Threshold regions are computed separately from the illustrative surface, using the actual cost terms, and appear after the intro is complete.

### Theorem 3's introduction: from individual wells to a common well

The following introduction is used only for Theorem 3. In Theorem 2, `introProgress` always equals 1. The fixed Q terrain is shown on initial load and after resets, position edits, coefficient changes, backward seeking, returning from 2D to 3D, and theorem switching. Theorem 2 has no intro slider, replay button, or skip button.

The initial Theorem 3 view places three shallow wells on one plane, centered at the agents' initial positions. The main Play button (再生) continuously changes the centers, widths, and depths over four seconds until they form the existing common terrain. Convergence begins after the intro finishes. Pausing and resuming preserve intermediate progress, and the popup also provides Skip intro (導入をスキップ) and Replay morph (変形を最初から再生). Compact layouts, with width ≤760px, play on the existing graph; desktop layouts play in a popup. Individual variables r_i and shared representations z_i are separate, so these three wells are not the cost functions V_i plotted over the z plane. They are explicitly labeled as a conceptual illustration.

Each illustrative well starts at display height −120 max(0, 1−||q−z_i(0)||²/.55²)³. The surface is their pointwise minimum; overlapping wells do not add their depths. When a common well exists, smoothstep progress moves each center toward the LUB, changes the radius toward √(.85M/coefficient), and changes the depth from 120 to 210. At the endpoint, the three centers coincide and the shape matches the original `compressedHeight`. In the popup with η=0, there is no common well: individual well centers and radii stay fixed while their depths decrease from 120 to zero, joining a flat plane. This function is used only for drawing; it is not passed to costs, vector fields, or gradients. Model time stays at zero throughout the intro, with agent coordinates and composite cost unchanged. Playback of the existing analytical solution begins afterward.

Initial green marks indicate the bottoms of the individual wells, not a set below θ. After Theorem 3's intro, the actual ηA_i≤θ_A region is displayed from model time zero. Theorem 2 shows Q≤θ from the initial state without an intro. Skipping the initial illustration changes neither coordinates, costs, nor model time.

Theorem 3's intro supports pause/resume. Replay morph resets model time to zero and starts the intro again. The dedicated slider on the main view resets model time to zero, stops playback, and shows any shape from 0% to 100%. Resets, initial-position edits, coefficient changes, and theorem switching return the intro to the beginning. Seeking to a positive model time or switching to 2D marks the intro as complete. Returning from 2D to 3D at time zero restores the beginning of the intro. Since playback begins through user action, reduced-motion OS settings do not automatically skip an explicitly played introduction; Skip intro provides manual control. The abstraction potential's minimum is at the LUB regardless of coupling disconnections.

### Model time and convergence playback time

Both theorems play convergence at 0.1× speed. For convergence playback time s in seconds, the model time passed to the analytical solution is t=0.1s. The main clock and graph's horizontal axis use s, with t shown separately. Model t=1 corresponds to ten seconds of convergence playback. Theorem 3's four-second intro is excluded from convergence playback time and has its own elapsed-time display.

Costs, analytical solutions, derivatives with respect to model time, and exponential estimates retain their original formulas. Forces and coefficients are not weakened; only playback speed and the horizontal-axis time unit change. The graph displays predicted curves for the full interval in advance, with a vertical cursor marking the current playback position.

[useCollectivePlayback.ts](../src/hooks/useCollectivePlayback.ts) owns the intro and convergence clocks, animation cancellation and resumption, and behavior across view modes and viewport sizes. Closing the popup or pressing Escape pauses playback while preserving time and morph progress. The next Play resumes from that position. Playback stops at the final model time of 12; the next Play starts at zero. In Theorem 3's 3D view, it also replays the intro from the beginning.

Resizing a desktop playback session to width ≤760px closes the popup and transfers playback to the main view. A 3D view preserves morph progress. A transfer to 2D marks the now-invisible intro as complete, preserving model time and playback state while continuing convergence. Starting compact 2D playback at time zero also avoids waiting for the four-second intro.

### Comparing costs in the popup

The 3D popup opened by desktop Play uses the same grid, colors, and height compression as the main view, keeping the terrain and height transform fixed during convergence. During Theorem 3's intro, the illustrative wells morph within that coordinate frame and height transform. Rotation, elevation, the display of necessary threshold bounds, and initial-position outlines are supported. Theorem 2's 3D view shows only Q, so costs including individual terms are compared in a separate stacked chart.

```text
C_i(t) = V_i(x_i(t)) + Σ_j γ_ij S_ij(x_i(t),x_j(t))
Σ_i C_i(t) = ℒ(t)
C_i(t) ≥ V_i(x_i(t))
```

For Theorem 2, each agent has adjacent initial and current bars stacking nonnegative segments for its individual cost V_i and disagreement cost Σ_jγ_ijS_ij. Each agent is assigned one direction of each interaction, matching the original double sum; summing across agents recovers the social cost. Isolated agents have zero interaction cost but retain V_i. All agents and both initial and current values use the same zero baseline and a linear scale fixed during playback. Adding disagreement cost therefore never places a bar below the individual cost of the same state. This does not guarantee an ordering between C_i values at different times.

The stacked chart and main time graph use the initial composite cost with every edge set to γ=2, the slider maximum, as their upper reference. With the same initial positions, individual states, and θ, the vertical scale stays fixed as γ varies between 0 and 2. In this model, the composite cost does not exceed its initial value and every cost term is nonnegative, so each agent's cost remains within this scale over the entire interval. If tests or other callers pass γ>2, the largest supplied coefficient is used for the envelope instead.

Theorem 3's comparison chart retains initial and current ηA_i, the decrease, and the threshold, separately from the full composite cost ℒ_A. Closing the popup or pressing Escape pauses playback.

### Shared coordinate frame and collective centroid

Theorem 2 and 3 terrains share a coordinate frame centered at (0.5,0.5) with radius 1. The camera does not automatically recenter on the well bottom, and rotation and elevation are retained when switching theorems. Projection scale and screen position depend on the viewing angles and fixed frame, not on well location, coupling coefficients, or theorem. Vertical costs use the existing compressed display, so visual well depth is not a basis for comparing cost magnitudes.

The yellow diamond marks the arithmetic mean m(t)=Σᵢzᵢ(t)/3 of all three agents' representations. The yellow dashed line traces this centroid using the same analytical solution. Both are projected onto the reference plane; the centroid's display height is not treated as a cost. Dotted lines connecting a well bottom to the reference plane are also positional guides.

Couplings are symmetric in this concrete model, so the forces between agents sum to zero. In Theorem 2, ṁ=0 and the overall three-agent centroid is preserved even for disconnected graphs. In Theorem 3, ṁ=−η(m−LUB) and m(t)=LUB+(m(0)−LUB)e^(−ηt). For η=0, the centroid is preserved. The centroid, trails, and guide lines are observational displays; they add no force or cost.

### Overlaying threshold regions on the terrain

Theorem 3's θ_A starts at 0.03, with a slider range of 0 to 0.3 in increments of 0.01. Theorem 2 retains θ, initially 0.1 with a range of 0 to 1. Each setting is preserved separately when switching theorems. These UI limits are not imposed on the numerical model's `theta` parameter itself.

Green regions are sublevel regions of the cost term displayed by the terrain. The well bottom has zero cost, so the completed cost terrain shows these regions from model time zero. They are not the full collective composite-cost threshold set.

- Theorem 2: Q(q)≤θ for the selected agent's connected component, centered at that component's initial mean with radius √(θ/λ₂). For a two-agent component, λ₂=2γ. Nonnegativity of the terms and the lower bound on social cost imply that ℒ≤θ requires Q(zᵢ)≤θ.
- Theorem 3: ηAᵢ(q)≤θ_A. For η>0, the region is centered at the LUB with radius √(2θ_A/η). The main terrain displays Aᵢ and the popup displays ηAᵢ, but both shade the same threshold region. The main view tests Aᵢ≤θ_A/η, retaining the factor η from the composite cost.

Regions are clipped to the state domain [0,1]². At θ=0, the well bottom is shown as a point. An isolated Theorem 2 agent has Q=0, so the entire reference-plane domain is shaded. In Theorem 3 with η=0, the abstraction term imposes no positional restriction, so the entire terrain domain is green.

These are necessary conditions for the composite cost to lie below the threshold; entering a green region alone is insufficient. Actual ℒ≤θ or ℒ_A≤θ_A membership is checked separately in the time graph and `thresholdReached`. Playback does not change the green regions; they respond to changes in θ, couplings, initial positions, worlds, and other settings. These are display changes, with no additional terms in the costs or vector field.
