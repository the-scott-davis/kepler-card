import test from "node:test";
import assert from "node:assert/strict";
import { REVEAL, beamAngle, beamDeg, revealNode, revealGlobal, partialPath, reducedMotion, radarSvg } from "../src/reveal.js";

test("node reveal timing is monotonic", () => {
  for (const a of [0, 1, 3, 6]) {
    let prev = revealNode(0, a, false);
    for (let t = 0.05; t <= REVEAL.end; t += 0.05) {
      const n = revealNode(t, a, false);
      assert.ok(n.o >= prev.o - 1e-9 && n.draw >= prev.draw - 1e-9);
      prev = n;
    }
    assert.equal(prev.s, 1);
    assert.equal(prev.o, 1);
    assert.equal(prev.draw, 1);
  }
});
test("nodes reveal in beam order", () => {
  assert.ok(revealNode(1, 1, false).at < revealNode(1, 2, false).at);
  assert.equal(revealNode(0, 1, true).s, 1);
  assert.equal(revealNode(0, 1, false).s, 0);
});
test("global fades are monotonic", () => {
  let p = revealGlobal(0);
  for (let t = 0.1; t <= REVEAL.end; t += 0.1) {
    const g = revealGlobal(t);
    assert.ok(g.labels >= p.labels && g.radar <= p.radar);
    p = g;
  }
  assert.equal(p.labels, 1);
  assert.equal(p.radar, 0);
});
test("beam angle and degrees", () => {
  const C = { x: 0, y: 0 };
  assert.ok(Math.abs(beamAngle(C, { x: 0, y: -1 })) < 1e-9);
  assert.ok(Math.abs(beamAngle(C, { x: 1, y: 0 }) - Math.PI / 2) < 1e-9);
  assert.ok(beamDeg(-1) >= 0 && beamDeg(-1) < 360);
  assert.ok(Math.abs(beamDeg(REVEAL.start + REVEAL.turn / 2) - 180) < 1e-9);
});
test("partial path on L and Q", () => {
  assert.equal(partialPath("M0,0 L10,20", 0.5), "M0.0,0.0 L5.0,10.0");
  assert.equal(partialPath("M0,0 L10,20", 1), "M0,0 L10,20");
  assert.equal(partialPath("M0,0 Q10,0 10,10", 0.5), "M0.0,0.0 Q5.0,0.0 7.5,2.5");
  assert.equal(partialPath("M0,0 Q10,0 10,10", 0), "M0.0,0.0 Q0.0,0.0 0.0,0.0");
  assert.equal(partialPath("garbage", 0.5), "garbage");
});
test("reduced motion is false without matchMedia", () => {
  assert.equal(reducedMotion(), false);
});
test("radar uses the given colour and kfade", () => {
  const s = radarSvg({ x: 500, y: 500 }, true, "var(--kepler-highlight-color, #60a5fa)");
  assert.match(s, /^<g class="radar js"/);
  assert.ok(s.includes("kfade") && s.includes("stop-color:var(--kepler-highlight-color, #60a5fa)"));
  assert.ok(!s.includes("#60a5fa\"") && !s.includes("nofade"));
});
