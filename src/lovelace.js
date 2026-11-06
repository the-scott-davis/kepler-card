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
    this.options = opts;
    this.nodes = readNodes(c, this._hass);
  }

  set hass(h) {
    this._hass = h;
    const c = this._config;
    if (!c || typeof c.nodes_entity !== "string" || c.nodes_entity === "") return;
    this.nodes = readNodes(c, h);
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
