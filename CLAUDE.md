# kepler-card notes for workers

- Installs go through the Home Assistant Marketplace (HACS folded into core in 2026.11). Never write "HACS custom repositories" steps; never call `hacs/*` websocket commands.
- This is a dashboard card (`plugin`): it ships `kepler-card.js` as a release asset. Never use `zip_release`, which HACS supports for integrations only.
- Download counts come from the `kepler-card.js` release asset. Nothing in CI, tests or verification may download a release asset, because that inflates the count; tests use the local build.
- `dist/kepler-card.js` is committed and must match the build (the hacs job checks it). Until a release exists it is what HACS validation finds.
- The card reads one entity (`nodes_entity`) and its `nodes` attribute; it never takes data any other way. Large networks can exceed Home Assistant's 16 KB recorder limit for attributes; the producer (NetOrbit) owns that.
- Cutting and publishing a release, and the real-instance release QA, are the maintainer's, after merge. A PR's How to test covers only what can be checked before merge.
