# Web Asset Synchronization

CheapLive has several web surfaces, but only a small, audited subset is a byte-identical mirror. The historical script name is retained for compatibility; its implementation now resolves the repository from its own file location and cannot write to a neighboring worktree.

## Commands

```sh
npm run assets:check
npm run assets:sync
```

- `assets:check` is read-only. It fails on a missing target, content drift, or a stale manifest.
- `assets:sync` copies only the declared targets and regenerates `docs/architecture/WEB_ASSET_SYNC_MANIFEST.json` with source SHA-256 and size.
- The sync script rejects any path that escapes the repository root.

`npm run assets:check` should run in CI and before a branch is handed off. `assets:sync` is an intentional authoring action and should not run automatically during application startup or build.

## Intentional variants

The following areas must remain independently authored unless the source map is deliberately changed:

- Public `src/contest-demo/` versus Android `web/contest-demo/`
- Public face renderer versus Android receiver renderer
- Android capture, receiver, contest-demo, and avatar-demo HTML/application logic
- Android demo's sphere variant, which is not currently identical to the receiver sphere
- URL/bootstrap code for GitHub Pages/public hosting versus Android `file:` and LocalServer routes

Same basename does not establish a mirror relationship.

## Manifest authority

`WEB_ASSET_SYNC_MANIFEST.json` is generated from the source map and hashes current canonical files. It is reviewable evidence, not an input configuration. The older Android-local `contest-demo-assets-manifest.json`, where present, is historical packaging metadata and does not override the current source map.

## Adding a mirror

Add a mirror only after proving that both surfaces share the same runtime contract. Update `ASSET_GROUPS`, regenerate the manifest, add or update the drift test, and verify the affected public and Android entrypoints. If the environments require even a small behavioral difference, keep separate sources.
