# kepler-card
Orbital map card for Home Assistant. Shows Zigbee, Z-Wave, Thread and Bluetooth meshes, or any device tree, as a live radial view.

## Keyboard

Press Tab and Shift+Tab to move between nodes. The focused node is outlined and shows its label. Enter or Space activates it and fires the same `kepler-node-tap` event as a click (and opens more-info when `more_info` is on). With zoom on, a focused node is panned into view.

## CI

Pull requests and pushes to main run `.github/workflows/ci.yml`:

- HACS validation (category `plugin`). It builds `kepler-card.js` first, since the bundle is not committed. HACS also needs the GitHub repository description and topics set; that is a repo setting the workflow does not do.
- Unit tests (`npm test`, which builds first).
- Playwright browser tests in chromium and WebKit (`npm run test:browser`). Either browser failing fails the job.
- Home Assistant end-to-end tests against a pinned release, which blocks the merge, and against the beta, which does not. The pinned tag lives in `ha-version.txt`.
