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

const DIRECTION_LABELS = {
  "0": "Inbound / dir 0",
  "1": "Outbound / dir 1",
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
const routeStopLayerGroup = L.layerGroup().addTo(map);
const labelLayerGroup = L.layerGroup().addTo(map);
const stopLayerGroup = L.layerGroup().addTo(map);

const state = {
  routeFeatures: [],
  stopFeatures: [],
  stopRoutes: {},
  summary: null,
  selectedRoutes: new Set(),
  visibleDirections: new Set(["0", "1"]),
  focusRoute: null,
  highlightedStopId: null,
  interchangesOnly: false,
  routeLayersByNumber: new Map(),
  stopLayerById: new Map(),
  labelLayersByNumber: new Map(),
  routeOffsetByNumber: new Map(),
  routeByNumber: new Map(),
  routeDirectionStopIds: new Map(),
  stopById: new Map(),
  routeStopMarkers: [],
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
  interchangesOnlyToggle: document.querySelector("#interchanges-only-toggle"),
  direction0Toggle: document.querySelector("#direction-0-toggle"),
  direction1Toggle: document.querySelector("#direction-1-toggle"),
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
  state.routeOffsetByNumber = buildRouteOffsetMap(summary.routes);
  state.routeByNumber = new Map(summary.routes.map((route) => [route.route_short_name, route]));
  state.routeDirectionStopIds = buildRouteDirectionStopIndex(summary.routes);
  state.stopById = new Map(state.stopFeatures.map((feature) => [feature.properties.stop_id, feature]));

  const availableRoutes = summary.routes.map((route) => route.route_short_name);
  const persistedRoutes = readPersistedRoutes(availableRoutes);
  state.selectedRoutes = new Set(persistedRoutes.length ? persistedRoutes : availableRoutes);
  syncDirectionToggleState();

  buildRouteIndex();
  renderRouteControls();
  renderMapLayers();
  renderSelectionPanel();
  fitVisibleBounds();
  map.on("zoomend", () => {
    updateStopMarkerSizes();
    updateRouteStopMarkerPositions();
    refreshRouteStopVisibility();
  });

  const missingCount = summary.missing_target_routes?.length ?? 0;
  els.datasetStatus.textContent = `${availableRoutes.length} routes loaded${missingCount ? `, ${missingCount} missing from feed` : ""}.`;
}

function bindControls() {
  els.showAllBtn.addEventListener("click", () => {
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const allRoutes = state.summary?.routes.map((route) => route.route_short_name) ?? [];
    state.selectedRoutes = new Set(allRoutes);
    state.focusRoute = null;
    persistRoutes();
    refreshUi();
    map.setView(currentCenter, currentZoom, { animate: false });
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

  els.interchangesOnlyToggle.addEventListener("change", (event) => {
    state.interchangesOnly = event.target.checked;
    refreshStopVisibility();
  });

  els.direction0Toggle.addEventListener("change", () => updateDirectionFilter("0", els.direction0Toggle.checked));
  els.direction1Toggle.addEventListener("change", () => updateDirectionFilter("1", els.direction1Toggle.checked));
}

function updateDirectionFilter(directionId, enabled) {
  if (enabled) {
    state.visibleDirections.add(directionId);
  } else if (state.visibleDirections.size > 1) {
    state.visibleDirections.delete(directionId);
  } else {
    const toggle = directionId === "0" ? els.direction0Toggle : els.direction1Toggle;
    toggle.checked = true;
    return;
  }
  syncDirectionToggleState();
  refreshUi();
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

function buildRouteOffsetMap(routes) {
  const sortedRoutes = [...routes].sort((a, b) => Number(a.route_short_name) - Number(b.route_short_name));
  const midpoint = (sortedRoutes.length - 1) / 2;
  return new Map(
    sortedRoutes.map((route, index) => [route.route_short_name, (index - midpoint) * 2]),
  );
}

function buildRouteDirectionStopIndex(routes) {
  const index = new Map();
  for (const route of routes) {
    const directionMap = new Map();
    for (const direction of route.directions) {
      directionMap.set(String(direction.direction_id), new Set(direction.stop_ids ?? []));
    }
    index.set(route.route_short_name, directionMap);
  }
  return index;
}

function renderRouteControls() {
  const routeMarkup = [];

  for (const route of state.summary.routes) {
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
      focusRoute(row.getAttribute("data-route"));
    });
  }
}

function renderMapLayers() {
  routeLayerGroup.clearLayers();
  routeStopLayerGroup.clearLayers();
  labelLayerGroup.clearLayers();
  stopLayerGroup.clearLayers();
  state.stopLayerById.clear();
  state.routeStopMarkers = [];
  buildRouteIndex();

  for (const feature of state.routeFeatures) {
    const routeNumber = feature.properties.route_short_name;
    const directionId = String(feature.properties.direction_id);
    const latLngs = feature.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    const routeLayer = L.polyline(latLngs, {
      color: feature.properties.display_color,
      weight: 5,
      opacity: 0.92,
      lineCap: "round",
      lineJoin: "round",
      dashArray: directionId === "1" ? "12 9" : null,
    });
    applyRouteOffset(routeLayer, routeNumber, directionId);

    routeLayer.on("click", () => focusRoute(routeNumber));
    routeLayer.addTo(routeLayerGroup);
    state.routeLayersByNumber.get(routeNumber).push({ layer: routeLayer, directionId });

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
    state.labelLayersByNumber.get(routeNumber).push({ layer: labelMarker, directionId });
  }

  for (const feature of state.stopFeatures) {
    const stopId = feature.properties.stop_id;
    const [lon, lat] = feature.geometry.coordinates;
    const routeCount = feature.properties.route_count;
    const marker = L.circleMarker([lat, lon], buildStopMarkerStyle(routeCount, false));
    marker.on("click", () => {
      state.highlightedStopId = stopId;
      openStopPopup(marker, feature);
      refreshUi();
    });
    marker.addTo(stopLayerGroup);
    state.stopLayerById.set(stopId, marker);
  }

  buildRouteStopMarkers();
  updateStopMarkerSizes();
  refreshUi();
}

function refreshUi() {
  refreshRouteVisibility();
  refreshStopVisibility();
  refreshRouteStopVisibility();
  renderRouteControls();
  renderSelectionPanel();
}

function refreshRouteVisibility() {
  for (const route of state.summary.routes) {
    const routeNumber = route.route_short_name;
    const isSelected = state.selectedRoutes.has(routeNumber);
    const isFocused = !state.focusRoute || state.focusRoute === routeNumber;

    for (const entry of state.routeLayersByNumber.get(routeNumber) ?? []) {
      const directionVisible = state.visibleDirections.has(entry.directionId);
      const visible = isSelected && directionVisible;
      const faded = visible && state.focusRoute && !isFocused;

      entry.layer.setStyle({
        opacity: visible ? (faded ? 0.18 : 0.96) : 0,
        weight: visible ? (state.focusRoute === routeNumber ? 7 : 5) : 1,
      });

      if (visible) {
        if (!routeLayerGroup.hasLayer(entry.layer)) {
          entry.layer.addTo(routeLayerGroup);
        }
      } else if (routeLayerGroup.hasLayer(entry.layer)) {
        routeLayerGroup.removeLayer(entry.layer);
      }
    }

    for (const entry of state.labelLayersByNumber.get(routeNumber) ?? []) {
      const visible = isSelected && state.visibleDirections.has(entry.directionId);
      const faded = visible && state.focusRoute && !isFocused;
      const el = entry.layer.getElement();
      if (el) {
        el.classList.toggle("is-muted", Boolean(faded));
      }
      if (visible) {
        if (!labelLayerGroup.hasLayer(entry.layer)) {
          entry.layer.addTo(labelLayerGroup);
        }
      } else if (labelLayerGroup.hasLayer(entry.layer)) {
        labelLayerGroup.removeLayer(entry.layer);
      }
    }
  }
}

function refreshStopVisibility() {
  for (const feature of state.stopFeatures) {
    const stopId = feature.properties.stop_id;
    const marker = state.stopLayerById.get(stopId);
    if (!marker) {
      continue;
    }

    const visibleRoutes = getVisibleRouteNumbersForStop(feature);
    const matchesFocusedRoute = !state.focusRoute || visibleRoutes.includes(state.focusRoute);
    const matchesInterchange = !state.interchangesOnly || visibleRoutes.length >= 2;

    const visible = visibleRoutes.length > 0 && matchesFocusedRoute && matchesInterchange;
    if (visible) {
      if (!stopLayerGroup.hasLayer(marker)) {
        marker.addTo(stopLayerGroup);
      }
    } else if (stopLayerGroup.hasLayer(marker)) {
      stopLayerGroup.removeLayer(marker);
    }

    marker.setStyle(buildStopMarkerStyle(feature.properties.route_count, stopId === state.highlightedStopId));
  }
}

function refreshRouteStopVisibility() {
  const zoom = map.getZoom();
  const showRouteStopDots = zoom >= 14;

  for (const entry of state.routeStopMarkers) {
    const routeSelected = state.selectedRoutes.has(entry.routeNumber);
    const directionVisible = state.visibleDirections.has(entry.directionId);
    const focusVisible = !state.focusRoute || state.focusRoute === entry.routeNumber;
    const baseStopVisible = stopLayerGroup.hasLayer(state.stopLayerById.get(entry.stopId));
    const visible = showRouteStopDots && routeSelected && directionVisible && focusVisible && baseStopVisible;

    if (visible) {
      if (!routeStopLayerGroup.hasLayer(entry.marker)) {
        entry.marker.addTo(routeStopLayerGroup);
      }
    } else if (routeStopLayerGroup.hasLayer(entry.marker)) {
      routeStopLayerGroup.removeLayer(entry.marker);
    }

    entry.marker.setStyle({
      radius: getRouteStopDotRadius(zoom),
      weight: 1,
    });
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
    const route = state.routeByNumber.get(state.focusRoute);
    const enabledDirections = route.directions.filter((direction) => state.visibleDirections.has(String(direction.direction_id)));
    const visibleStopCount = countVisibleStopsForRoute(route.route_short_name);
    const directions = enabledDirections
      .map((direction) => `${formatDirectionLabel(direction.direction_id)}: ${direction.headsign_summary}`)
      .join(" | ");

    els.selectionContent.innerHTML = `
      <div class="selection-badges">
        <span class="route-badge" style="background:${route.display_color}; color:${route.text_color};">${route.route_short_name}</span>
      </div>
      <h3>${route.route_long_name}</h3>
      <p class="selection-directions">${directions || "No directions currently visible."}</p>
      <div class="selection-stats">
        <div class="selection-stat">
          <strong>${visibleStopCount}</strong>
          <span>Visible stops</span>
        </div>
        <div class="selection-stat">
          <strong>${enabledDirections.length}</strong>
          <span>Directions shown</span>
        </div>
      </div>
      <p class="selection-meta">${route.trip_count_total} trips contributed to the representative exported shapes.</p>
      <p class="selection-warning">Shared corridors are offset slightly side-by-side to make overlapping routes easier to read.</p>
    `;
    return;
  }

  const stopFeature = state.stopFeatures.find((feature) => feature.properties.stop_id === state.highlightedStopId);
  if (!stopFeature) {
    els.selectionContent.innerHTML = "";
    return;
  }

  const selectedRoutes = getVisibleRouteNumbersForStop(stopFeature);
  const badges = selectedRoutes
    .map((routeNumber) => {
      const route = state.routeByNumber.get(routeNumber);
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
    <p class="selection-meta">${selectedRoutes.length} visible routes serve this stop.</p>
    ${homeButton}
  `;

  document.querySelector("#save-home-stop-btn")?.addEventListener("click", () => {
    localStorage.setItem(STORAGE_KEYS.homeStop, stopFeature.properties.stop_id);
    renderSelectionPanel();
  });
}

function openStopPopup(marker, feature) {
  const popupNode = els.popupTemplate.content.firstElementChild.cloneNode(true);
  const routeNumbers = getVisibleRouteNumbersForStop(feature);

  popupNode.querySelector(".stop-popup__title").textContent = feature.properties.stop_name;
  popupNode.querySelector(".stop-popup__meta").textContent = `Stop ${feature.properties.stop_code || feature.properties.stop_id}`;
  popupNode.querySelector(".stop-popup__routes").innerHTML = routeNumbers.map((routeNumber) => {
    const route = state.routeByNumber.get(routeNumber);
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
      if (!state.visibleDirections.has(String(direction.direction_id))) {
        continue;
      }
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
    if (getVisibleRouteNumbersForStop(feature).includes(routeNumber)) {
      count += 1;
    }
  }
  return count;
}

function buildRouteStopMarkers() {
  for (const route of state.summary.routes) {
    for (const direction of route.directions) {
      for (const stopId of direction.stop_ids ?? []) {
        const stopFeature = state.stopById.get(stopId);
        if (!stopFeature) {
          continue;
        }

        const marker = L.circleMarker(
          offsetLatLngForRoute(
            stopFeature.geometry.coordinates[1],
            stopFeature.geometry.coordinates[0],
            route.route_short_name,
          ),
          {
            radius: getRouteStopDotRadius(map.getZoom()),
            color: "#ffffff",
            weight: 1,
            fillColor: route.display_color,
            fillOpacity: 1,
            interactive: false,
          },
        );

        state.routeStopMarkers.push({
          marker,
          routeNumber: route.route_short_name,
          directionId: String(direction.direction_id),
          stopId,
          lat: stopFeature.geometry.coordinates[1],
          lon: stopFeature.geometry.coordinates[0],
        });
      }
    }
  }
}

function updateRouteStopMarkerPositions() {
  for (const entry of state.routeStopMarkers) {
    entry.marker.setLatLng(offsetLatLngForRoute(entry.lat, entry.lon, entry.routeNumber));
  }
}

function getVisibleRouteNumbersForStop(feature) {
  return feature.properties.routes.filter((routeNumber) => {
    if (!state.selectedRoutes.has(routeNumber)) {
      return false;
    }
    const directionMap = state.routeDirectionStopIds.get(routeNumber);
    if (!directionMap) {
      return false;
    }
    for (const directionId of state.visibleDirections) {
      const stopIds = directionMap.get(directionId);
      if (stopIds?.has(feature.properties.stop_id)) {
        return true;
      }
    }
    return false;
  });
}

function getRouteOffset(routeNumber, directionId) {
  const baseOffset = state.routeOffsetByNumber.get(routeNumber) ?? 0;
  const directionOffset = directionId === "0" ? -0.75 : 0.75;
  return baseOffset + directionOffset;
}

function applyRouteOffset(routeLayer, routeNumber, directionId) {
  if (typeof routeLayer.setOffset === "function") {
    routeLayer.setOffset(getRouteOffset(routeNumber, directionId));
    return;
  }

  if (routeLayer.options) {
    routeLayer.options.offset = getRouteOffset(routeNumber, directionId);
  }
}

function offsetLatLngForRoute(lat, lon, routeNumber) {
  const point = map.latLngToLayerPoint([lat, lon]);
  const offsetPoint = L.point(point.x + (state.routeOffsetByNumber.get(routeNumber) ?? 0), point.y);
  return map.layerPointToLatLng(offsetPoint);
}

function buildStopMarkerStyle(routeCount, highlighted) {
  const radius = getBaseStopRadius(map.getZoom(), routeCount, highlighted);
  return {
    radius,
    color: "#ffffff",
    weight: highlighted ? 2 : 1,
    fillColor: highlighted ? "#ff7f50" : routeCount > 1 ? "#1d7a63" : "#345e4d",
    fillOpacity: highlighted ? 1 : 0.95,
  };
}

function updateStopMarkerSizes() {
  for (const feature of state.stopFeatures) {
    const marker = state.stopLayerById.get(feature.properties.stop_id);
    if (!marker) {
      continue;
    }
    marker.setStyle(
      buildStopMarkerStyle(
        feature.properties.route_count,
        feature.properties.stop_id === state.highlightedStopId,
      ),
    );
  }
}

function getBaseStopRadius(zoom, routeCount, highlighted) {
  let radius = 2;
  if (zoom >= 16) {
    radius = 5;
  } else if (zoom >= 15) {
    radius = 4;
  } else if (zoom >= 14) {
    radius = 3.5;
  } else if (zoom >= 13) {
    radius = 3;
  } else if (zoom >= 12) {
    radius = 2.5;
  }

  if (routeCount > 1) {
    radius += 1;
  }
  if (highlighted) {
    radius += 1.5;
  }
  return radius;
}

function getRouteStopDotRadius(zoom) {
  if (zoom >= 16) {
    return 3.5;
  }
  if (zoom >= 15) {
    return 3;
  }
  if (zoom >= 14) {
    return 2.5;
  }
  return 2;
}

function formatDirectionLabel(directionId) {
  return DIRECTION_LABELS[String(directionId)] ?? `Dir ${directionId}`;
}

function syncDirectionToggleState() {
  els.direction0Toggle.checked = state.visibleDirections.has("0");
  els.direction1Toggle.checked = state.visibleDirections.has("1");
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
