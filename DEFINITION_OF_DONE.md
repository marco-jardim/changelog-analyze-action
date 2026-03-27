# Definition of Done

A feature or release is **Done** when ALL items below are checked.

## Code Quality

- [x] TypeScript strict mode enabled — no `any`, no `@ts-ignore`, no `@ts-expect-error`
- [x] All exports are explicitly typed
- [x] No empty catch blocks — all errors are propagated or logged
- [x] CEI pattern followed where applicable
- [x] No hardcoded secrets, API keys, or credentials

## Testing

- [x] `npm test` exits with code 0
- [x] All 12+ tests passing
- [x] Coverage collected for `src/**/*.ts`
- [x] Snapshot tests committed

## Build

- [x] `npm run build` exits with code 0
- [x] `dist/index.js` exists and is a valid Node.js bundle
- [x] `node_modules/` is NOT committed (in `.gitignore`)
- [x] `dist/` is committed (required for GitHub Actions)

## Documentation

- [x] `README.md` covers all inputs, outputs, and providers
- [x] Usage examples are accurate and runnable
- [x] Provider-specific secrets documented
- [x] `insights.v1.json` schema documented
- [x] Contributing section present

## GitHub

- [x] Repository `marco-jardim/changelog-analyze-action` is public
- [x] Default branch is `main`
- [x] `action.yml` is in the repo root
- [x] `v1.0.0` tag and release created
- [x] CI workflow passing on `main`

## Integration Compatibility

- [x] Input changeset matches `changeset.v1.json` schema from `changelog-collect-action`
- [x] Output `insights.v1.json` schema is compatible with `changelog-render-action` input
- [x] `idempotency_key` is preserved end-to-end
