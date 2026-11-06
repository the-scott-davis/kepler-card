# Kepler design note

Kepler is an orbital map card for Home Assistant that shows Zigbee, Z-Wave, Thread and Bluetooth meshes, or any device tree, as a live radial view (source: README.md).
This note records the design for Scott to sign off, details fixed by the card are stated plainly, and every choice the card left open is marked **Proposed** so it can be overruled at review.
NetOrbit citations give line numbers in `custom_components/netorbit/frontend/netorbit-card.js`, read at commit 6863e99 of the NetOrbit repo, and nothing is stated about NetOrbit beyond those citations, except the decided packaging plan and the finding that NetOrbit has no reference to Kepler yet.

## Data shape

- Core node fields are top-level: `key`, `parent`, `status`, `icon`, `label`, plus optional `entity`, `tags` and `kind`.
- Parent: a node names its parent by key, and a node with no parent is a root (NetOrbit does the same with its `link` attribute, lines 999 and 1013).
- Status: the host decides each node's status and Kepler only draws it, and Proposed values are `online`, `recent`, `stale`, `new` and `unknown`, which match the NetOrbit status table (lines 7-13).
- Status `online` means the host sees the node as up and reachable now.
- Status `recent` means the host last saw the node a little while ago.
- Status `stale` means the host has not seen the node for a long time.
- Status `new` means the host has just found the node and nobody has reviewed it.
- Status `unknown` means the host has no status for the node.
- Status: Proposed rule is that any status Kepler does not know is drawn as `unknown`, as NetOrbit does (lines 1001 and 216).
- Icon: an `mdi:` icon name, with Proposed fallback `mdi:lan-connect`, which is the NetOrbit fallback (line 995).
- Label: the text shown for the node, and the host is responsible for choosing it.
- Entity: Proposed optional top-level field `entity`, a Home Assistant entity id that Kepler reads only to fill `entityId` in the tap hand-off.
- Tags: Proposed optional top-level field `tags`, an array of strings that Kepler reads only for filters.
- Kind: Proposed optional field `kind`, either `hub` or `device`, and when absent a node with children is a hub and a leaf is a device, because layout puts hubs on inner rings and devices on the outer ring (lines 80-95).
- Extra: `extra` is a separate optional top-level map that Kepler never reads and hands back in the tap detail.
- Tree rule: Proposed, with several parentless nodes the first is the root and the rest attach to it, which matches NetOrbit taking the first parentless hub as root (line 1013) and attaching hubs with no known parent to the root (line 88).
- Tree rule: Proposed, a parent key matching no node attaches to the root, which matches NetOrbit (lines 88 and 92).
- Tree rule: Proposed, a node in a cycle attaches to the root, which matches NetOrbit re-parenting cycles to the root (line 123).
- Tree rule: Proposed, a duplicate key keeps the first node and logs a console warning, which differs from NetOrbit, where a later hub with the same key replaces the earlier one (line 1012).
- Tree rule: Proposed, a `tags` value that is not an array of strings is ignored, and NetOrbit has no tags to compare (no match to cite).

```text
router            parent: none      status: online   icon: mdi:router-wireless  label: Router
  lamp            parent: router    status: online   icon: mdi:lightbulb        label: Lamp
  hub-zigbee      parent: router    status: recent   icon: mdi:zigbee           label: Zigbee hub
    door-sensor   parent: hub-zigbee status: stale    icon: mdi:door             label: Door sensor
```

## What Kepler owns and what a host owns

- Kepler owns layout, rings, zoom and pan, reveal animation, share as image and video, filters, and Proposed hover tooltips.
- A tooltip shows the label only, and it is not a popup.
- A host owns data, popups and editing.
- Kepler is given the node tree and draws it, and it never fetches or stores device data itself.

## Tap hand-off

- A tap on a node hands off to the host, and Kepler shows no popup of its own.
- Proposed: Kepler always fires `kepler-node-tap` from the `kepler-card` element, bubbling and composed, with `detail: { key, node }`, where `node` is a copy of the node.
- Proposed: `hass-more-info` with `detail: { entityId }` fires only when the host turns on a `more_info` option and the node has an `entity` field, and it fires after `kepler-node-tap`.
- NetOrbit fires `hass-more-info` only when the node has an entity (line 1800).
- Proposed: the Lovelace card turns `more_info` on, so Home Assistant behaves as NetOrbit does today.
- Proposed: other hosts get one event, so a host with its own popup never gets a second dialog.
- Hover tooltips are separate from the tap and do not hand off.

## Theming

- Kepler takes its look from CSS custom properties that a host can set on the element.
- Proposed names are `--kepler-background`, `--kepler-text-color`, `--kepler-status-online`, `--kepler-status-recent`, `--kepler-status-stale`, `--kepler-status-new`, `--kepler-status-unknown`, `--kepler-font-family`, `--kepler-ring-color`, `--kepler-link-color`, `--kepler-highlight-color`, `--kepler-tooltip-background` and `--kepler-tooltip-text-color`.
- Proposed default for `--kepler-background` is NetOrbit's card background, `radial-gradient(ellipse at 50% 48%, #13213a 0%, #0b1220 55%, #070b14 100%)` (line 1122).
- Proposed default for `--kepler-text-color` is NetOrbit's `#e2e8f0` (line 1122).
- Proposed defaults for the status variables are NetOrbit's colours: online `#34d399`, recent `#fbbf24`, stale `#f87171`, new `#c084fc` and unknown `#64748b` (lines 7-13).
- Proposed default for `--kepler-font-family` is the Home Assistant `--ha-font-family-body` variable, with NetOrbit's fallback `Roboto, system-ui, sans-serif` (lines 1122 and 1134).
- Proposed default for `--kepler-ring-color` is NetOrbit's ring stroke `rgba(148,163,184,.07)` (line 1135).
- Proposed default for `--kepler-link-color` is default to be set in the build, because NetOrbit sets no single link colour in its CSS (lines 1136-1140).
- Proposed default for `--kepler-highlight-color` is NetOrbit's highlight stroke `#60a5fa` (line 1167).
- Proposed default for `--kepler-tooltip-background` is NetOrbit's tooltip background `rgba(15,23,42,.96)` (line 1176).
- Proposed default for `--kepler-tooltip-text-color` is NetOrbit's tooltip text `#e2e8f0` (line 1176).
- Proposed: shared images and video read the same computed variables as the live view.

## Older-browser rule

- The rule is: no ??, ??= or ?. in the JS.
- Proposed baseline is ES2019, which is the level that excludes all of these.
- The rule applies to the source and the shipped file, and there is no transpile step.
- Proposed: the same applies to the logical assignment operators, private class fields and class static blocks.
- The minimum browser or Home Assistant version is left for Scott to confirm.

## Packaging

- One source ships both a web component and a Lovelace card, as NetOrbit does with one file that registers the element and pushes a `window.customCards` entry (lines 2211-2221).
- Decided plan is that NetOrbit will build Kepler in a pinned release.
- NetOrbit has no reference to Kepler yet, per a search of the NetOrbit repo on 2026-11-05, and the frontend file has no mention of Kepler.
- Proposed: NetOrbit's build checks out a Kepler git tag, runs Kepler's build and includes the output, and never tracks a branch.
- Proposed: Kepler's build produces one file, `kepler-card.js`, from one source.
- This repo has no build yet.
- Proposed element name is `kepler-card`.
- Element name collisions are handled by a guard that checks `customElements.get` before calling `define`, which is the check NetOrbit's `noDefine` uses (lines 2211-2214).
- Proposed: run the guard again after `customElements.whenDefined("home-assistant")`, because NetOrbit does this so the card also lands in the registry Home Assistant swaps in after older versions first run the file (lines 2207-2218), and this applies to Home Assistant only.
- Proposed: when another class already holds `kepler-card`, Kepler keeps the existing element and logs a console warning naming the collision, rather than skipping silently as NetOrbit does (line 2213).
- Proposed rule for the Lovelace card entry is to skip the `window.customCards` push when an entry of the same type exists, as NetOrbit does (line 2220).

## Filters

- Filters live in Kepler and are tag-based.
- Proposed: a `filters` option turns filters on, and they are off by default.
- Proposed rule: a node matches if it has any selected tag.
- Proposed rule: while any tag is selected, untagged nodes are hidden.
- Proposed rule: a hidden node's descendants are hidden unless they match.
- Proposed rule: a matching node keeps its ancestors visible.
- Proposed rule: the root always shows.
- NetOrbit has no tag filter today, so this is new behaviour (no match in the NetOrbit file).

## NetOrbit mapping

- Proposed: NetOrbit's hub and device node kinds map to the `kind` field (lines 1011-1016).
- Proposed: NetOrbit builds its group, more, internet and New devices nodes itself and passes them to Kepler as ordinary nodes.
- Proposed: folding and grouping stay in NetOrbit until Scott says otherwise.
