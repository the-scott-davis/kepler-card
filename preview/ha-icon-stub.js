// Minimal stand-in for Home Assistant's ha-icon: ha-icon > shadowRoot > ha-svg-icon > shadowRoot > path.
// Paths are simple placeholder shapes on a 24 grid; unknown icons get a plain circle.
(function () {
  var PATHS = {
    "mdi:router-wireless": "M4 13h16v6H4v-6m2 2v2h2v-2H6m6-12C8 3 5 4.5 3 7l1.5 1.500C6 6.500 9 5 12 5s6 1.500 7.500 3.500L21 7c-2-2.500-5-4-9-4m0 4c-2.500 0-4.500 1-6 2.500l1.500 1.500c1-1 2.500-2 4.500-2s3.500 1 4.500 2l1.500-1.500C16.500 8 14.500 7 12 7z",
    "mdi:lightbulb": "M12 2a7 7 0 0 0-4 12.700V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.300A7 7 0 0 0 12 2m-2 18v1a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1z",
    "mdi:zigbee": "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m-4 6h8v2l-5 4h5v2H8v-2l5-4H8z",
    "mdi:door": "M8 3h8a1 1 0 0 1 1 1v16h2v2H5v-2h2V4a1 1 0 0 1 1-1m6 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
    "mdi:lan-connect": "M4 5h6v4H8v2h3v-1h2v1h3V9h-2V5h6v4h-2v4h-4v2h2v4h-6v-4h2v-2H8v-2H6V9H4z",
    "mdi:switch": "M3 8h18v8H3V8m2 2v4h2v-4H5m4 0v4h2v-4H9m4 0v4h2v-4h-2m4 0v4h2v-4h-2z",
    "mdi:cellphone": "M17 19H7V5h10m0-4H7C5.900 1 5 1.900 5 3v18c0 1.100.9 2 2 2h10c1.100 0 2-.9 2-2V3c0-1.100-.9-2-2-2z"
  };
  var FALLBACK = "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z";
  var NS = "http://www.w3.org/2000/svg";

  class StubSvgIcon extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: "open" }); }
    set path(d) {
      var svg = document.createElementNS(NS, "svg");
      var p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
      this.shadowRoot.textContent = "";
      this.shadowRoot.appendChild(svg);
    }
  }
  class StubIcon extends HTMLElement {
    static get observedAttributes() { return ["icon"]; }
    constructor() { super(); this.attachShadow({ mode: "open" }); }
    connectedCallback() { this._render(); }
    attributeChangedCallback() { this._render(); }
    _render() {
      var name = this.getAttribute("icon") || "";
      var inner = this.shadowRoot.querySelector("ha-svg-icon");
      if (!inner) {
        inner = document.createElement("ha-svg-icon");
        this.shadowRoot.appendChild(inner);
      }
      inner.path = Object.prototype.hasOwnProperty.call(PATHS, name) ? PATHS[name] : FALLBACK;
    }
  }
  if (!customElements.get("ha-svg-icon")) customElements.define("ha-svg-icon", StubSvgIcon);
  if (!customElements.get("ha-icon")) customElements.define("ha-icon", StubIcon);
})();
