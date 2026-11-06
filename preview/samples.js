// Sample node arrays for the preview page. Pure data, no DOM.
export const basic = [
  { key: "router", status: "online", icon: "mdi:router-wireless", label: "Router", entity: "sensor.router", tags: ["topology:wifi", "floor:down"] },
  { key: "lamp", parent: "router", status: "online", icon: "mdi:lightbulb", label: "Lamp", entity: "light.lamp", tags: ["topology:wifi", "floor:up"] },
  { key: "hub-zigbee", parent: "router", status: "recent", icon: "mdi:zigbee", label: "Zigbee hub", tags: ["topology:zigbee", "floor:down"] },
  { key: "door-sensor", parent: "hub-zigbee", status: "stale", icon: "mdi:door", label: "Door sensor", entity: "binary_sensor.door", tags: ["topology:zigbee", "floor:down", "battery"], extra: { battery: 41 } },
];

export const basicChanged = [
  basic[0],
  { key: "lamp", parent: "router", status: "stale", icon: "mdi:lightbulb", label: "Lamp (moved)", entity: "light.lamp", tags: ["topology:wifi", "floor:up"] },
  basic[2],
  basic[3],
  { key: "window-sensor", parent: "hub-zigbee", status: "new", icon: "mdi:door", label: "Window sensor", tags: ["topology:zigbee", "floor:up"] },
  { key: "phone", parent: "router", status: "online", icon: "mdi:cellphone", label: "Phone", tags: ["topology:wifi"] },
];

function chain() {
  return [
    { key: "gw", status: "online", icon: "mdi:router-wireless", label: "Gateway", tags: ["topology:wifi", "floor:down"] },
    { key: "sw1", parent: "gw", status: "online", icon: "mdi:switch", label: "Core switch", tags: ["topology:wired", "floor:down"] },
    { key: "sw2", parent: "sw1", status: "online", icon: "mdi:switch", label: "Floor switch", tags: ["topology:wired", "floor:up"] },
    { key: "ap", parent: "sw2", status: "recent", icon: "mdi:router-wireless", label: "Access point", tags: ["topology:wifi", "floor:up"] },
    { key: "zb", parent: "ap", status: "online", icon: "mdi:zigbee", label: "Zigbee coordinator", tags: ["topology:zigbee", "floor:up"] },
    { key: "phone", parent: "ap", status: "online", icon: "mdi:cellphone", label: "Phone", tags: ["topology:wifi", "floor:up"] },
    { key: "door", parent: "zb", status: "stale", icon: "mdi:door", label: "Door sensor", tags: ["topology:zigbee", "floor:up"] },
    { key: "bulb", parent: "zb", status: "online", icon: "mdi:lightbulb", label: "Bulb", tags: ["topology:zigbee"] },
    { key: "plug", parent: "zb", status: "new", icon: "mdi:lan-connect", label: "Plug", tags: ["floor:up"] },
    { key: "tv", parent: "sw1", status: "online", icon: "mdi:lan-connect", label: "TV", tags: ["topology:wired", "floor:down"] },
    { key: "nas", parent: "sw1", status: "online", icon: "mdi:lan-connect", label: "NAS", tags: ["topology:wired", "plain-tag"] },
    { key: "lamp", parent: "gw", status: "recent", icon: "mdi:lightbulb", label: "Lamp", tags: ["floor:down"] },
  ];
}
export const deep = chain();

export const deepChanged = chain()
  .filter((n) => n.key !== "plug")
  .concat([
    { key: "sensor2", parent: "zb", status: "online", icon: "mdi:door", label: "Window sensor", tags: ["topology:zigbee", "floor:up"] },
    { key: "cam", parent: "sw2", status: "unknown", icon: "mdi:lan-connect", label: "Camera", tags: ["topology:wired", "floor:up"] },
  ]);

export const broken = [
  { key: "root", status: "online", icon: "mdi:router-wireless", label: "Root" },
  { key: "a", parent: "root", status: "online", icon: "mdi:lightbulb", label: "A" },
  { key: "a", parent: "root", status: "stale", icon: "mdi:lightbulb", label: "A duplicate" },
  { key: "c1", parent: "c2", status: "recent", icon: "mdi:switch", label: "Cycle one" },
  { key: "c2", parent: "c1", status: "recent", icon: "mdi:switch", label: "Cycle two" },
  { key: "self", parent: "self", status: "new", icon: "mdi:lan-connect", label: "Self parent" },
  { key: "orphan", parent: "nowhere", status: "bogus", label: "Unknown parent" },
  "not an object",
];

export const SAMPLES = {
  basic: { nodes: basic, changed: basicChanged },
  deep: { nodes: deep, changed: deepChanged },
  broken: { nodes: broken, changed: basic },
};
