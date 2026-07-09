const DATA_PATHS = {
  routes: "./data/output/routes.geojson",
  stops: "./data/output/stops.geojson",
  stopRoutes: "./data/output/stop_routes.json",
  summary: "./data/output/route_summary.json",
};

const DEFAULT_VIEW = {
  center: [-27.5245, 153.0515],
  zoom: 12,
};

const STORAGE_KEYS = {
  selectedRoutes: "brisbane-bus-routes:selectedRoutes",
  homeStop: "brisbane-bus-routes:homeStop",
};

const map = L.map("map", {
  zoomControl: true,
  preferCanvas: true,
}).setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const routeLayerGroup = L.layerGroup().addTo(map);
const labelLayerGroup = L.layerGroup().addTo(map);
const stopLayerGroup = L.layerGroup().addTo(map);

const state = {
  routeFeatures: [],
  stopFeatures: [],
  stopRoutes: {},
  summary: null,
  selectedRoutes: new Set(),
  focusRoute: null,
  highlightedStopId: null,
  interchangesOnly: false,
  searchTerm: "",
  routeLayersByNumber: new Map(),
  stopLayerById: new Map(),
  labelLayersByNumber: new Map(),
};

const els = {
  routeList: document.querySelector("#route-list"),
  datasetStatus: document.querySelector("#dataset-status"),
  selectionPanel: document.querySelector("#selection-panel"),
  selectionContent: document.querySelector("#selection-content"),
  showAllBtn: document.querySelector("#show-all-btn"),
  clearBtn: document.querySelector("#clear-btn"),
  resetBtn: document.querySelector("#reset-btn"),
  clearFocusBtn: document.querySelector("#clear-focus-btn"),
  searchInput: document.querySelector("#search-input"),
  interchangesOnlyToggle: document.querySelector("#interchanges-only-toggle"),
  mapMessage: document.querySelector("#map-message"),
  popupTemplate: document.querySelector("#stop-popup-template"),
};

initialize().catch((error) => {
  console.error(error);
  els.datasetStatus.textContent = "Data failed to load.";
  showMapMessage("Could not load route data. Run the build script and serve the app over HTTP.");
});

async function initialize() {
  bindControls();

  const [routesGeoJson, stopsGeoJson, stopRoutes, summary] = await Promise.all([
    fetchJson(DATA_PATHS.routes),
    fetchJson(DATA_PATHS.stops),
    fetchJson(DATA_PATHS.stopRoutes),
    fetchJson(DATA_PATHS.summary),
  ]);

  state.routeFeatures = routesGeoJson.features ?? [];
  state.stopFeatures = stopsGeoJson.features ?? [];
  state.stopRoutes = stopRoutes;
  state.summary = summary;

  const availableRoutes = summary.routes.map((route) => route.route_short_name);
  const persistedRoutes = readPersistedRoutes(availableRoutes);
  state.selectedRoutes = new Set(persistedRoutes.length ? persistedRoutes : availableRoutes);

  buildRouteIndex();
  renderRouteControls();
  renderMapLayers();
  renderSelectionPanel();
  fitVisibleBounds();

  const missingCount = summary.missing_target_routes?.length ?? 0;
  els.datasetStatus.textContent = `${availableRoutes.length} routes loaded${missingCount ? `, ${missingCount} missing from feed` : ""}.`;
}

function bindControls() {
  els.showAllBtn.addEventListener("click", () => {
    const allRoutes = state.summary?.routes.map((route) => route.route_short_name) ?? [];
    state.selectedRoutes = new Set(allRoutes);
    state.focusRoute = null;
    persistRoutes();
    refreshUi();
    fitVisibleBounds();
  });

  els.clearBtn.addEventListener("click", () => {
    state.selectedRoutes = new Set();
    state.focusRoute = null;
    persistRoutes();
    refreshUi();
  });

  els.resetBtn.addEventListener("click", () => {
    state.focusRoute = null;
    state.highlightedStopId = null;
    refreshUi();
    fitVisibleBounds(true);
  });

  els.clearFocusBtn.addEventListener("click", () => {
    state.focusRoute = null;
    state.highlightedStopId = null;
    refreshUi();
  });

  els.searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim().toLowerCase();
    renderRouteControls();
    refreshStopVisibility();
  });

  els.interchangesOnlyToggle.addEventListener("change", (event) => {
    state.interchangesOnly = event.target.checked;
    refreshStopVisibility();
  });
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed for ${path}: ${response.status}`);
  }
  return response.json();
}

function buildRouteIndex() {
  state.routeLayersByNumber.clear();
  state.labelLayersByNumber.clear();
  for (const route of state.summary.routes) {
    state.routeLayersByNumber.set(route.route_short_name, []);
    state.labelLayersByNumber.set(route.route_short_name, []);
  }
}

function renderRouteControls() {
  const searchTerm = state.searchTerm;
  const routeMarkup = [];

  for (const route of state.summary.routes) {
    const haystack = `${route.route_short_name} ${route.route_long_name}`.toLowerCase();
    if (searchTerm && !haystack.includes(searchTerm) && !route.stop_names_search.includes(searchTerm)) {
      continue;
    }

    const checked = state.selectedRoutes.has(route.route_short_name) ? "checked" : "";
    const dimmed = state.focusRoute && state.focusRoute !== route.route_short_name ? "is-dimmed" : "";
    routeMarkup.push(`
      <label class="route-toggle ${dimmed}" data-route="${route.route_short_name}">
        <span class="route-toggle__meta">
          <span class="route-badge" style="background:${route.display_color}; color:${route.text_color};">${route.route_short_name}</span>
          <span class="route-toggle__text">
            <strong>${route.route_long_name}</strong>
            <span class="route-toggle__name">${route.direction_summary}</span>
          </span>
        </span>
        <input type="checkbox" data-route-checkbox="${route.route_short_name}" ${checked}>
      </label>
    `);
  }

  els.routeList.innerHTML = routeMarkup.join("") || "<p class=\"subtle\">No matching routes or stops.</p>";

  for (const input of els.routeList.querySelectorAll("[data-route-checkbox]")) {
    input.addEventListener("change", (event) => {
      const routeNumber = event.target.getAttribute("data-route-checkbox");
      if (event.target.checked) {
        state.selectedRoutes.add(routeNumber);
      } else {
        state.selectedRoutes.delete(routeNumber);
        if (state.focusRoute === routeNumber) {
          state.focusRoute = null;
        }
      }
      persistRoutes();
      refreshUi();
    });
  }

  for (const row of els.routeList.querySelectorAll("[data-route]")) {
    row.addEventListener("click", (event) => {
      if (event.target instanceof HTMLInputElement) {
        return;
      }
      const routeNumber = row.getAttribute("data-route");
      focusRoute(routeNumber);
    });
  }
}

function renderMapLayers() {
  routeLayerGroup.clearLayers();
  labelLayerGroup.clearLayers();
  stopLayerGroup.clearLayers();
  state.stopLayerById.clear();
  buildRouteIndex();

  for (const feature of state.routeFeatures) {
    const routeNumber = feature.properties.route_short_name;
    const latLngs = feature.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    const routeLayer = L.polyline(latLngs, {
      color: feature.properties.display_color,
      weight: 6,
      opacity: 0.84,
      lineCap: "round",
      lineJoin: "round",
    });

    routeLayer.on("click", () => focusRoute(routeNumber));
    routeLayer.addTo(routeLayerGroup);
    state.routeLayersByNumber.get(routeNumber).push(routeLayer);

    const [labelLon, labelLat] = feature.properties.label_point;
    const labelMarker = L.marker([labelLat, labelLon], {
      interactive: true,
      keyboard: true,
      icon: L.divIcon({
        className: "route-label",
        html: `<button class="route-label__inner" style="background:${feature.properties.display_color}; color:${feature.properties.text_color};" type="button">${routeNumber}</button>`,
      }),
    });

    labelMarker.on("click", () => focusRoute(routeNumber));
    labelMarker.addTo(labelLayerGroup);
    state.labelLayersByNumber.get(routeNumber).push(labelMarker);
  }

  for (const feature of state.stopFeatures) {
    const stopId = feature.properties.stop_id;
    const [lon, lat] = feature.geometry.coordinates;
    const routeCount = feature.properties.route_count;

    const icon = L.divIcon({
      className: "",
      html: `<div class="stop-dot ${routeCount > 1 ? "is-interchange" : ""}" data-stop-dot="${stopId}"></div>`,
      iconSize: routeCount > 1 ? [16, 16] : [12, 12],
      iconAnchor: routeCount > 1 ? [8, 8] : [6, 6],
    });

    const marker = L.marker([lat, lon], { icon });
    marker.on("click", () => {
      state.highlightedStopId = stopId;
      openStopPopup(marker, feature);
      refreshUi();
    });
    marker.addTo(stopLayerGroup);
    state.stopLayerById.set(stopId, marker);
  }

  refreshUi();
}

function refreshUi() {
  refreshRouteVisibility();
  refreshStopVisibility();
  renderRouteControls();
  renderSelectionPanel();
}

function refreshRouteVisibility() {
  for (const route of state.summary.routes) {
    const routeNumber = route.route_short_name;
    const isSelected = state.selectedRoutes.has(routeNumber);
    const isFocused = !state.focusRoute || state.focusRoute === routeNumber;
    const visible = isSelected;
    const faded = visible && state.focusRoute && !isFocused;

    for (const layer of state.routeLayersByNumber.get(routeNumber) ?? []) {
      layer.setStyle({
        opacity: visible ? (faded ? 0.16 : 0.96) : 0,
        weight: visible ? (state.focusRoute === routeNumber ? 8 : 6) : 1,
      });
      if (visible) {
        if (!routeLayerGroup.hasLayer(layer)) {
          layer.addTo(routeLayerGroup);
        }
      } else if (routeLayerGroup.hasLayer(layer)) {
        routeLayerGroup.removeLayer(layer);
      }
    }

    for (const labelLayer of state.labelLayersByNumber.get(routeNumber) ?? []) {
      const el = labelLayer.getElement();
      if (el) {
        el.classList.toggle("is-muted", Boolean(faded));
      }
      if (visible) {
        if (!labelLayerGroup.hasLayer(labelLayer)) {
          labelLayer.addTo(labelLayerGroup);
        }
      } else if (labelLayerGroup.hasLayer(labelLayer)) {
        labelLayerGroup.removeLayer(labelLayer);
      }
    }
  }
}

function refreshStopVisibility() {
  const searchTerm = state.searchTerm;

  for (const feature of state.stopFeatures) {
    const stopId = feature.properties.stop_id;
    const marker = state.stopLayerById.get(stopId);
    if (!marker) {
      continue;
    }

    const stopRouteNumbers = feature.properties.routes.filter((route) => state.selectedRoutes.has(route));
    const matchesFocusedRoute = !state.focusRoute || stopRouteNumbers.includes(state.focusRoute);
    const matchesInterchange = !state.interchangesOnly || stopRouteNumbers.length >= 2;
    const matchesSearch = !searchTerm
      || feature.properties.stop_name.toLowerCase().includes(searchTerm)
      || stopRouteNumbers.some((route) => route.includes(searchTerm));

    const visible = stopRouteNumbers.length > 0 && matchesFocusedRoute && matchesInterchange && matchesSearch;
    if (visible) {
      if (!stopLayerGroup.hasLayer(marker)) {
        marker.addTo(stopLayerGroup);
      }
    } else if (stopLayerGroup.hasLayer(marker)) {
      stopLayerGroup.removeLayer(marker);
    }

    const iconElement = marker.getElement()?.querySelector("[data-stop-dot]");
    if (iconElement) {
      iconElement.classList.toggle("is-highlighted", stopId === state.highlightedStopId);
    }
  }
}

function renderSelectionPanel() {
  const hasFocus = Boolean(state.focusRoute || state.highlightedStopId);
  els.selectionPanel.classList.toggle("is-hidden", !hasFocus);

  if (!hasFocus) {
    els.selectionContent.innerHTML = "";
    return;
  }

  if (state.focusRoute) {
    const route = state.summary.routes.find((item) => item.route_short_name === state.focusRoute);
    const visibleStopCount = countVisibleStopsForRoute(route.route_short_name);
    const directions = route.directions
      .map((direction) => `Dir ${direction.direction_id}: ${direction.headsign_summary}`)
      .join(" • ");

    els.selectionContent.innerHTML = `
      <div class="selection-badges">
        <span class="route-badge" style="background:${route.display_color}; color:${route.text_color};">${route.route_short_name}</span>
      </div>
      <h3>${route.route_long_name}</h3>
      <p class="selection-directions">${directions}</p>
      <div class="selection-stats">
        <div class="selection-stat">
          <strong>${visibleStopCount}</strong>
          <span>Visible stops</span>
        </div>
        <div class="selection-stat">
          <strong>${route.direction_count}</strong>
          <span>Directions shown</span>
        </div>
      </div>
      <p class="selection-meta">${route.trip_count_total} trips contributed to the representative exported shapes.</p>
    `;
    return;
  }

  const stopFeature = state.stopFeatures.find((feature) => feature.properties.stop_id === state.highlightedStopId);
  if (!stopFeature) {
    els.selectionContent.innerHTML = "";
    return;
  }

  const selectedRoutes = stopFeature.properties.routes.filter((route) => state.selectedRoutes.has(route));
  const badges = selectedRoutes
    .map((routeNumber) => {
      const route = state.summary.routes.find((item) => item.route_short_name === routeNumber);
      return `<span class="route-badge" style="background:${route.display_color}; color:${route.text_color};">${route.route_short_name}</span>`;
    })
    .join("");

  const homeButton = `
    <button id="save-home-stop-btn" type="button">${readHomeStop() === stopFeature.properties.stop_id ? "Saved as home stop" : "Save as home stop"}</button>
  `;

  els.selectionContent.innerHTML = `
    <h3>${stopFeature.properties.stop_name}</h3>
    <p class="selection-meta">Stop ${stopFeature.properties.stop_code || stopFeature.properties.stop_id}</p>
    <div class="selection-badges">${badges}</div>
    <p class="selection-meta">${selectedRoutes.length} selected routes serve this stop.</p>
    ${homeButton}
  `;

  document.querySelector("#save-home-stop-btn")?.addEventListener("click", () => {
    localStorage.setItem(STORAGE_KEYS.homeStop, stopFeature.properties.stop_id);
    renderSelectionPanel();
  });
}

function openStopPopup(marker, feature) {
  const popupNode = els.popupTemplate.content.firstElementChild.cloneNode(true);
  const routeNumbers = feature.properties.routes.filter((route) => state.selectedRoutes.has(route));

  popupNode.querySelector(".stop-popup__title").textContent = feature.properties.stop_name;
  popupNode.querySelector(".stop-popup__meta").textContent = `Stop ${feature.properties.stop_code || feature.properties.stop_id}`;
  popupNode.querySelector(".stop-popup__routes").innerHTML = routeNumbers.map((routeNumber) => {
    const route = state.summary.routes.find((item) => item.route_short_name === routeNumber);
    return `<span class="route-badge" style="background:${route.display_color}; color:${route.text_color};">${route.route_short_name}</span>`;
  }).join("");

  popupNode.querySelector(".popup-button").addEventListener("click", () => {
    state.selectedRoutes = new Set(routeNumbers);
    state.focusRoute = null;
    persistRoutes();
    refreshUi();
    fitVisibleBounds();
    marker.closePopup();
  });

  marker.bindPopup(popupNode).openPopup();
}

function focusRoute(routeNumber) {
  if (!state.selectedRoutes.has(routeNumber)) {
    state.selectedRoutes.add(routeNumber);
  }
  state.focusRoute = routeNumber;
  state.highlightedStopId = null;
  persistRoutes();
  refreshUi();
  fitVisibleBounds();
}

function fitVisibleBounds(forceDefault = false) {
  if (forceDefault) {
    map.setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
    return;
  }

  const bounds = [];

  for (const route of state.summary.routes) {
    const routeNumber = route.route_short_name;
    if (!state.selectedRoutes.has(routeNumber)) {
      continue;
    }
    if (state.focusRoute && state.focusRoute !== routeNumber) {
      continue;
    }
    for (const direction of route.directions) {
      bounds.push([direction.bounds.min_lat, direction.bounds.min_lon]);
      bounds.push([direction.bounds.max_lat, direction.bounds.max_lon]);
    }
  }

  if (!bounds.length) {
    map.setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
    return;
  }

  map.fitBounds(bounds, {
    padding: [32, 32],
    maxZoom: 14,
  });
}

function countVisibleStopsForRoute(routeNumber) {
  let count = 0;
  for (const feature of state.stopFeatures) {
    const marker = state.stopLayerById.get(feature.properties.stop_id);
    if (!marker || !stopLayerGroup.hasLayer(marker)) {
      continue;
    }
    if (feature.properties.routes.includes(routeNumber)) {
      count += 1;
    }
  }
  return count;
}

function persistRoutes() {
  localStorage.setItem(STORAGE_KEYS.selectedRoutes, JSON.stringify([...state.selectedRoutes]));
}

function readPersistedRoutes(availableRoutes) {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.selectedRoutes) ?? "[]");
    return parsed.filter((route) => availableRoutes.includes(route));
  } catch {
    return [];
  }
}

function readHomeStop() {
  return localStorage.getItem(STORAGE_KEYS.homeStop);
}

function showMapMessage(message) {
  els.mapMessage.textContent = message;
  els.mapMessage.classList.remove("is-hidden");
}
