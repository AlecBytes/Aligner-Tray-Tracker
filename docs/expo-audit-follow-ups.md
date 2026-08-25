# Expo Best-Practices Audit Follow-ups

## Scope decision

iOS is the only supported product and release target for the current phase. Android- and web-specific release-readiness findings are out of scope until either platform is explicitly added to the roadmap.

## Open items

### 1. Add a root bootstrap error boundary

The root route currently mounts the SQLite provider and app bootstrap flow without an Expo Router error boundary. A database initialization, migration, or provider-render failure can therefore prevent the app from presenting an app-owned recovery state.

Resolution requirements:

- Export an Expo Router-compatible `ErrorBoundary` from the root layout.
- Present the iOS recovery UI with `@expo/ui/swift-ui`, consistent with the iOS UI-purity rules.
- Give the user a safe retry path that does not reset or overwrite local data.
- Add coverage for a simulated initialization or migration failure.

### 2. Record physical-device performance baselines

The budgets and measurement process in [`performance.md`](performance.md) are defined, but its baseline table is still empty. Record release-like measurements on representative physical iPhones before treating the budgets as enforced evidence.

Resolution requirements:

- Record the device, OS, build profile, commit, dataset size, and measurement date.
- Capture the documented startup and core tracker interaction metrics with median and p95 values.
- Record the production JavaScript bundle and installed/download size measurements.
- Investigate or document any result that exceeds a budget.

### 3. Gate production EAS builds on repository validation

The production EAS workflow creates the iOS build without first running the repository validation suite. A production build can therefore begin even when type checking, linting, tests, dependency checks, or the iOS UI-purity guard would fail.

Resolution requirements:

- Add a validation job using the repository-pinned Node.js version.
- Install dependencies from the lockfile and run `npm run validate`.
- Make the production iOS build depend on the successful validation job.
- Keep the workflow valid against the current EAS Workflow schema.

## Documentation update completed

The README now reflects that Phase 1 iOS authentication and Phase 2C manual **Back Up Now** are implemented. Automatic backup, restore, retention, cloud-account deletion, and multi-device sync remain future work.
