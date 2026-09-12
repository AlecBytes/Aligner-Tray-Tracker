# Expo Best-Practices Audit Follow-ups

## Scope decision

iOS is the only supported product and release target for the current phase. Android- and web-specific release-readiness findings are out of scope until either platform is explicitly added to the roadmap.

## Open items

### 1. Record physical-device performance baselines

The budgets and measurement process in [`performance.md`](performance.md) are defined, but its baseline table is still empty. Record release-like measurements on representative physical iPhones before treating the budgets as enforced evidence.

Resolution requirements:

- Record the device, OS, build profile, commit, dataset size, and measurement date.
- Capture the documented startup and core tracker interaction metrics with median and p95 values.
- Record the production JavaScript bundle and installed/download size measurements.
- Investigate or document any result that exceeds a budget.

## Completed September 11, 2026

### Root bootstrap error boundary

The root route now exports an Expo Router-compatible error boundary. Its iOS implementation uses `@expo/ui/swift-ui`, preserves local data, presents a safe retry, and has focused coverage for a simulated initialization error. Physical release-build verification remains in the App Store release plan.

### Production EAS validation gate

The production workflow now uses Node v22.13.0, installs from the lockfile, checks Expo package compatibility, runs pinned Expo Doctor and `npm run validate`, and makes the production iOS build depend on success. Expo's live workflow validator accepts the configuration.

## Documentation update completed

The README reflects that Phase 1 iOS authentication, Phase 2C manual **Back Up Now**, and Phase 2D empty-install restore are implemented. Automatic backup, retention, cloud-account deletion, and multi-device sync remain future work.
