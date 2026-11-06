# Kepler design note

Kepler is an orbital map card for Home Assistant that shows Zigbee, Z-Wave, Thread and Bluetooth meshes, or any device tree, as a live radial view (source: README.md).
This note records the design for Scott to sign off, and every detail the card leaves open is marked **Proposed** so it can be overruled at review.
NetOrbit facts cite their source file in the NetOrbit repo, and nothing is stated about NetOrbit beyond those citations, except the decided packaging plan and the finding that NetOrbit has no reference to Kepler yet.

## Data shape

- Kepler draws a tree of nodes, and each node has a key, a parent, a status, an icon, a label, an optional entity and optional extra fields.
- Parent: a node names its parent by key, and a node with no parent is the root (NetOrbit does the same with its `link` attribute, see `custom_components/netorbit/frontend/netorbit-card.js`).
- Status: Proposed values are `online`, `recent`, `stale`, `new` and `unknown`, which match the NetOrbit status table in `custom_components/netorbit/frontend/netorbit-card.js`.
- Status: Proposed rule is that any status Kepler does not know is drawn as `unknown`, as NetOrbit does in the same file.
- Icon: an `mdi:` icon name, with Proposed fallback `mdi:lan-connect`, which is the NetOrbit fallback in `custom_components/netorbit/frontend/netorbit-card.js`.
- Label: the text shown for the node, and the host is responsible for choosing it.
- Entity: Proposed optional field `entity`, a Home Assistant entity id that Kepler reads only to fill `entityId` in the tap hand-off.
- Extra fields: a free-form map the host may attach (for example ip, vendor or tags), which Kepler passes through and does not interpret except for the filter tag field and the `entity` field.

```text
router            parent: none      status: online   icon: mdi:router-wireless  label: Router
  lamp            parent: router    status: online   icon: mdi:lightbulb        label: Lamp
  hub-zigbee      parent: router    status: recent   icon: mdi:zigbee           label: Zigbee hub
    door-sensor   parent: hub-zigbee status: stale    icon: mdi:door             label: Door sensor
```

## What Kepler owns and what a host owns

- Kepler owns layout, rings, zoom and pan, reveal animation, share as image and video, and filters.
- A host owns data, popups and editing.
- Kepler is given the node tree and draws it, and it never fetches or stores device data itself.

## Tap hand-off

- A tap on a node hands off to the host, and Kepler shows no popup of its own.
- Proposed, every tap fires a bubbling, composed `kepler-node-tap` CustomEvent with `detail: { key, node }`.
- Proposed, a node with an `entity` field also fires `hass-more-info` with `detail: { entityId }`, as NetOrbit does (`custom_components/netorbit/frontend/netorbit-card.js`).
- A node with no `entity` field never fires `hass-more-info`, because NetOrbit only dispatches it when the node has an entity.
- Hover tooltips are separate from the tap and do not hand off.

## Theming

- Kepler takes its look from CSS custom properties that a host can set on the element.
- Proposed names are `--kepler-background`, `--kepler-text-color`, `--kepler-status-online`, `--kepler-status-recent`, `--kepler-status-stale`, `--kepler-status-new`, `--kepler-status-unknown` and `--kepler-font-family`.
- Proposed default for the font is the Home Assistant `--ha-font-family-body` variable, which is the only host variable NetOrbit reads (`custom_components/netorbit/frontend/netorbit-card.js`).
- NetOrbit hard-codes its status colours and background in the same file, so Kepler's variables are new rather than copied.

## Older-browser rule

- The rule is: no ??, ??= or ?. in the JS.

## Packaging

- One source ships both a web component and a Lovelace card, as NetOrbit does with one file that registers the element and pushes a `window.customCards` entry (`custom_components/netorbit/frontend/netorbit-card.js`).
- Decided plan is that NetOrbit will build Kepler in a pinned release, and NetOrbit has no reference to Kepler yet.
- Proposed way to reference the pin is a git release tag of this repo, with NetOrbit copying the built file from that tag and never tracking a branch.
- Proposed element name is `kepler-card`.
- Element name collisions are handled by a guard that checks `customElements.get` before calling `define`, which is the check NetOrbit's `noDefine` uses (`custom_components/netorbit/frontend/netorbit-card.js`).
- Proposed addition is to run the guard again after `customElements.whenDefined("home-assistant")`, as NetOrbit does in the same file.
- Proposed rule for the Lovelace card entry is to skip the `window.customCards` push when an entry of the same type exists, as NetOrbit does.

## Filters

- Filters live in Kepler and are tag-based.
- Filters are off unless a host turns them on.
- Proposed tag field name is `tags`, an array of strings in the node's extra fields.
- NetOrbit has no tag filter today, so this is new behaviour (`custom_components/netorbit/frontend/netorbit-card.js`).
