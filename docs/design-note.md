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
- Kind: Proposed, a node with children is always laid out as a hub whatever its `kind`.
- Kind: Proposed, a `kind` hub node with no children in the source data keeps a gap slot on the device ring, as NetOrbit gives an empty hub (line 118); a hub whose children were all hidden by a filter is a different case, covered under Filters.
- Extra: `extra` is a separate optional top-level map that Kepler never reads and hands back in the tap detail as `detail.node.extra`.
- Tree rule: Proposed, the root is the first parentless node with kind hub, or the first parentless node if none has it, and the other parentless nodes attach to the root; NetOrbit differs only in that it takes the first parentless hub (line 1013), falls back to the first hub (line 1018), never picks a non-hub as root, and attaches hubs with no known parent to the root (line 88).
- Tree rule: Proposed, a parent key matching no node attaches to the root, which matches NetOrbit (lines 88 and 92).
- Tree rule: Proposed, if no node is parentless the first node in the list becomes the root and its parent is ignored.
- Tree rule: Proposed, a node naming itself as parent counts as a cycle.
- Tree rule: Proposed, an empty node list draws an empty map with no error.
- Tree rule: Proposed, a node in a cycle attaches to the root, which matches NetOrbit re-parenting cycles to the root (line 123).
- Tree rule: Proposed, a duplicate key keeps the first node and logs a console warning, which differs from NetOrbit, where a later hub with the same key replaces the earlier one (line 1012).
- Tree rule: Proposed, a `tags` value that is not an array of strings is ignored, and NetOrbit has no tags to compare (no match to cite).
- Relationships: `parent` is the only relationship, so a node has one parent and sits in one place, and a parent can have any number of children. A later optional field can add other relationships without changing this contract.

```text
router                              status: online   icon: mdi:router-wireless  label: Router
  lamp            parent: router    status: online   icon: mdi:lightbulb        label: Lamp
  hub-zigbee      parent: router    status: recent   icon: mdi:zigbee           label: Zigbee hub
    door-sensor   parent: hub-zigbee status: stale    icon: mdi:door             label: Door sensor
```

## Data source

- The contract is an array of node objects in the shape above, set through the element's `nodes` property.
- Kepler does not care where the array comes from. NetOrbit discovers the network and populates it, and any other integration can build the same array however it likes.
- The Lovelace card has two options for the array: `nodes`, an array in the card config, and `nodes_entity`, the id of one entity whose attribute `nodes_attribute` (default `nodes`) holds the array and is read on every `hass` update.
- `nodes_entity` wins when both options are set, and a missing entity or attribute draws the empty map.
- The entity read sits in the Lovelace layer, so the drawing code never sees `hass` data, and that one named entity is all the card reads.

## What Kepler owns and what a host owns

- Kepler owns layout, rings, zoom and pan, reveal animation, share as image and video, filters, and Proposed hover tooltips.
- A tooltip shows the label only, and it is not a popup.
- A host owns data, popups and editing.
- Kepler is given the node tree and draws it, and it never fetches or stores device data itself.

## Tap hand-off

- A tap on a node hands off to the host, and Kepler shows no popup of its own.
- Proposed: Kepler always fires `kepler-node-tap` from the `kepler-card` element, bubbling and composed, with `detail: { key, node }`, where `node` is a copy of the node.
- Proposed: `kepler-node-tap` is cancelable, and a host that calls `preventDefault` on it stops `hass-more-info` for that tap.
- Proposed: a host uses `preventDefault` for edit mode and for any node type it wants to handle itself.
- Proposed: `hass-more-info` with `detail: { entityId }`, bubbling and composed as NetOrbit dispatches it (line 1800), fires only when the host turns on a `more_info` option and the node has an `entity` field, and it fires after `kepler-node-tap`.
- NetOrbit fires `hass-more-info` only when the node has an entity (line 1800).
- NetOrbit does not always fire `hass-more-info` on a tap, because it opens its own popups instead in edit mode and for its new, more and suggested nodes (lines 1795-1799).
- Proposed: the Lovelace card turns `more_info` on, and a host cancels `kepler-node-tap` to suppress the dialog where NetOrbit suppresses it today.
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
- Proposed default for `--kepler-link-color` is unset, and while it is unset a link uses its child node's status colour, because NetOrbit's CSS sets no link colour (lines 1136-1140) and passes the child's status colour to each link as its stroke (lines 239, 252 and 257, colour from line 216).
- Proposed default for `--kepler-highlight-color` is NetOrbit's highlight stroke `#60a5fa` (line 1167).
- Proposed default for `--kepler-tooltip-background` is NetOrbit's tooltip background `rgba(15,23,42,.96)` (line 1176).
- Proposed default for `--kepler-tooltip-text-color` is NetOrbit's tooltip text `#e2e8f0` (line 1176).
- Proposed: shared images and video read the same computed variables as the live view. This is a new choice with no NetOrbit precedent, because NetOrbit's share image and video use hard-coded colours.

## Older-browser rule

- The rule is: no ??, ??= or ?. in the JS.
- Proposed baseline is ES2019, which is the level that excludes all of these.
- The rule applies to the source and the shipped file, and there is no transpile step.
- Proposed: the same applies to the logical assignment operators, private class fields and class static blocks.
- The minimum browser or Home Assistant version is left for Scott to confirm.

## Packaging

- One source ships both a web component and a Lovelace card, as NetOrbit does with one file that registers the element and pushes a `window.customCards` entry (lines 2219-2228).
- Decided plan is that NetOrbit will build Kepler in a pinned release.
- NetOrbit has no reference to Kepler yet, per a search of the NetOrbit repo on 2026-11-05, and the frontend file has no mention of Kepler.
- Proposed: NetOrbit's build checks out a Kepler git tag, runs Kepler's build and includes the output, and never tracks a branch.
- Proposed: Kepler's build produces one file, `kepler-card.js`, from one source.
- This repo has no build yet.
- Proposed element name is `kepler-card`.
- Element name collisions are handled by a guard that checks `customElements.get` before calling `define`, which is the check NetOrbit's `noDefine` uses (lines 2211-2214).
- Proposed: run the guard again after `customElements.whenDefined("home-assistant")`, because NetOrbit does this so the card also lands in the registry Home Assistant swaps in after older versions first run the file (lines 2207-2218), and this applies to Home Assistant only.
- Proposed: when another class already holds `kepler-card`, Kepler keeps the existing element and logs a console warning naming the collision, rather than skipping silently as NetOrbit does (line 2213).
- Rule for the Lovelace card entry: on an element-name collision (another class already holds `kepler-card`) Kepler keeps the existing element, warns, and pushes no `window.customCards` entry. The entry is pushed only when Kepler's own class holds the name. The existing skip when an entry of the same type is already present stays, as NetOrbit does (line 2220).

## Filters

- Filters live in Kepler and are tag-based.
- Proposed: a `filters` option turns filters on, and they are off by default.
- Proposed: Kepler shows the tag chips itself when `filters` is on, built from the tags in the tree.
- Proposed: a host can preset the selection with a `selected_tags` option.
- Proposed rule 1: a tag holding a colon is `group:value`, split on the first colon, so `topology:zigbee` is the chip `zigbee` in the `topology` group, and a tag with no colon, or with nothing either side of the colon, is a plain tag. Plain tags form one group of their own. A node matches when, for every group with a selected chip, it has at least one selected tag from that group, so picks within a group mean either and picks across groups mean both. While no tag is selected every node is visible.
- Proposed rule 2: a node is visible if it matches, or has a visible descendant, or is the root.
- Proposed rule 3: everything else is hidden, including untagged nodes while any tag is selected.
- Proposed: hidden nodes leave no gap, because layout reflows over visible nodes. A hub that matches a filter but whose children are all hidden stays on the map as a bare hub with no gap slot, so no blank wedge is left on the ring, and its ring position may shift as filters change. A hub with no children in the source data still keeps its gap slot.
- Proposed: shared images and video show the current filtered view.
- NetOrbit has no tag filter today, so this is new behaviour (no match in the NetOrbit file).

## NetOrbit mapping

- Proposed: NetOrbit's hub and device node kinds map to the `kind` field (lines 1011-1016).
- Proposed: NetOrbit builds its group, more, internet and New devices nodes itself and passes them to Kepler as ordinary nodes.
- Proposed: folding and grouping stay in NetOrbit until Scott says otherwise.
