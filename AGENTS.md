This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Project Boundaries

- Keep feature-specific screens, components, contracts, and repositories in `src/features/<feature>/`. Put shared UI in `src/components/`, theme code in `src/theme/`, and platform/service adapters in `src/lib/`.
- Feature repositories own Supabase queries and RPC calls. Parse remote data at contract boundaries instead of trusting unvalidated responses or putting database access directly in UI components.
- `supabase/functions/_shared/` contains logic shared by Edge Functions and the app. Preserve its runtime-compatible imports when changing shared modules.
- Make database changes with ordered SQL migrations under `supabase/migrations/`. Review RLS and function grants for data-access changes; do not assume a migration has been applied to a remote project. See [README.md](README.md) for deployment details.

## Persistence & AI Safeguards

- Supabase is authoritative for persisted workout and assessment data. Report a mutation as saved only after server confirmation; if its outcome is ambiguous, refresh and inspect server state before retrying to avoid duplicate writes.
- Assessment documents remain private. Never send a document or health data to Gemini automatically; require the explicit, action-specific consent and adult confirmation already enforced by the feature, and respect the server's enabled status.
- AI workout plans are proposals, not prescriptions. They require user review and explicit saving; do not present them as medical advice or as saved workouts before confirmation.

## Verification

- Run `npm run lint`, `npm run typecheck`, and `npm test` before completing code changes. For a focused test, use `node --test tests/<name>.test.mjs`.
- Before an EAS release, run `npm run release:check` with the required public environment variables configured. See [README.md](README.md) for publishing and environment handling.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
