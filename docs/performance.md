# Performance Measurement Plan

## Purpose

Performance is a primary product goal for Aligner Tracker.

This document defines how performance should be measured and reviewed as the app grows. It does **not** require implementation now.

The goal is to establish repeatable measurements for the user interactions that matter most, detect regressions early, and avoid adding optimization complexity without evidence.

---

## Performance Principles

- Measure user-perceived latency first.
- Measure on real devices and release-like builds.
- Prefer repeatable measurements over one-off best-case numbers.
- Optimize only when measurements show a meaningful problem.
- Preserve simple architecture unless profiling justifies additional complexity.
- Avoid adding monitoring SDKs or telemetry solely for development benchmarking.
- Track regressions as features are added.

---

## Core Performance Metrics

### 1. Cold Startup

Measure:

`App fully terminated → Tracker usable`

The tracker is considered usable when:

- local treatment state is loaded
- current tray data is visible
- the IN/OUT control is interactive

Initial project budget:

**Target: under 1.5 seconds on the primary reference device**

Record both median and p95 when practical.

---

### 2. Warm Resume

Measure:

`App in background → Tracker usable`

Initial project budget:

**Target: under 500 ms**

---

### 3. IN/OUT Toggle

Measure:

`Tap → SQLite write completes → correct tracker state is visible`

This includes the local application/repository work required for the action.

It should not include network activity because normal tracker actions are local-only.

Initial project budget:

**Target: under 100 ms**

Measure both:

- IN → OUT
- OUT → IN

---

### 4. Change Tray

Measure:

`Confirm tray change → transaction completes → new tray state is visible`

Initial project budget:

**Target: under 150 ms**

---

### 5. Treatment Plan Save

Measure:

`Save → new TreatmentPlanVersion persisted → resulting current plan state visible`

Track this as a regression metric even if no strict budget is initially enforced.

---

### 6. Punch Correction

Measure:

`Save correction → SQLite transaction completes → affected values are recalculated`

Track:

- edit existing punch
- add missing time period

Initial budget can be established after real-device baseline testing.

---

### 7. Statistics Load

Measure:

`Open Statistics → complete statistics read model visible`

Use a realistic long-running treatment dataset.

Initial project budget:

**Target: under 250 ms**

If this grows materially over time, profile the database queries and calculations before introducing caching.

---

## Runtime Resource Metrics

### Memory

Measure memory usage:

- tracker idle after startup
- after repeated navigation through major screens
- after repeated IN/OUT actions
- after opening/closing Statistics and Edit In/Out Times repeatedly

Watch for sustained growth that does not return toward baseline.

Do not establish a strict memory budget until baseline measurements exist.

---

### CPU While Tracker Is Visible

The tracker updates the displayed active timer once per second.

Measure the app while leaving the tracker visible for at least 10–20 minutes.

Verify:

- no unexpected sustained CPU usage
- no growing memory allocation pattern
- no repeated database writes caused by the display timer
- no unnecessary background work

---

### UI Responsiveness

Watch for:

- dropped frames
- visible input delay
- navigation stutter
- keyboard lag
- list scrolling issues

Use profiling tools only when a repeatable responsiveness problem is observed.

---

### App / Bundle Size

Track release artifact and JavaScript bundle size over time.

The purpose is primarily to detect dependency creep.

Record bundle/app size after major dependency additions or Expo upgrades.

Do not optimize size at the expense of utility unless growth becomes meaningful.

---

## Reference Test Devices

Use consistent reference hardware whenever comparing releases.

Record devices here when established.

### Primary iOS Device

```text
Device:
iOS version:
App build:
```

### Primary Android Device

```text
Device:
Android version:
App build:
```

Do not compare absolute performance numbers from different devices as though they are equivalent.

---

## Test Dataset

Performance testing should not rely only on a newly created treatment with a handful of punches.

Maintain a repeatable development test dataset representing a mature treatment.

Recommended large test scenario:

- approximately 12 months of treatment history
- multiple tray periods
- repeated tray numbers
- several IN/OUT transitions per day
- multiple treatment-plan versions
- punch corrections
- realistic notification/settings records

Statistics, history, and correction views should be measured against this dataset.

The exact fixture-generation approach should be designed later when performance instrumentation is implemented.

---

## Benchmark Method

For important latency measurements:

1. Use the same reference device.
2. Use a release or release-like build.
3. Use the same test dataset.
4. Start from the same application state.
5. Repeat the operation multiple times.
6. Record median latency.
7. Record p95 when enough samples are collected.
8. Compare results to the previous recorded baseline.

Do not use the single fastest run as the reported result.

Development-mode timings should not be treated as production performance measurements.

---

## Baseline Results

Fill this table when benchmarking is implemented.

| Metric | Median | p95 | Budget | Device / Build |
|---|---:|---:|---:|---|
| Cold startup | — | — | < 1500 ms | — |
| Warm resume | — | — | < 500 ms | — |
| IN → OUT | — | — | < 100 ms | — |
| OUT → IN | — | — | < 100 ms | — |
| Change tray | — | — | < 150 ms | — |
| Treatment plan save | — | — | baseline first | — |
| Punch correction | — | — | baseline first | — |
| Statistics load | — | — | < 250 ms | — |
| Idle memory | — | — | baseline first | — |
| App / bundle size | — | — | track regression | — |

These are project performance budgets, not universal React Native requirements. Adjust them if real-device measurement shows a different threshold is more appropriate.

---

## Future Instrumentation

When this work is scheduled, prefer a small development-only timing utility using the platform's high-resolution performance timing APIs.

Measure application operations at clear boundaries, such as:

```text
tracker read model
wear toggle transaction
tray-change transaction
statistics query/calculation
punch-correction transaction
```

Keep instrumentation:

- development-only where practical
- isolated from feature code
- free of network requirements
- removable or disableable in release builds

Do not scatter ad-hoc timing logs throughout React components.

---

## Profiling Strategy

Use the following sequence:

1. Measure an operation.
2. Identify a repeatable regression or budget violation.
3. Profile that specific operation.
4. Determine whether the cost is:
   - SQLite/database work
   - calculation logic
   - React rendering
   - navigation
   - native/platform work
5. Make the smallest useful optimization.
6. Re-measure.

Do not introduce caching, memoization, indexes, native modules, or architectural changes purely because they might be faster.

---

## Platform Profiling Tools

When detailed profiling is needed later:

### React Native / Expo

Use React Native / Expo development profiling tools for:

- JavaScript execution
- renders
- component behavior
- navigation-related work

### iOS

Use Xcode Instruments for deeper investigation of:

- CPU
- allocations
- memory leaks
- hangs/responsiveness
- launch behavior
- energy/resource usage

### Android

Use Android Studio profiling/system tracing for:

- CPU
- memory
- UI responsiveness
- system scheduling
- runtime behavior

These tools should diagnose known problems rather than become part of everyday development workflow.

---

## Regression Review

After a major feature or dependency addition, consider re-measuring:

- startup
- IN/OUT toggle
- Change Tray
- Statistics
- memory
- bundle/app size

A release should generally remain at least as responsive as the prior baseline unless a deliberate product tradeoff has been accepted.

If a performance regression is accepted, document why.

---

## Out of Scope for Now

Do not implement yet:

- performance-monitoring SDKs
- production telemetry
- benchmark automation
- CI performance gates
- large synthetic-data generators
- persistent performance logs
- remote analytics
- caching solely for anticipated performance problems

These can be considered when the app is closer to release or measurements demonstrate a concrete need.

---

## Success Criterion

Performance is successful when the core app feels immediate and remains that way as features accumulate.

The important standard is not feature count or benchmark theater.

The standard is:

> Core tracking actions remain fast, predictable, and inexpensive throughout the life of the app.
