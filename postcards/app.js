const map = L.map("map", { zoomControl: false, worldCopyJump: true }).setView([20, 0], 2);
L.control.zoom({ position: "bottomright" }).addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const clusters = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 46,
  spiderfyOnMaxZoom: true,
  zoomToBoundsOnClick: false,
});
const individualMarkers = L.layerGroup().addTo(map);
const locationMarkers = [];
let clustersEnabled = false;

const summary = document.querySelector("#summary");
const emptyState = document.querySelector("#emptyState");
const stats = document.querySelector("#stats");
const statsDialog = document.querySelector("#statsDialog");
const statsDialogTitle = document.querySelector("#statsDialogTitle");
const statsDialogBody = document.querySelector("#statsDialogBody");
document.querySelector("#statsDialogClose").addEventListener("click", () => statsDialog.close());

const EU_COUNTRIES = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"]);
const CONTINENTS = {
  Africa: new Set("DZ AO BJ BW BF BI CV CM CF TD KM CD CG CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW".split(" ")),
  Asia: new Set("AF AM AZ BH BD BT BN KH CN GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE".split(" ")),
  Europe: new Set("AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA".split(" ")),
  "North America": new Set("AG BS BB BZ CA CR CU DM DO SV GD GT HT HN JM MX NI PA KN LC VC TT US GL BM PM".split(" ")),
  Oceania: new Set("AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU NC PF GU AS MP CK NU WF".split(" ")),
  "South America": new Set("AR BO BR CL CO EC GY PY PE SR UY VE FK GF".split(" ")),
};
const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
  "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
];
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function continentFor(countryCode) {
  const code = String(countryCode || "").toUpperCase();
  return Object.entries(CONTINENTS).find(([, codes]) => codes.has(code))?.[0] || "Unknown";
}

function friendKey(postcard) {
  return String(postcard.friendUsername || "").trim().toLowerCase();
}

function distinctFriends(postcards) {
  return new Set(postcards.map(friendKey).filter(Boolean));
}

function countryName(code, postcards = []) {
  return postcards.find((item) => item.countryCode === code)?.country || regionNames.of(code) || code;
}

function detailRows(items, checklist = false) {
  return `<div class="detail-list">${items.map((item) => `
    <div class="detail-row ${checklist && !item.visited ? "missing" : ""}">
      ${checklist ? `<span class="check">${item.visited ? "&#10003;" : "&ndash;"}</span>` : ""}
      <span>${escapeHtml(item.label)}</span>
      ${item.meta ? `<small>${escapeHtml(item.meta)}</small>` : ""}
    </div>`).join("")}</div>`;
}

function openStats(title, body) {
  statsDialogTitle.textContent = title;
  statsDialogBody.innerHTML = body;
  statsDialog.showModal();
}

function renderStats(postcards) {
  const countries = new Set(postcards.map((item) => item.countryCode).filter(Boolean));
  const euCountries = new Set([...countries].filter((code) => EU_COUNTRIES.has(code)));
  const usStates = new Set(postcards.filter((item) => item.countryCode === "US").map((item) => item.state).filter(Boolean));
  const continentFriends = new Map(Object.keys(CONTINENTS).map((name) => [name, distinctFriends(postcards.filter((item) => continentFor(item.countryCode) === name))]));
  summary.innerHTML = `<button type="button" data-stat="cards"><strong>${postcards.length}</strong><span>cards</span></button><button type="button" data-stat="countries"><strong>${countries.size}</strong><span>countries</span></button>`;
  const collectionTiles = [["EU countries", `${euCountries.size}/27`, "eu"], ["US states", `${usStates.size}/50`, "us"]];
  const continentTiles = Object.keys(CONTINENTS).map((name) => [name, continentFriends.get(name).size, `continent:${name}`]);
  const tiles = (items) => items.map(([label, value, key]) => `<button type="button" class="stat" data-stat="${escapeHtml(key)}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></button>`).join("");
  stats.innerHTML = `<div class="stat-group">${tiles(collectionTiles)}</div><div class="stat-section"><span class="stat-label">Distinct friends by continent</span><div class="stat-group continents">${tiles(continentTiles)}</div></div>`;
  stats.hidden = false;

  const countryRows = [...countries].sort((a, b) => countryName(a, postcards).localeCompare(countryName(b, postcards))).map((code) => {
    const cards = postcards.filter((item) => item.countryCode === code);
    return { label: countryName(code, postcards), meta: `${cards.length} cards · ${distinctFriends(cards).size} friends` };
  });
  const handlers = {
    cards: () => openStats("Postcards by country", detailRows(countryRows)),
    countries: () => openStats("Countries visited", detailRows(countryRows)),
    eu: () => openStats("European Union countries", detailRows([...EU_COUNTRIES].map((code) => ({ label: countryName(code), visited: euCountries.has(code) })).sort((a, b) => a.label.localeCompare(b.label)), true)),
    us: () => openStats("United States", detailRows(US_STATES.map((state) => ({ label: state, visited: usStates.has(state) })), true)),
  };
  document.querySelectorAll("[data-stat]").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.stat;
    if (handlers[key]) return handlers[key]();
    if (!key.startsWith("continent:")) return;
    const continent = key.slice("continent:".length);
    const cards = postcards.filter((item) => continentFor(item.countryCode) === continent);
    const codes = [...new Set(cards.map((item) => item.countryCode).filter(Boolean))];
    const rows = codes.map((code) => {
      const countryCards = cards.filter((item) => item.countryCode === code);
      return { label: countryName(code, postcards), meta: `${distinctFriends(countryCards).size} friends` };
    }).sort((a, b) => a.label.localeCompare(b.label));
    openStats(`${continent}: ${distinctFriends(cards).size} distinct friends`, detailRows(rows));
  }));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function card(postcard) {
  const friend = postcard.friendUsername ? `<span>From ${escapeHtml(postcard.friendUsername)}</span>` : "";
  return `<article class="postcard-card">
    <img src="${escapeHtml(postcard.image)}" alt="Postcard from ${escapeHtml(postcard.stopName)}" loading="lazy">
    <strong>${escapeHtml(postcard.stopName)}</strong>
    <span>${escapeHtml(postcard.locationText || postcard.geocodedName)}</span>
    ${friend}
  </article>`;
}

function clusterGallery(markers) {
  const postcards = markers.flatMap((marker) => marker.postcardGroup || [marker.postcardData]).filter(Boolean);
  return `<section class="cluster-gallery" aria-label="Postcards in this area">${postcards.map(card).join("")}</section>`;
}

clusters.on("clusterclick", (event) => {
  L.popup({ className: "cluster-popup", maxWidth: 560, closeButton: true })
    .setLatLng(event.layer.getLatLng())
    .setContent(clusterGallery(event.layer.getAllChildMarkers()))
    .openOn(map);
});

const ClusterToggle = L.Control.extend({
  options: { position: "bottomright" },
  onAdd() {
    const button = L.DomUtil.create("button", "cluster-toggle leaflet-bar");
    button.type = "button";
    button.title = "Toggle regional postcard clusters";
    button.setAttribute("aria-pressed", "false");
    button.textContent = "Pins";
    L.DomEvent.disableClickPropagation(button);
    L.DomEvent.on(button, "click", () => {
      clustersEnabled = !clustersEnabled;
      map.closePopup();
      if (clustersEnabled) {
        map.removeLayer(individualMarkers);
        clusters.clearLayers();
        clusters.addLayers(locationMarkers);
        map.addLayer(clusters);
      } else {
        map.removeLayer(clusters);
        individualMarkers.clearLayers();
        locationMarkers.forEach((marker) => individualMarkers.addLayer(marker));
        map.addLayer(individualMarkers);
      }
      button.textContent = clustersEnabled ? "Clusters" : "Pins";
      button.setAttribute("aria-pressed", String(clustersEnabled));
    });
    return button;
  },
});
new ClusterToggle().addTo(map);

fetch("data/postcards.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((catalog) => {
    const postcards = (catalog.postcards || []).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
    renderStats(postcards);
    emptyState.hidden = postcards.length !== 0;
    const bounds = [];
    const locations = new Map();
    postcards.forEach((postcard) => {
      // Five decimal places keeps genuinely shared coordinates under one pin
      // without merging separate nearby PokéStops.
      const key = `${postcard.lat.toFixed(5)},${postcard.lon.toFixed(5)}`;
      if (!locations.has(key)) locations.set(key, []);
      locations.get(key).push(postcard);
    });
    locations.forEach((group) => {
      const postcard = group[0];
      const marker = L.marker([postcard.lat, postcard.lon], {
        icon: L.divIcon({ className: "", html: '<div class="postcard-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 20] }),
        title: group.length === 1 ? postcard.stopName : `${group.length} postcards at this location`,
      });
      marker.postcardData = postcard;
      marker.postcardGroup = group;
      const content = group.length === 1 ? card(postcard) : clusterGallery([marker]);
      marker.bindPopup(content, { maxWidth: group.length === 1 ? 244 : 560 });
      marker.bindTooltip(content, { className: "postcard-tooltip", direction: "top", offset: [0, -16], opacity: 1 });
      marker.on("mouseover", () => marker.openTooltip());
      marker.on("mouseout", () => marker.closeTooltip());
      marker.on("click popupopen", () => marker.closeTooltip());
      locationMarkers.push(marker);
      individualMarkers.addLayer(marker);
      bounds.push([postcard.lat, postcard.lon]);
    });
    if (bounds.length === 1) map.setView(bounds[0], 11);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [70, 70], maxZoom: 11 });
  })
  .catch((error) => {
    summary.textContent = "Map data unavailable";
    emptyState.hidden = false;
    emptyState.querySelector("span").textContent = error.message;
  });
