# Mathematical Models in Lyapunov Lab

[日本語](mathematics.md) | English

This app is an educational model for exploring Lyapunov-type comparison estimates associated with Theorem 1. The quadratic function and vector fields used here are concrete examples chosen for this implementation. They do not imply that Dr. Hideto Tomabechi describes human cognition through these two-dimensional equations. The app does not compute numerical solutions to an optimal control problem or generate a proof of Theorem 1 in its entirety.

The comparison experiment initially uses `drift`: a trajectory enters the TCZ in finite time, then drifts inside while retaining its velocity at the transition. The earlier `normal` model remains available as a separate model. For type compatibility, parameters that omit `dynamics` are still interpreted as `normal`, while the app's `DEFAULT_PARAMETERS` explicitly select `drift`.

## References

- Hideto Tomabechi, _A Unified Theory of Latent Potentials: Homeostasis and Cognitive Warfare_, public edition ([Japanese public PDF, 潜在ポテンシャル統一理論：認知ホメオスタシスと認知戦](https://tomabechi.jp/TomabechiNDUpaperJApublic.pdf)), §§2.7–2.10 (TCZ and Theorem 1).
- Hideto Tomabechi, [認知潜在ポテンシャル自由エネルギー理論](https://tomabechi.jp/CognitiveLatentPotentialFreeEnergyTheoryJA.html) (Japanese; _Cognitive Latent Potential Free Energy Theory_), §§2.1–2.2 (positive part and unified convergence lemma), §§3.1–3.3 (the setting of Theorem 1, descent conditions, and error bounds).

The theorems in these references include reachability and control policies. This implementation does not reproduce all of those components. It uses a static sublevel set Ωθ as a visualization model of the TCZ. This document distinguishes the conditions in the references from the concrete models added for this educational app.

## Potential and state evolution in the earlier `normal` model

Until the section “Finite-time entry and internal drift,” references to the “normal mode” in discussions of trajectories, comparison, and entry mean the earlier `normal` model. The internal behavior of the current default, `drift`, is described separately.

Let the state be p=(x,y) and the shape parameter be b=`stretch`. Define

```text
V(p) = x² + b y²,   b > 0
Ωθ = {p | V(p) ≤ θ},   θ ≥ 0.25
β = α(1 + δ),   α > 0,   δ = extraDecay ≥ 0
q = (x, √b y)
```

Ωθ is an ellipse, or a circle when b=1. With rotation rate ω=`rotation` and the 90-degree rotation J(q₁,q₂)=(-q₂,q₁), the vector field is

```text
q̇ = -β (V-θ)/(2V) q + ωJq   (V > θ)
q̇ = ωJq                     (V ≤ θ)
```

At the origin, q̇=0. The damping term goes continuously to zero at the boundary, and θ>0 means that no division occurs near the origin. This field is locally Lipschitz continuous. Since V decreases outside and remains constant inside, trajectories stay bounded and solutions extend to all t≥0. Rotation along the ellipses does not change V.

The app evaluates the following analytic solution rather than using a step-size-dependent approximation such as Euler integration. Moving the time slider back and forth therefore does not accumulate integration error.

```text
V(t) = θ + (V(0)-θ) exp(-βt)   (V(0)>θ)
V(t) = V(0)                   (V(0)≤θ)
q(t) = √(V(t)/V(0)) R(ωt) q(0) (V(0)>0)
q(t) = 0                      (V(0)=0)
```

R is the usual rotation matrix. Adjusting α also changes β in this particular model. This does not mean that α is an adjustable parameter in every real system.

## Signed residual and positive part

To avoid confusion with the state coordinate y, this section writes the time-dependent residual as r. The UI's y(t) corresponds to this r(t).

```text
r(t) = V(p(t)) - θ
r₊(t) = max(r(t), 0)
```

Inside the TCZ, r<0. The nonnegative gauge of the “remaining amount” uses r₊. If a trajectory starts inside, r stays at a negative constant in this model; it does not approach zero. Its positive part r₊, however, is zero from the outset.

The comparison estimate valid throughout this model is

```text
0 ≤ r₊(t) = r₊(0) exp(-βt) ≤ r₊(0) exp(-αt)
```

Outside, r₊=r and ṙ=-βr≤-αr, so the same comparison estimate applies to the signed residual. When δ=0, the actual curve coincides with the upper-bound curve. When δ>0, the actual curve decreases faster. `derivative` is the derivative of the signed residual. It is zero inside and on the boundary.

## Distance to the set

For a general V, r₊→0 alone does not unconditionally imply convergence in Euclidean distance. An error bound such as the one in the references, or suitable compactness assumptions, is needed.

For this particular model, an explicit estimate is available. Let m=min(1,b). For an exterior point p, the point p*=√(θ/V(p))p lies on the ellipse's boundary, so

```text
dist(p,Ωθ) ≤ |p-p*|
            ≤ (√V(p)-√θ)/√m
            = r₊ / ((√V(p)+√θ)√m).
```

The final expression is `distanceBound`. It is zero inside. Distance convergence follows from r₊→0 and the positive lower bound √θ√m>0 on the denominator. This is an upper bound on distance, not the exact shortest distance to the ellipse. With rotation, a trajectory continues to travel around the boundary, so convergence to a single point is not claimed either.

## Finite-time entry and invariance

For a trajectory starting outside in this model, exact arithmetic gives r(t)>0 at every finite time. Its distance to the boundary approaches zero, but finite-time entry into the TCZ is not guaranteed. Remaining outside is compatible with r→0; the exponential r(0)e^(-βt) is a concrete example. This differs from remaining at least a fixed positive distance away.

If the initial state is inside or on the boundary, V stays constant. Consequently, Ωθ is forward invariant. This property holds independently of finite-time entry. In the condition-breaking experiments, the displayed guarantees and proof steps change to match the modified field.

Browsers use double-precision floating-point arithmetic, so a sufficiently small residual can cause V to round to θ. A point visually overlapping the boundary, or a displayed value of `0.000`, does not establish mathematical finite-time entry. Internally, the residual is evaluated directly from its exponential expression to avoid loss of precision from subtracting V-θ.

## Finite-time entry and internal drift

This model was designed specifically for the app. Outside the TCZ, the potential decreases and the trajectory enters in finite time. Inside, the trajectory drifts instead of continuing to decrease monotonically. The internal motion is an additional design that remembers the position and velocity at the transition. It is not presented as a consequence of Theorem 1 or the comparison principle. Here, “retaining velocity” means continuity of the trajectory's position and velocity, not inertial motion under a physical law or a conservation law.

Use the transformed coordinates `q=(x₁,√b x₂)`, `R=√θ`, and `β=α(1+δ)>0`. During the initial phase,

```text
q̇ = -(β/2)q + ωJq,
q(t) = exp(-βt/2) R(ωt)q(0),
V(t) = V(0)exp(-βt).
```

Here `R(ωt)` is the rotation matrix, distinct from the radius R. For an initial state outside the TCZ, the entry time is `t_entry=log(V(0)/θ)/β`. For an initial state inside or on the boundary, `t_entry=0`.

The transition to drift occurs at `|q|=0.6R`. Thus, when `V(0)>0.36θ`, `t_drift=log(V(0)/(0.36θ))/β`. If `V(0)≤0.36θ` already holds, drift begins immediately. `driftTiming()` returns both times.

Let q₀ be the transition point and `v₀=-(β/2)q₀+ωJq₀` its velocity during the initial phase. The model stores a center and two axes:

```text
c = q₀/2,   A = q₀/2,
ν = max(|v₀|/(0.3R), 0.7),   B = v₀/ν,
s = t - t_drift,
q(s) = c + A cos(νs) + B sin(νs),
q̇(s) = -νA sin(νs) + νB cos(νs).
```

Since `q(0)=q₀` and `q̇(0)=v₀`, position and velocity are continuous at the transition. Acceleration continuity is not required. For a nonzero initial state, V has periods of increase and decrease inside, rather than decreasing monotonically toward the origin. When ω=0, the ellipse degenerates into back-and-forth motion along a line segment. A trajectory initialized at the origin stays still, but one passing through the origin during drift keeps moving according to its stored velocity.

Drift stays inside the TCZ because of the following bound:

```text
|c|=|A|≤0.3R,   |B|≤0.3R,
|q(s)| ≤ |c| + √(|A|²+|B|²)
       ≤ (0.3 + √0.18)R < 0.725R < R.
```

V keeps decreasing after entry during the initial phase, and this radius bound holds during drift. A trajectory therefore never leaves the TCZ once it has entered. The same holds for a trajectory initialized inside the TCZ. This is a property of the trajectory equations themselves, not a procedure that clips coordinates during playback.

Outside, `ẏ=-βV≤-α(V-θ)=-αy`. After entry, the signed y can rise and fall while `y₊=max(y,0)=0` remains true. Consequently, `0≤y₊(t)≤y₊(0)exp(-αt)` holds for all time. The guarantee concerns this positive part. It does not guarantee that the signed y or V decreases monotonically inside. Distance becomes zero in finite time and remains zero thereafter.

Even at the same position, velocity depends on whether the trajectory is in the initial or drifting phase and on its stored center and axes. A two-dimensional `field(point,params)` therefore cannot be returned for `drift`. `field` and the functions that use it, `potentialDerivative` and `boundaryDerivative`, throw exceptions for `drift`. Use `velocityAt(time,params)`, which has access to the time and initialization information. `Sample.derivative` always evaluates `2q·q̇`. This model is not rendered as a fixed vector field or a fixed zero-dissipation set; it uses `zeroSet='phase-dependent'`.

For `drift`, the result of `guarantees()` applies to the entire family of trajectories whose position, velocity, and memory are initialized as described here. It does not claim that arbitrary velocities assigned to additional state variables will keep a trajectory inside the TCZ. The LaSalle explanation for an autonomous system with position as its only state does not apply to this model.

## Condition-breaking and forward-invariance experiments

Every experiment uses the same V, Ωθ, and upper bound on Euclidean distance. All additional fields except `drift` are two-dimensional autonomous systems, with parameters fixed during each experiment. The table also includes the retained LaSalle reference model, which is not available in the visible experiment menu.

| Field     | Change in V                                                  | Exponential bound with rate α | Forward invariance of Ωθ                | Convergence to Ωθ from all initial states |
| --------- | ------------------------------------------------------------ | ----------------------------- | --------------------------------------- | ----------------------------------------- |
| normal    | V̇=-β(V-θ) outside; 0 inside                                  | Holds                         | Holds                                   | Holds                                     |
| drift     | V̇=-βV outside; increases and decreases during internal drift | Holds for the positive part   | Holds with the specified initialization | Holds (finite-time entry)                 |
| slow      | V̇=-0.35α(V-θ) outside; 0 inside                              | Does not hold                 | Holds                                   | Holds (at a slower exponential rate)      |
| orbit     | V̇=0                                                          | Does not hold                 | Holds                                   | Does not hold                             |
| inward    | V̇=-βV                                                        | Holds                         | Holds                                   | Holds                                     |
| contained | V̇=βV(1-V/θ)                                                  | Holds (outside)               | Holds                                   | Holds                                     |
| outward   | V̇=βV(1-V/K), K=1.6θ                                          | Does not hold                 | Does not hold                           | Does not hold                             |
| lasalle   | V̇=-2βq₂²                                                     | Does not hold in general      | Holds                                   | Holds when ω≠0                            |

Here β=α(1+δ). “Does not hold” means there is no such guarantee for the field as a whole. For example, even in `orbit`, the distance to the set is zero if the trajectory starts in Ωθ. `guarantees()` returns properties across initial states, rather than inferring them from a particular displayed frame.

In every mode, `Sample.bound` remains `r₊(0)exp(-αt)`. When `comparison=false`, it is displayed as a **reference curve** without a guarantee. In `slow`, the actual curve can exceed this reference while the trajectory still converges to the set. This distinguishes the loss of a proof condition from failure to converge.

For `inward`, q̇=-(β/2)q+ωJq and V(t)=V(0)exp(-βt). A trajectory starting outside reaches the boundary at time log(V(0)/θ)/β, then moves inside. Unlike normal mode, this is a concrete example with finite-time entry.

The forward-invariance option “外側へ向ける” (“Point outward”) uses `contained`. Its field is q̇=(β/2)(1-V/θ)q+ωJq: outward inside, tangential on the boundary, and inward outside. Away from the origin, V(t)=θ/[1+(θ/V(0)-1)exp(-βt)]. If 0<V(0)<θ, V increases toward θ without crossing it. The origin stays still, and a trajectory starting on the boundary remains at potential θ. Outside, V̇=-(βV/θ)(V-θ)≤-α(V-θ), so the exponential bound on the positive part also holds. The field itself has zero outward component at the boundary; displayed positions are not clipped.

The `outward` option in the condition-breaking experiment provides a comparison in which a nonzero outward component remains at the boundary and invariance is lost.

The forward-invariance screen permits only `normal`, `inward`, and `contained`, with initial states restricted to the TCZ interior or boundary. If dragging, coordinate input, or a change to θ or b would place the initial point outside, that point is mapped to the boundary along the same direction. This happens only when setting the initial condition, not by clipping the trajectory during playback. The restriction does not apply to comparison or condition-breaking experiments, or to the retained LaSalle reference model.

For `outward`, q̇=(β/2)(1-V/K)q+ωJq. The origin stays still; elsewhere,

```text
V(t) = K / (1 + (K/V(0)-1) exp(-βt)) → K > θ.
```

At the boundary V=θ, V̇=βθ(1-1/1.6)>0, so nonzero initial states inside eventually leave. Since V never exceeds max(V(0),K), this model does not diverge to infinity beyond the screen. The set where V̇=0 consists of the origin and the ellipse V=K, represented by `zeroSet='origin-and-ellipse'`.

`boundaryDerivative()` gives V̇ at the boundary point (√θ,0). In the LaSalle model, its value varies along the boundary, so use `potentialDerivative(point, params)` to evaluate an arbitrary point. `viewportPotential()` provides an upper bound on V for all future times, including K for the outward experiment.

## LaSalle reference model

The LaSalle model is retained for numerical calculations and tests; it is not included in the visible experiment menu. This linear reference model was designed for the app and uses the following equations in transformed coordinates:

```text
q̇₁ = ω q₂
q̇₂ = -ω q₁ - d q₂,   d=β>0
V = q₁²+q₂²
V̇ = -2d q₂² ≤ 0
```

The set E where V does not decrease is the line q₂=0. When ω≠0, however, q̇₂=-ωq₁≠0 at every point of E except the origin, so trajectories leave the line. The largest invariant subset of E is therefore the origin alone. The initial sublevel set `{V≤V(0)}` is compact and forward invariant. Applying LaSalle's invariance principle on this set yields q(t)→0. Since the origin lies in Ωθ, convergence to the set follows as well.

When ω=0, q₁ stays constant and only q₂ decays exponentially. Then all of E is invariant, and the limiting point is (q₁(0),0). If q₁(0)²>θ, the trajectory does not converge to Ωθ. This model distinguishes the set where V̇=0 from the largest invariant subset in which a trajectory can remain.

Trajectories are evaluated exactly using the exponential of a 2×2 matrix, with separate calculations for overdamped, critically damped, and underdamped cases. The overdamped calculation uses two decaying exponentials directly, avoiding products of growing hyperbolic functions and decaying exponentials. The solution for ω=0 is also handled separately.

This LaSalle explanation is limited to the app's autonomous linear model. It should not be applied to a time-dependent V or a general control problem without checking the necessary assumptions.

## Implementation scope

### Mapping to the 3D terrain

The displayed surface is `(x₁, x₂, h(V(x₁,x₂)))`. A nondecreasing height transformation h, used only for display, creates a gridded surface whose central depression joins the surrounding plane smoothly. The flat region compresses multiple values of V to the same displayed height, so height itself cannot be read as the numerical value or a contour of V. The actual V is available in the numerical readouts, time graph, and 2D contours.

Specifically, for a reference value M determined by the displayed range, the app uses `h(V) = -210 max(0, 1 - V/(0.85M))³`. The surface is flat for V ≥ 0.85M, with the bottom of the depression at the center; the transition is C² continuous. M is chosen from the initial value, threshold, and an upper bound on the entire trajectory, and stays fixed during playback.

The vertical axis is a visualization device. It adds no state variable or equation of motion. The same h is applied to the state point, trajectory, and TCZ boundary, while numerical calculations use the original V. The TCZ boundary is `V=θ`, displayed at height h(θ). The resemblance to spacetime curvature is visual; the app does not calculate physical spacetime or gravity.

In normal mode, a point initialized outside travels from the plane into the depression and approaches the boundary V=θ. The display does not force it to the bottom at `V=0`. A trajectory starting inside maintains its height in normal mode. The 3D view is a projection onto SVG; changing the viewpoint or switching to the 2D view does not affect the calculation. Other fields display the changes in V determined by their respective analytic solutions.

The implementation covers a single agent and a static potential. It constructs concrete fields whose properties can be checked analytically, rather than deriving an instantaneous descent condition from minimization of an integral cost. Multiple agents and abstraction potentials are left for future implementation.

Unit tests verify agreement between trajectory finite differences and the vector field, potential derivatives, comparison estimates across parameter combinations, interior and boundary invariance, noncircular trajectories, distance bounds, and long-time behavior.
