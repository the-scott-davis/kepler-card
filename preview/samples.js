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

// A small home network: 41 nodes, 7 hubs and 34 devices, in four tiers.
// Row: [key, parent, label, icon, extra tags, options]. Options: status, entity.
const HOME_ROWS = [
  ["router", null, "Router", "mdi:router-network", ["topology:wired"], {}],
  ["core-switch", "router", "Core Switch", "mdi:switch", ["topology:wired"], {}],
  ["new-devices", "router", "New devices", "mdi:help-network", [], { status: "new" }],
  ["weather-station", "router", "Weather Station", "mdi:weather-partly-cloudy", ["topology:wifi", "area:patio"], { entity: "sensor.weather_station" }],
  ["office-switch", "core-switch", "Office Switch", "mdi:switch", ["topology:wired", "area:office"], {}],
  ["den-ap", "core-switch", "Den AP", "mdi:access-point", ["topology:wifi", "area:den"], {}],
  ["hallway-ap", "core-switch", "Hallway AP", "mdi:access-point", ["topology:wifi", "area:hallway"], {}],
  ["patio-ap", "core-switch", "Patio AP", "mdi:access-point", ["topology:wifi", "area:patio"], {}],

  ["soundbar", "office-switch", "Soundbar", "mdi:soundbar", ["area:office"], { entity: "media_player.soundbar" }],
  ["printer", "office-switch", "Printer", "mdi:printer", ["area:office"], {}],
  ["nas", "office-switch", "NAS", "mdi:nas", ["area:office"], { entity: "sensor.nas" }],
  ["home-assistant", "office-switch", "Home Assistant", "mdi:home-assistant", ["area:office"], {}],
  ["game-console", "office-switch", "Game Console", "mdi:controller", ["area:office", "power:sleepy"], { status: "recent" }],
  ["desktop", "office-switch", "Desktop", "mdi:desktop-tower-monitor", ["area:office"], { entity: "sensor.desktop" }],
  ["bookshelf-speaker", "office-switch", "Bookshelf Speaker", "mdi:speaker", ["area:office"], {}],

  ["air-purifier", "den-ap", "Air Purifier", "mdi:air-purifier", ["area:den"], { entity: "fan.air_purifier" }],
  ["doorbell", "den-ap", "Doorbell", "mdi:doorbell-video", ["area:den"], {}],
  ["family-room-tv", "den-ap", "Family Room TV", "mdi:television", ["area:den", "power:sleepy"], {}],
  ["guest-streamer", "den-ap", "Guest Streamer", "mdi:cast", ["area:den"], { status: "stale" }],
  ["indoor-cam-2", "den-ap", "Indoor Cam 2", "mdi:cctv", ["area:den"], { entity: "camera.indoor_cam_2" }],
  ["robot-vac-1", "den-ap", "Robot Vac 1", "mdi:robot-vacuum", ["area:den"], {}],
  ["smart-display", "den-ap", "Smart Display", "mdi:tablet-dashboard", ["area:den"], { entity: "media_player.smart_display" }],
  ["smart-plug", "den-ap", "Smart Plug", "mdi:power-plug", ["area:den"], {}],
  ["smoke-alarm-hub", "den-ap", "Smoke Alarm Hub", "mdi:smoke-detector", ["area:den"], { entity: "binary_sensor.smoke_alarm_hub" }],
  ["streamer", "den-ap", "Streamer", "mdi:cast-variant", ["area:den", "power:sleepy"], {}],
  ["thermostat-1f", "den-ap", "Thermostat 1F", "mdi:thermostat", ["area:den"], { entity: "climate.thermostat_1f" }],

  ["bedroom-tv", "hallway-ap", "Bedroom TV", "mdi:television", ["area:hallway"], {}],
  ["e-reader", "hallway-ap", "E-Reader", "mdi:book-open-variant", ["area:hallway"], {}],
  ["indoor-cam-1", "hallway-ap", "Indoor Cam 1", "mdi:cctv", ["area:hallway"], { entity: "camera.indoor_cam_1" }],
  ["laptop", "hallway-ap", "Laptop", "mdi:laptop", ["area:hallway"], { entity: "sensor.laptop" }],
  ["smart-watch", "hallway-ap", "Smart Watch", "mdi:watch", ["area:hallway", "power:sleepy"], {}],
  ["tablet", "hallway-ap", "Tablet", "mdi:tablet", ["area:hallway"], { entity: "sensor.tablet" }],
  ["thermostat-2f", "hallway-ap", "Thermostat 2F", "mdi:thermostat", ["area:hallway"], { entity: "climate.thermostat_2f" }],
  ["vr-headset", "hallway-ap", "VR Headset", "mdi:virtual-reality", ["area:hallway", "power:sleepy"], { status: "recent" }],

  ["garage-door-1", "patio-ap", "Garage Door 1", "mdi:garage", ["area:patio"], { entity: "cover.garage_door_1" }],
  ["garage-door-2", "patio-ap", "Garage Door 2", "mdi:garage", ["area:patio"], { entity: "cover.garage_door_2" }],
  ["freezer-sensor", "patio-ap", "Freezer Sensor", "mdi:fridge-industrial", ["area:patio"], {}],
  ["shop-lights", "patio-ap", "Shop Lights", "mdi:lightbulb-group", ["area:patio"], { entity: "light.shop_lights" }],
  ["sprinklers", "patio-ap", "Sprinklers", "mdi:sprinkler", ["area:patio"], {}],

  ["device-53-91", "new-devices", "Device 53:91", "mdi:lan-connect", [], { status: "new" }],
  // Deliberately not a known status, to exercise the unknown fallback.
  ["esp-005391", "new-devices", "esp-005391", "mdi:chip", [], { status: "possible_hub" }],
];

// Devices take their topology from the switch or access point they hang off.
const HOME_TOPOLOGY = { "office-switch": "topology:wired", "den-ap": "topology:wifi", "hallway-ap": "topology:wifi", "patio-ap": "topology:wifi" };

function homeNodes(rows) {
  return rows.map((r) => {
    const n = { key: r[0], status: r[5].status || "online", icon: r[3], label: r[2], tags: r[4].slice() };
    if (HOME_TOPOLOGY[r[1]]) n.tags.unshift(HOME_TOPOLOGY[r[1]]);
    if (r[1]) n.parent = r[1];
    if (r[5].entity) n.entity = r[5].entity;
    return n;
  });
}

export const home = homeNodes(HOME_ROWS);

// One AP device moves to another AP, one goes stale, one new device appears.
export const homeChanged = home
  .map((n) => {
    if (n.key === "laptop") return Object.assign({}, n, { parent: "den-ap", tags: ["topology:wifi", "area:den"] });
    if (n.key === "smart-plug") return Object.assign({}, n, { status: "stale" });
    return n;
  })
  .concat([{ key: "pixel-phone", parent: "den-ap", status: "new", icon: "mdi:cellphone", label: "Pixel Phone", tags: ["topology:wifi", "area:den"] }]);

export const SAMPLES = {
  home: { nodes: home, changed: homeChanged },
  basic: { nodes: basic, changed: basicChanged },
  deep: { nodes: deep, changed: deepChanged },
  broken: { nodes: broken, changed: basic },
  empty: { nodes: [], changed: basic },
};
