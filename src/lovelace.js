import { KeplerElement, DEFAULT_OPTIONS } from "./kepler-card.js";

// The one place that knows about the Home Assistant state object. Reads exactly one entity, and nothing else.
export function readNodes(config, hass) {
  const c = config && typeof config === "object" ? config : {};
  const id = c.nodes_entity;
  if (typeof id === "string" && id !== "") {
    const states = hass && hass.states;
    const st = states ? states[id] : undefined;
    const attrs = st ? st.attributes : undefined;
    const v = attrs ? attrs[c.nodes_attribute || "nodes"] : undefined;
    return v === undefined || v === null ? [] : v;
  }
  return c.nodes || [];
}

export class KeplerCard extends KeplerElement {
  static getStubConfig() {
    return { nodes: [] };
  }

  setConfig(config) {
    const c = config && typeof config === "object" ? config : {};
    this._config = c;
    const opts = { more_info: true };
    Object.keys(DEFAULT_OPTIONS).forEach((k) => {
      if (c[k] !== undefined) opts[k] = c[k];
    });
    this._batch(() => {
      this.options = opts;
      this._rawNodes = undefined;
      this._rawSig = undefined;
      this.nodes = readNodes(c, this._hass);
    });
  }

  set hass(h) {
    this._hass = h;
    const c = this._config;
    if (!c || typeof c.nodes_entity !== "string" || c.nodes_entity === "") return;
    const raw = readNodes(c, h);
    // Home Assistant keeps the same attributes object while the entity is unchanged, so the same reference
    // means the same nodes. Skip the copy and signature work (#7). Only a reference check: never mutate raw.
    // An array mutated in place is therefore not noticed; Home Assistant replaces it on change.
    // The signature guard keeps the old outcome if a host set element.nodes directly in between.
    if (this._rawNodes !== undefined && raw === this._rawNodes && this._sig === this._rawSig) return;
    this.nodes = raw;
    this._rawNodes = raw;
    this._rawSig = this._sig;
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 12;
  }

  getGridOptions() {
    return { columns: "full", rows: "auto", min_rows: 8 };
  }
}
