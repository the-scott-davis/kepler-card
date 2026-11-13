# kepler-card
Orbital map card for Home Assistant. Shows Zigbee, Z-Wave, Thread and Bluetooth meshes, or any device tree, as a live radial view.

![Kepler card](docs/full.png)

| Themed | Small tree | Deep tree |
| --- | --- | --- |
| ![Themed Kepler card](docs/themed.png) | ![Basic tree](docs/basic.png) | ![Deep tree](docs/deep.png) |

The images in `docs/` are rendered from the preview page: run `npm run render` (needs `npx playwright install chromium`) and commit the result.

## Install

Requires Home Assistant 2026.11 or later.

1. Open Settings > Marketplace.
2. Choose Add from link and paste `https://github.com/the-scott-davis/kepler-card`.
3. Pick type Dashboard and download.
4. Add the card to a dashboard.

Versions come from GitHub releases; the first is `v0.1.0`.

### Releasing (maintainer)

1. Bump `version` in `package.json` and merge.
2. Publish a GitHub release `v<version>` as a pre-release first.
3. Promote it to latest once checked.

`.github/workflows/release.yml` attaches `kepler-card.js` to the release and fails if the tag differs from the `package.json` version.

## Keyboard

Press Tab and Shift+Tab to move between nodes. The focused node is outlined and shows its label. Enter or Space activates it and fires the same `kepler-node-tap` event as a click (and opens more-info when `more_info` is on). With zoom on, a focused node is panned into view.

## CI

Pull requests and pushes to main run `.github/workflows/ci.yml`:

- HACS validation (category `plugin`). Until a release exists, HACS finds the committed `dist/kepler-card.js`. The job rebuilds and fails if `dist/kepler-card.js` differs from the fresh build (the stale-dist gate), so run `npm run build` and commit `dist/` after changing `src/`. The root `kepler-card.js` stays an uncommitted build output used by tests and e2e. HACS also needs the GitHub repository description and topics set; that is a repo setting the workflow does not do.
- Unit tests (`npm test`, which builds first). The unit job also runs `npm run package`, which builds and checks that `kepler-card.js` exists, is non-empty and registers the element.
- Playwright browser tests in chromium and WebKit (`npm run test:browser`). Either browser failing fails the job.
- Home Assistant end-to-end tests against a pinned release, which blocks the merge, and against the beta, which does not. The pinned tag lives in `ha-version.txt`. Both jobs install the packaged file at `/config/www/community/kepler-card/kepler-card.js` and register `/local/community/kepler-card/kepler-card.js?v=<version>`. In Chromium and WebKit they check that the element is defined, nodes draw, there is no error card, there is no kepler console error, the `?v=` version is loaded, and the card renders at 375 px and in dark theme.
