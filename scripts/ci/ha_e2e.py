#!/usr/bin/env python3
"""End-to-end check of kepler-card inside a real Home Assistant.

CI runs this from .github/workflows/e2e.yml against the official Home Assistant container. It onboards a fresh
instance with a throwaway user, registers the packaged kepler-card.js as a Lovelace module resource, publishes a
made-up device tree as a sensor's `nodes` attribute, puts a `custom:kepler-card` on a dashboard, opens it in
Chromium and WebKit and checks that the card is in window.customCards and draws nodes (g.node).

To run it on your own machine (use a throwaway instance, never your real one):

    npm ci && npm run package
    pip install -r scripts/ci/requirements_e2e.txt
    python -m playwright install --with-deps chromium webkit
    mkdir -p /tmp/ha-e2e/www/community/kepler-card && cp kepler-card.js /tmp/ha-e2e/www/community/kepler-card/
    docker run -d --name ha-e2e -p 8123:8123 -v /tmp/ha-e2e:/config \\
        ghcr.io/home-assistant/home-assistant:$(cat ha-version.txt)
    python scripts/ci/ha_e2e.py run --url http://localhost:8123 --out /tmp/ha-e2e-out
    docker rm -f ha-e2e

Home Assistant serves /config/www as /local, so the file above is loaded from the same path a Marketplace (HACS)
install uses, with the ?v=<package.json version> query. `run` saves screenshots per browser and check into --out. Every failed check is printed as a GitHub `::error::` line.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import pathlib
import secrets
import subprocess
import sys
import time

DASHBOARD = "kepler-ci"
VIEW = "map"
ENTITY = "sensor.kepler_ci_tree"
ROOT = pathlib.Path(__file__).resolve().parents[2]
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
# Where a Marketplace install puts the file (/config/www/community/kepler-card/kepler-card.js), plus the version query.
RESOURCE_URL = f"/local/community/kepler-card/kepler-card.js?v={VERSION}"
IN_ACTIONS = os.environ.get("GITHUB_ACTIONS") == "true"

# A small made-up device tree: one root hub, one sub hub and a few devices.
NODES = [
    {"key": "gw", "label": "CI gateway", "icon": "mdi:router-wireless", "status": "online", "kind": "hub"},
    {"key": "ap", "parent": "gw", "label": "CI access point", "icon": "mdi:access-point", "status": "online", "kind": "hub"},
    {"key": "tv", "parent": "ap", "label": "CI TV", "icon": "mdi:television", "status": "online"},
    {"key": "phone", "parent": "ap", "label": "CI Phone", "icon": "mdi:cellphone", "status": "recent"},
    {"key": "printer", "parent": "gw", "label": "CI Printer", "icon": "mdi:printer", "status": "stale"},
]

failures: list[tuple[str, str]] = []
summary: list[str] = []  # one line per check that ran, shown as a notice at the end


def log(msg: str) -> None:
    print(msg, flush=True)


def fail(title: str, msg: str) -> None:
    """Record a failed check. It's printed as an annotation right away and counted at the end."""
    failures.append((title, msg))
    # Annotations are one line: keep newlines as the encoded form GitHub understands.
    body = msg.replace("%", "%25").replace("\r", "").replace("\n", "%0A")
    print(f"::error title={title}::{body}", flush=True)


def warn(title: str, msg: str) -> None:
    body = msg.replace("%", "%25").replace("\r", "").replace("\n", "%0A")
    print(f"::warning title={title}::{body}", flush=True)


def report(title: str) -> None:
    """Print what ran as a notice, and add it to the job summary when running in Actions."""
    text = "; ".join(summary)
    print(f"::notice title={title}::{text}", flush=True)
    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a", encoding="utf-8") as fh:
            fh.write(f"### {title}\n\n" + "".join(f"- {line}\n" for line in summary) + "\n")



# ---------------------------------------------------------------- Home Assistant over HTTP


class HA:
    def __init__(self, session, url: str) -> None:
        self.s = session
        self.url = url.rstrip("/")
        self.client_id = self.url + "/"
        self.token: str | None = None
        self.tokens: dict = {}

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    async def get(self, path: str):
        async with self.s.get(self.url + path, headers=self._headers()) as r:
            body = await r.text()
            if r.status >= 400:
                raise RuntimeError(f"GET {path} returned {r.status}: {body[:500]}")
            return json.loads(body) if body else None

    async def post(self, path: str, payload: dict | None = None, form: dict | None = None):
        kw = {"data": form} if form is not None else {"json": payload or {}}
        async with self.s.post(self.url + path, headers=self._headers(), **kw) as r:
            body = await r.text()
            if r.status >= 400:
                raise RuntimeError(f"POST {path} returned {r.status}: {body[:500]}")
            return json.loads(body) if body else None

    async def delete(self, path: str):
        async with self.s.delete(self.url + path, headers=self._headers()) as r:
            body = await r.text()
            if r.status >= 400:
                raise RuntimeError(f"DELETE {path} returned {r.status}: {body[:500]}")
            return json.loads(body) if body else None

    async def wait_up(self, timeout: float) -> list:
        """Wait until the onboarding API answers (the frontend and http are up by then)."""
        deadline = time.monotonic() + timeout
        last = "no answer yet"
        while time.monotonic() < deadline:
            try:
                async with self.s.get(self.url + "/api/onboarding") as r:
                    if r.status == 200:
                        return await r.json()
                    last = f"HTTP {r.status}"
            except Exception as err:  # noqa: BLE001 - still starting
                last = f"{type(err).__name__}: {err}"
            await asyncio.sleep(2)
        raise RuntimeError(f"Home Assistant didn't come up within {timeout:.0f}s ({last})")

    async def onboard(self) -> None:
        steps = await self.wait_up(300)
        if any(s.get("step") == "user" and s.get("done") for s in steps):
            raise RuntimeError("This instance is already onboarded. The e2e check needs a fresh config directory.")
        # Throwaway credentials, made up for this run only. Nothing else ever uses them.
        username = "ci-" + secrets.token_hex(4)
        password = secrets.token_urlsafe(24)
        if IN_ACTIONS:
            print(f"::add-mask::{password}", flush=True)
        res = await self.post(
            "/api/onboarding/users",
            {"client_id": self.client_id, "name": "CI", "username": username, "password": password, "language": "en"},
        )
        self.tokens = await self.post(
            "/auth/token",
            form={"grant_type": "authorization_code", "code": res["auth_code"], "client_id": self.client_id},
        )
        self.token = self.tokens["access_token"]
        if IN_ACTIONS:
            print(f"::add-mask::{self.token}", flush=True)
            print(f"::add-mask::{self.tokens['refresh_token']}", flush=True)
        await self.post("/api/onboarding/core_config", {})
        await self.post("/api/onboarding/analytics", {})
        await self.post(
            "/api/onboarding/integration",
            {"client_id": self.client_id, "redirect_uri": self.client_id + "?auth_callback=1"},
        )
        log(f"Onboarded as {username}")

    async def ws(self, *messages: dict) -> list:
        """Send messages over the websocket API and return each result (raising on the first failure)."""
        out = []
        async with self.s.ws_connect(self.url + "/api/websocket") as ws:
            await ws.receive_json()  # auth_required
            await ws.send_json({"type": "auth", "access_token": self.token})
            hello = await ws.receive_json()
            if hello.get("type") != "auth_ok":
                raise RuntimeError(f"Websocket auth failed: {hello}")
            for i, msg in enumerate(messages, 1):
                await ws.send_json({"id": i, **msg})
                while True:
                    res = await ws.receive_json()
                    if res.get("id") == i and res.get("type") == "result":
                        break
                if not res.get("success"):
                    raise RuntimeError(f"{msg['type']} failed: {res.get('error')}")
                out.append(res.get("result"))
        return out


async def publish_tree(ha: HA) -> None:
    """Make a real entity in the state machine whose `nodes` attribute holds the tree the card reads."""
    await ha.post(f"/api/states/{ENTITY}", {"state": "ok", "attributes": {"nodes": NODES, "friendly_name": "Kepler CI tree"}})
    state = await ha.get(f"/api/states/{ENTITY}")
    if len(state["attributes"].get("nodes") or []) != len(NODES):
        raise RuntimeError(f"{ENTITY} didn't keep its nodes attribute")
    log(f"Published {ENTITY} with {len(NODES)} nodes")


async def make_dashboard(ha: HA) -> None:
    await ha.ws(
        {"type": "lovelace/resources/create", "res_type": "module", "url": RESOURCE_URL},
        {
            "type": "lovelace/dashboards/create",
            "url_path": DASHBOARD,
            "title": "Kepler CI",
            "icon": "mdi:orbit",
            "mode": "storage",
            "show_in_sidebar": True,
            "require_admin": False,
        },
        {
            "type": "lovelace/config/save",
            "url_path": DASHBOARD,
            "config": {
                "title": "Kepler CI",
                "views": [
                    {
                        "title": "Map",
                        "path": VIEW,
                        "cards": [{"type": "custom:kepler-card", "title": "CI", "nodes_entity": ENTITY}],
                    }
                ],
            },
        },
    )
    log(f"Resource {RESOURCE_URL} and dashboard /{DASHBOARD}/{VIEW} saved with a kepler-card")


# ---------------------------------------------------------------- the card in real browsers

CARD_STATE_JS = """(card) => {
  const root = card.shadowRoot;
  const svg = root && root.querySelector("svg");
  return {
    svg: !!svg,
    nodes: root ? root.querySelectorAll("g.node").length : 0,
  };
}"""


# Finds an element by tag name anywhere on the page, going through shadow roots.
FIND_TAG_JS = """(tag) => {
  const seen = [document];
  for (let i = 0; i < seen.length; i++) {
    const root = seen[i];
    if (root.querySelector(tag)) return true;
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) seen.push(el.shadowRoot);
  }
  return false;
}"""

DARK_JS = """() => {
  const ha = document.querySelector("home-assistant");
  return !!(ha && ha.hass && ha.hass.themes && ha.hass.themes.darkMode);
}"""


async def wait_for_nodes(page, timeout: float = 30) -> dict:
    """Wait for the card to draw nodes. Returns its state ({"nodes": 0} when it never did)."""
    state: dict = {"nodes": 0}
    try:
        await page.locator("kepler-card").first.wait_for(state="attached", timeout=timeout * 1000)
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            state = await page.locator("kepler-card").first.evaluate(CARD_STATE_JS)
            if state["nodes"] >= 1:
                break
            await page.wait_for_timeout(500)
    except Exception:  # noqa: BLE001
        pass
    return state


async def check_render(page, engine: str, label: str, out: pathlib.Path) -> None:
    """Card drawn nodes and no hui-error-card on the dashboard, then one screenshot named after the check."""
    title = f"{engine} ({label}):"
    state = await wait_for_nodes(page)
    if state["nodes"] < 1:
        fail(f"{title} no nodes", f"The card drew no g.node elements (svg present: {state.get('svg')})")
    await page.wait_for_timeout(500)
    if await page.evaluate(FIND_TAG_JS, "hui-error-card"):
        fail(f"{title} error card", "The dashboard shows a hui-error-card")
    out.mkdir(parents=True, exist_ok=True)
    await page.screenshot(path=str(out / f"{engine}-{label}.png"))
    if state["nodes"] >= 1:
        summary.append(f"{engine}: {label} renders {state['nodes']} nodes, no error card")


async def logged_in_page(browser, ha: HA):
    """A page logged in to Home Assistant, plus the console messages and page errors it collects."""
    context = await browser.new_context(viewport={"width": 1280, "height": 1100})
    tokens = {
        "access_token": ha.token,
        "token_type": "Bearer",
        "expires_in": ha.tokens.get("expires_in", 1800),
        "refresh_token": ha.tokens.get("refresh_token"),
        "expires": int(time.time() * 1000) + int(ha.tokens.get("expires_in", 1800)) * 1000,
        "hassUrl": ha.url,
        "clientId": ha.client_id,
    }
    # Log the browser in the same way the frontend remembers a login: tokens in localStorage.
    await context.add_init_script(f"window.localStorage.setItem('hassTokens', {json.dumps(json.dumps(tokens))});")
    page = await context.new_page()
    console: list[tuple[str, str]] = []
    page_errors: list[str] = []
    requests: list[str] = []
    page.on("console", lambda m: console.append((m.type, m.text)))
    page.on("request", lambda r: requests.append(r.url))
    page.on("pageerror", lambda e: page_errors.append(f"{e.name}: {e.message}\n{e.stack or ''}"))
    return page, console, page_errors, requests


async def check_browser(pw, engine: str, ha: HA, out: pathlib.Path) -> None:
    title = f"{engine}:"
    browser = await getattr(pw, engine).launch()
    try:
        page, console, page_errors, requests = await logged_in_page(browser, ha)
        await page.goto(f"{ha.url}/{DASHBOARD}/{VIEW}", wait_until="domcontentloaded")
        try:
            await page.wait_for_function("() => !!window.customElements.get('kepler-card')", timeout=30000)
        except Exception:  # noqa: BLE001
            fail(f"{title} card not defined", "customElements.get('kepler-card') was still undefined after 30s. "
                 "The resource didn't load or threw before defining the element.")

        registered = await page.evaluate(
            "() => (window.customCards || []).filter((c) => c && c.type === 'kepler-card').length"
        )
        if registered != 1:
            fail(f"{title} not in customCards", f"window.customCards holds {registered} kepler-card entries, expected 1")
        else:
            summary.append(f"{engine}: kepler-card is in window.customCards")

        card = page.locator("kepler-card").first
        state: dict = {"nodes": 0}
        attached = False
        try:
            await card.wait_for(state="attached", timeout=30000)
            attached = True
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                state = await card.evaluate(CARD_STATE_JS)
                if state["nodes"] >= 1:
                    break
                await page.wait_for_timeout(500)
        except Exception as err:  # noqa: BLE001
            fail(f"{title} card not on the dashboard", f"No kepler-card element appeared on /{DASHBOARD}/{VIEW}: {err}")

        if attached:
            if state["nodes"] < 1:
                fail(f"{title} no nodes", f"The card drew no g.node elements (svg present: {state.get('svg')})")
            else:
                log(f"{engine}: card drew {state['nodes']} nodes")
                summary.append(f"{engine}: card drew {state['nodes']} nodes")
                if state["nodes"] != len(NODES):
                    warn(f"{title} node count", f"Expected {len(NODES)} nodes, the card drew {state['nodes']}")

        await page.wait_for_timeout(1000)
        out.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=str(out / f"{engine}.png"))

        # The card itself: defined, no error card on the dashboard.
        defined = await page.evaluate("() => !!window.customElements.get('kepler-card')")
        if defined:
            summary.append(f"{engine}: customElements.get('kepler-card') is defined")
        if await page.evaluate(FIND_TAG_JS, "hui-error-card"):
            fail(f"{title} error card", "The dashboard shows a hui-error-card")
        else:
            summary.append(f"{engine}: no hui-error-card")

        # The URL the page actually requested must carry the version query.
        loaded = [u for u in requests if "/kepler-card.js" in u]
        want = f"/local/community/kepler-card/kepler-card.js?v={VERSION}"
        if not any(want in u for u in loaded):
            fail(f"{title} resource URL", f"Expected a request for {want}, the page loaded: {loaded or 'nothing'}")
        else:
            summary.append(f"{engine}: loaded {RESOURCE_URL}")

        # A phone-width viewport.
        await page.set_viewport_size({"width": 375, "height": 800})
        await page.reload(wait_until="domcontentloaded")
        await check_render(page, engine, "375px", out)

        # Home Assistant's dark theme, set for the user through the frontend/set_user_data websocket command
        # (the same thing the profile page's theme picker saves), then the page is reloaded to pick it up.
        await page.set_viewport_size({"width": 1280, "height": 1100})
        await ha.ws({"type": "frontend/set_user_data", "key": "selectedTheme", "value": {"theme": "default", "dark": True}})
        await page.reload(wait_until="domcontentloaded")
        try:
            await page.wait_for_function(DARK_JS, timeout=30000)
        except Exception:  # noqa: BLE001
            fail(f"{title} dark theme", "Home Assistant never reported hass.themes.darkMode after setting the dark theme")
        await check_render(page, engine, "dark", out)
        await ha.ws({"type": "frontend/set_user_data", "key": "selectedTheme", "value": {"theme": "default", "dark": False}})

        for err in page_errors:
            if "kepler" in err.lower():
                fail(f"{title} page error", err[:1500])
        for kind, text in console:
            if kind == "error" and "kepler" in text.lower():
                fail(f"{title} console error", text[:1500])
        other = [e.splitlines()[0] for e in page_errors if "kepler" not in e.lower()]
        if other:
            log(f"{engine}: {len(other)} page error(s) not about Kepler (ignored): {other[:5]}")
    finally:
        await browser.close()


# ---------------------------------------------------------------- main commands


def container_logs(name: str) -> None:
    """Print the end of the container's log, so a failed run shows what Home Assistant said."""
    try:
        res = subprocess.run(["docker", "logs", "--tail", "200", name], capture_output=True, text=True, timeout=60)
        print(f"::group::docker logs {name} (last 200 lines)\n{res.stdout}{res.stderr}\n::endgroup::", flush=True)
    except Exception as err:  # noqa: BLE001
        log(f"Couldn't read the logs of {name}: {err}")


async def run(args) -> int:
    import aiohttp  # noqa: PLC0415
    from playwright.async_api import async_playwright  # noqa: PLC0415

    out = pathlib.Path(args.out)
    timeout = aiohttp.ClientTimeout(total=600)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        ha = HA(session, args.url)
        try:
            await ha.onboard()
            config = await ha.get("/api/config")
            summary.append(f"Home Assistant {config.get('version')}")
            await publish_tree(ha)
            await make_dashboard(ha)
        except Exception as err:  # noqa: BLE001
            fail("Home Assistant setup failed", f"{type(err).__name__}: {err}")
            report("E2E failed")
            return 1
        async with async_playwright() as pw:
            for engine in args.browsers.split(","):
                try:
                    await check_browser(pw, engine.strip(), ha, out)
                except Exception as err:  # noqa: BLE001
                    fail(f"{engine}: browser check crashed", f"{type(err).__name__}: {err}")
    report("E2E failed" if failures else "E2E passed")
    if failures:
        log(f"\n{len(failures)} check(s) failed")
        return 1
    log("\nAll checks passed")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="onboard, add the card and check it in real browsers")
    r.add_argument("--url", default="http://localhost:8123")
    r.add_argument("--out", default="e2e-artifacts", help="where screenshots go")
    r.add_argument("--browsers", default="chromium,webkit")
    r.add_argument("--container", help="Docker container name; its log is printed when a check fails")
    args = parser.parse_args()

    code = asyncio.run(run(args))
    if code and args.container:
        container_logs(args.container)
    return code


if __name__ == "__main__":
    sys.exit(main())
