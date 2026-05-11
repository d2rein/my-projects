const LIST_TYPES = [
  { id: "pokemon", label: "Pokemon", color: "#4a9fd4" },
  { id: "shiny", label: "Shiny", color: "#e0a514" },
  { id: "lucky", label: "Lucky", color: "#f7901f" },
  { id: "xxl", label: "XXL", color: "#2aa283" },
  { id: "xxs", label: "XXS", color: "#c65487" },
  { id: "gmax", label: "G-Max", color: "#bf4d74" },
  { id: "mega", label: "Mega", color: "#ce5f97" },
  { id: "shadow", label: "Shadow", color: "#7b5167" },
  { id: "purified", label: "Purified", color: "#7bb7dc" },
  { id: "perfect", label: "100%", color: "#3a7fda" }
];

const STORAGE_KEY = "pogo-pokedex-tracker-v1";
const NAMES_KEY = "pogo-pokedex-name-cache-v1";
const DEFAULT_CALIBRATION = {
  gridLeft: 4.5,
  gridTop: 18.5,
  gridWidth: 92,
  gridHeight: 71,
  numberBand: 22,
  spriteBand: 64,
  rowCount: 5,
  motionThreshold: 18
};

const DEFAULT_FEED = {
  updatedAt: "2026-05-10",
  sources: [
    {
      name: "Official Pokemon GO news",
      url: "https://pokemongolive.com/"
    }
  ],
  releases: [
    {
      id: "sample-may-spotlight",
      title: "Sample Spotlight Hour",
      startsAt: "2026-05-19T18:00:00+10:00",
      endsAt: "2026-05-19T19:00:00+10:00",
      source: "Add official post URL here",
      opportunities: [
        { list: "shiny", dex: 133, label: "Shiny chance featured", boost: "boosted odds" },
        { list: "pokemon", dex: 137, label: "Wild debut" }
      ]
    },
    {
      id: "sample-rocket-rotation",
      title: "Sample Rocket Rotation",
      startsAt: "2026-05-24T10:00:00+10:00",
      endsAt: "2026-06-15T20:00:00+10:00",
      source: "Add official post URL here",
      opportunities: [
        { list: "shadow", dex: 74, label: "Shadow in grunt lineup" },
        { list: "purified", dex: 74, label: "Purify after rescue" }
      ]
    },
    {
      id: "sample-egg-pool",
      title: "Sample Egg Pool",
      startsAt: "2026-06-01T10:00:00+10:00",
      endsAt: "2026-06-08T20:00:00+10:00",
      source: "Add official post URL here",
      opportunities: [
        { list: "pokemon", dex: 371, label: "7 km eggs" },
        { list: "shiny", dex: 371, label: "Can hatch shiny", boost: "standard odds" }
      ]
    }
  ]
};

const state = loadState();
const nameCache = loadNameCache();

const listTypeSelect = document.querySelector("#listTypeSelect");
const scanModeSelect = document.querySelector("#scanModeSelect");
const motionThresholdInput = document.querySelector("#motionThresholdInput");
const rowCountInput = document.querySelector("#rowCountInput");
const gridLeftInput = document.querySelector("#gridLeftInput");
const gridTopInput = document.querySelector("#gridTopInput");
const gridWidthInput = document.querySelector("#gridWidthInput");
const gridHeightInput = document.querySelector("#gridHeightInput");
const numberBandInput = document.querySelector("#numberBandInput");
const spriteBandInput = document.querySelector("#spriteBandInput");
const previewCanvas = document.querySelector("#previewCanvas");
const previewCtx = previewCanvas.getContext("2d", { willReadFrequently: true });
const captureVideo = document.querySelector("#captureVideo");
const uploadInput = document.querySelector("#uploadInput");
const importInput = document.querySelector("#importInput");

const heroTrackedCount = document.querySelector("#heroTrackedCount");
const heroMissingCount = document.querySelector("#heroMissingCount");
const captureStatePill = document.querySelector("#captureStatePill");
const motionPill = document.querySelector("#motionPill");
const ocrPill = document.querySelector("#ocrPill");
const scrollFeedback = document.querySelector("#scrollFeedback");
const scrollHint = document.querySelector("#scrollHint");
const lastScanSummary = document.querySelector("#lastScanSummary");
const lastScanDetail = document.querySelector("#lastScanDetail");
const listSummaryCards = document.querySelector("#listSummaryCards");
const dexTableBody = document.querySelector("#dexTableBody");
const feedEditor = document.querySelector("#feedEditor");
const matchesTableBody = document.querySelector("#matchesTableBody");
const logPanel = document.querySelector("#logPanel");

const heroListCount = document.querySelector("#heroListCount");
heroListCount.textContent = String(LIST_TYPES.length);

let captureStream = null;
let previewLoopHandle = 0;
let scanLoopHandle = 0;
let lastGridSample = null;
let lastStableHash = "";
let tesseractWorkerPromise = null;
let isWorkerBusy = false;
let previewHasFrame = false;
let lastOverlayRect = null;
let lastScanTiles = [];

setup();

function setup() {
  LIST_TYPES.forEach(list => {
    const option = document.createElement("option");
    option.value = list.id;
    option.textContent = list.label;
    listTypeSelect.append(option);
  });

  listTypeSelect.value = state.activeList;
  scanModeSelect.value = state.scanMode;
  feedEditor.value = JSON.stringify(state.releaseFeed, null, 2);
  setCalibrationInputs(state.calibration);
  bindEvents();
  addLog("info", "Tracker opened", {
    activeList: state.activeList,
    scanMode: state.scanMode
  });
  renderAll();
  requestMissingNames();
  drawIdleCanvas();
}

function bindEvents() {
  document.querySelector("#startCaptureBtn").addEventListener("click", startCapture);
  document.querySelector("#stopCaptureBtn").addEventListener("click", stopCapture);
  document.querySelector("#scanFrameBtn").addEventListener("click", () => scanCurrentFrame("manual"));
  document.querySelector("#scanUploadBtn").addEventListener("click", () => uploadInput.click());
  document.querySelector("#uploadInput").addEventListener("change", handleUpload);
  document.querySelector("#clearCurrentListBtn").addEventListener("click", clearCurrentList);
  document.querySelector("#exportStateBtn").addEventListener("click", exportState);
  document.querySelector("#importStateBtn").addEventListener("click", () => importInput.click());
  document.querySelector("#importInput").addEventListener("change", importState);
  document.querySelector("#publishStateBtn").addEventListener("click", publishState);
  document.querySelector("#loadFeedBtn").addEventListener("click", loadFeedFromApi);
  document.querySelector("#publishFeedBtn").addEventListener("click", publishFeedToApi);
  document.querySelector("#exportLogsBtn").addEventListener("click", exportLogs);
  document.querySelector("#clearLogsBtn").addEventListener("click", clearLogs);

  listTypeSelect.addEventListener("change", () => {
    state.activeList = listTypeSelect.value;
    addLog("info", "Active list changed", { list: state.activeList });
    saveState();
    renderAll();
  });

  scanModeSelect.addEventListener("change", () => {
    state.scanMode = scanModeSelect.value;
    addLog("info", "Scan mode changed", { mode: state.scanMode });
    saveState();
  });

  [
    motionThresholdInput,
    rowCountInput,
    gridLeftInput,
    gridTopInput,
    gridWidthInput,
    gridHeightInput,
    numberBandInput,
    spriteBandInput
  ].forEach(input => input.addEventListener("input", handleCalibrationInput));
}

function loadState() {
  const blankLists = Object.fromEntries(LIST_TYPES.map(list => [list.id, {}]));
  const saved = localStorage.getItem(STORAGE_KEY);
  const fallback = {
    activeList: "pokemon",
    scanMode: "auto",
    calibration: { ...DEFAULT_CALIBRATION },
    lists: blankLists,
    releaseFeed: structuredClone(DEFAULT_FEED),
    history: [],
    logs: []
  };
  if (!saved) return fallback;
  try {
    const parsed = JSON.parse(saved);
    return {
      ...fallback,
      ...parsed,
      calibration: { ...DEFAULT_CALIBRATION, ...(parsed.calibration || {}) },
      lists: { ...blankLists, ...(parsed.lists || {}) },
      releaseFeed: parsed.releaseFeed || structuredClone(DEFAULT_FEED),
      history: Array.isArray(parsed.history) ? parsed.history.slice(-30) : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs.slice(-200) : []
    };
  } catch {
    return fallback;
  }
}

function loadNameCache() {
  const saved = localStorage.getItem(NAMES_KEY);
  if (!saved) return {};
  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveNameCache() {
  localStorage.setItem(NAMES_KEY, JSON.stringify(nameCache));
}

function addLog(level, message, details = null) {
  state.logs.push({
    at: new Date().toISOString(),
    level,
    message,
    details
  });
  state.logs = state.logs.slice(-200);
  saveState();
  renderLogs();
}

function setCalibrationInputs(calibration) {
  motionThresholdInput.value = calibration.motionThreshold;
  rowCountInput.value = calibration.rowCount;
  gridLeftInput.value = calibration.gridLeft;
  gridTopInput.value = calibration.gridTop;
  gridWidthInput.value = calibration.gridWidth;
  gridHeightInput.value = calibration.gridHeight;
  numberBandInput.value = calibration.numberBand;
  spriteBandInput.value = calibration.spriteBand;
}

function handleCalibrationInput() {
  state.calibration = {
    motionThreshold: Number(motionThresholdInput.value),
    rowCount: Number(rowCountInput.value),
    gridLeft: Number(gridLeftInput.value),
    gridTop: Number(gridTopInput.value),
    gridWidth: Number(gridWidthInput.value),
    gridHeight: Number(gridHeightInput.value),
    numberBand: Number(numberBandInput.value),
    spriteBand: Number(spriteBandInput.value)
  };
  saveState();
  renderPreviewFrame();
}

function getCalibrationRect(width, height) {
  const c = state.calibration;
  return {
    x: Math.round((c.gridLeft / 100) * width),
    y: Math.round((c.gridTop / 100) * height),
    width: Math.round((c.gridWidth / 100) * width),
    height: Math.round((c.gridHeight / 100) * height)
  };
}

async function startCapture() {
  stopCapture();
  try {
    captureStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 12, max: 20 }
      },
      audio: false
    });
  } catch (error) {
    updateCaptureState("Capture denied");
    scrollFeedback.textContent = "Screen share was cancelled";
    scrollHint.textContent = error.message;
    addLog("error", "Screen share failed", { error: error.message });
    return;
  }

  captureVideo.srcObject = captureStream;
  await captureVideo.play();
  updateCaptureState("Live");
  previewHasFrame = true;
  addLog("info", "Screen share started", {
    activeList: state.activeList,
    width: captureVideo.videoWidth || null,
    height: captureVideo.videoHeight || null
  });
  scrollFeedback.textContent = "Live capture active";
  scrollHint.textContent = "Keep the mirrored phone screen centered. Auto-scan only triggers after movement settles.";
  captureStream.getVideoTracks()[0].addEventListener("ended", stopCapture);
  renderPreviewFrame();
  previewLoopHandle = window.setInterval(renderPreviewFrame, 140);
  scanLoopHandle = window.setInterval(() => {
    if (state.scanMode === "auto") scanCurrentFrame("auto");
  }, 1600);
}

function stopCapture() {
  if (previewLoopHandle) window.clearInterval(previewLoopHandle);
  if (scanLoopHandle) window.clearInterval(scanLoopHandle);
  previewLoopHandle = 0;
  scanLoopHandle = 0;
  if (captureStream) {
    captureStream.getTracks().forEach(track => track.stop());
  }
  captureStream = null;
  captureVideo.srcObject = null;
  lastGridSample = null;
  lastStableHash = "";
  previewHasFrame = false;
  updateCaptureState("Idle");
  motionPill.textContent = "Motion: n/a";
  drawIdleCanvas();
  addLog("info", "Capture stopped");
}

function updateCaptureState(label) {
  captureStatePill.textContent = label;
}

function drawIdleCanvas() {
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  const gradient = previewCtx.createLinearGradient(0, 0, 0, previewCanvas.height);
  gradient.addColorStop(0, "rgba(74,159,212,0.18)");
  gradient.addColorStop(1, "rgba(243,154,31,0.12)");
  previewCtx.fillStyle = gradient;
  previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewCtx.fillStyle = "rgba(63,49,18,0.82)";
  previewCtx.font = "700 24px Trebuchet MS";
  previewCtx.fillText("Start a screen share or scan screenshots", 34, 130);
  previewCtx.font = "16px Trebuchet MS";
  previewCtx.fillText("The overlay shows the grid area the scanner will read.", 34, 164);
}

function renderPreviewFrame() {
  if (!captureStream || captureVideo.readyState < 2) return;
  const srcW = captureVideo.videoWidth;
  const srcH = captureVideo.videoHeight;
  if (!srcW || !srcH) return;

  previewCanvas.width = srcW;
  previewCanvas.height = srcH;
  previewCtx.drawImage(captureVideo, 0, 0, srcW, srcH);

  const rect = detectSnappedGridRect(previewCanvas, getCalibrationRect(srcW, srcH));
  lastOverlayRect = rect;
  drawOverlay(rect);
  updateMotionStats(rect);
}

function drawOverlay(rect) {
  const cols = 4;
  const rows = state.calibration.rowCount;
  const tileWidth = rect.width / cols;
  const tileHeight = rect.height / rows;

  previewCtx.save();
  previewCtx.strokeStyle = "rgba(255,255,255,0.95)";
  previewCtx.lineWidth = 4;
  previewCtx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  previewCtx.lineWidth = 1.5;
  previewCtx.setLineDash([10, 8]);

  for (let col = 1; col < cols; col += 1) {
    const x = rect.x + tileWidth * col;
    previewCtx.beginPath();
    previewCtx.moveTo(x, rect.y);
    previewCtx.lineTo(x, rect.y + rect.height);
    previewCtx.stroke();
  }

  for (let row = 1; row < rows; row += 1) {
    const y = rect.y + tileHeight * row;
    previewCtx.beginPath();
    previewCtx.moveTo(rect.x, y);
    previewCtx.lineTo(rect.x + rect.width, y);
    previewCtx.stroke();
  }

  const numberBandHeight = tileHeight * (state.calibration.numberBand / 100);
  previewCtx.setLineDash([]);
  previewCtx.fillStyle = "rgba(255,255,255,0.12)";
  for (let row = 0; row < rows; row += 1) {
    const y = rect.y + tileHeight * (row + 1) - numberBandHeight;
    previewCtx.fillRect(rect.x, y, rect.width, numberBandHeight);
  }

  previewCtx.fillStyle = "rgba(63,49,18,0.8)";
  previewCtx.font = "700 18px Trebuchet MS";
  previewCtx.fillText(`${LIST_TYPES.find(entry => entry.id === state.activeList)?.label || "List"} overlay`, rect.x + 10, Math.max(26, rect.y - 12));

  if (lastScanTiles.length) {
    previewCtx.fillStyle = "rgba(57, 157, 96, 0.92)";
    previewCtx.font = `700 ${Math.max(18, Math.round(tileHeight * 0.15))}px Trebuchet MS`;
    lastScanTiles.forEach(tile => {
      const x = rect.x + tile.col * tileWidth + tileWidth - 24;
      const y = rect.y + tile.row * tileHeight + 28;
      previewCtx.fillText("✓", x, y);
    });
  }
  previewCtx.restore();
}

function updateMotionStats(rect) {
  const sampleWidth = 96;
  const sampleHeight = Math.max(72, Math.round((rect.height / rect.width) * sampleWidth));
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  sampleCtx.drawImage(previewCanvas, rect.x, rect.y, rect.width, rect.height, 0, 0, sampleWidth, sampleHeight);
  const imageData = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;

  let motion = 0;
  if (lastGridSample && lastGridSample.length === imageData.length) {
    for (let i = 0; i < imageData.length; i += 16) {
      motion += Math.abs(imageData[i] - lastGridSample[i]);
      motion += Math.abs(imageData[i + 1] - lastGridSample[i + 1]);
      motion += Math.abs(imageData[i + 2] - lastGridSample[i + 2]);
    }
    motion /= imageData.length / 16;
  }
  lastGridSample = new Uint8ClampedArray(imageData);

  motionPill.textContent = `Motion: ${motion.toFixed(1)}`;
  const threshold = state.calibration.motionThreshold;
  if (motion === 0 && !captureStream) {
    scrollFeedback.textContent = "Waiting for capture";
    return;
  }
  if (motion > threshold * 1.35) {
    scrollFeedback.textContent = "Too fast";
    scrollHint.textContent = "Slow your scroll slightly. OCR works best when the row settles for a fraction of a second.";
  } else if (motion > threshold * 0.75) {
    scrollFeedback.textContent = "Almost there";
    scrollHint.textContent = "You are close. Ease off just a little to let the current rows lock in.";
  } else {
    scrollFeedback.textContent = "Good capture speed";
    scrollHint.textContent = "This is a workable speed. Short pauses will let the app sample and classify the visible row block.";
  }
}

async function scanCurrentFrame(mode) {
  if (isWorkerBusy) return;
  if (!previewHasFrame) return;

  const motion = Number(motionPill.textContent.replace(/[^\d.]/g, "")) || 0;
  if (mode === "auto" && motion > state.calibration.motionThreshold) return;

  const frameCanvas = document.createElement("canvas");
  const frameCtx = frameCanvas.getContext("2d", { willReadFrequently: true });
  frameCanvas.width = previewCanvas.width;
  frameCanvas.height = previewCanvas.height;
  frameCtx.drawImage(previewCanvas, 0, 0);

  const rect = detectSnappedGridRect(frameCanvas, getCalibrationRect(frameCanvas.width, frameCanvas.height));
  lastOverlayRect = rect;
  const hash = hashRect(frameCtx.getImageData(rect.x, rect.y, rect.width, rect.height).data);
  if (mode === "auto" && hash === lastStableHash) return;

  isWorkerBusy = true;
  ocrPill.textContent = "OCR: scanning";

  try {
    const results = await scanGrid(frameCanvas, rect);
    if (!results.length) {
      lastScanSummary.textContent = "No dex numbers detected";
      lastScanDetail.textContent = "Try slowing the scroll, tightening the overlay, or scanning a paused frame.";
      addLog("warn", "Scan found no dex numbers", {
        mode,
        list: state.activeList,
        motion
      });
      return;
    }

    applyScanResults(results);
    lastScanTiles = results.map(result => ({
      row: result.row,
      col: result.col,
      dex: result.dex,
      status: result.status
    }));
    lastStableHash = hash;
    const detected = results.map(result => `#${String(result.dex).padStart(4, "0")} ${result.status}`).join(", ");
    lastScanSummary.textContent = `${results.length} entries updated for ${LIST_TYPES.find(list => list.id === state.activeList)?.label}`;
    lastScanDetail.textContent = detected;
    state.history.push({
      at: new Date().toISOString(),
      list: state.activeList,
      count: results.length,
      sample: results.slice(0, 6)
    });
    state.history = state.history.slice(-30);
    addLog("info", "Scan applied", {
      mode,
      list: state.activeList,
      motion,
      count: results.length,
      sample: results.slice(0, 8),
      baseDex: results[0]?.dex || null
    });
    saveState();
    renderAll();
    requestMissingNames();
    renderPreviewFrame();
  } catch (error) {
    lastScanSummary.textContent = "Frame scan failed";
    lastScanDetail.textContent = error.message;
    addLog("error", "Scan failed", {
      mode,
      list: state.activeList,
      error: error.message
    });
  } finally {
    isWorkerBusy = false;
    ocrPill.textContent = "OCR: ready";
  }
}

async function scanGrid(sourceCanvas, rect) {
  const cols = 4;
  const rows = state.calibration.rowCount;
  const tileWidth = rect.width / cols;
  const tileHeight = rect.height / rows;
  const worker = await getTesseractWorker();
  const tiles = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      tiles.push({
        row,
        col,
        index: row * cols + col,
        rect: {
          x: Math.round(rect.x + col * tileWidth),
          y: Math.round(rect.y + row * tileHeight),
          width: Math.round(tileWidth),
          height: Math.round(tileHeight)
        }
      });
    }
  }

  const anchorTiles = tiles.filter(tile => tile.row === 0 || tile.col === 0);
  const anchorReads = [];
  for (const tile of anchorTiles) {
    const dex = await readDexNumber(worker, sourceCanvas, tile.rect);
    if (!dex) continue;
    anchorReads.push({
      index: tile.index,
      dex
    });
  }

  const baseDex = chooseBaseDex(anchorReads, tiles.length);
  if (!baseDex) {
    return [];
  }

  return tiles.map(tile => ({
    row: tile.row,
    col: tile.col,
    dex: baseDex + tile.index,
    status: classifyTile(sourceCanvas, tile.rect)
  })).filter(entry => entry.dex >= 1 && entry.dex <= 9999);
}

function chooseBaseDex(anchorReads, tileCount) {
  if (!anchorReads.length) return null;
  const support = new Map();
  anchorReads.forEach(read => {
    const candidate = read.dex - read.index;
    if (candidate < 1 || candidate > 9999) return;
    const current = support.get(candidate) || { count: 0, reads: [] };
    current.count += 1;
    current.reads.push(read);
    support.set(candidate, current);
  });

  let bestCandidate = null;
  let bestCount = 0;
  for (const [candidate, info] of support.entries()) {
    if (candidate + tileCount - 1 > 9999) continue;
    if (info.count > bestCount) {
      bestCandidate = candidate;
      bestCount = info.count;
    }
  }

  if (bestCandidate && bestCount >= 2) return bestCandidate;

  const sorted = [...anchorReads].sort((a, b) => a.index - b.index);
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const deltaIndex = sorted[j].index - sorted[i].index;
      const deltaDex = sorted[j].dex - sorted[i].dex;
      if (deltaIndex === deltaDex) {
        return sorted[i].dex - sorted[i].index;
      }
    }
  }

  return bestCandidate;
}

function classifyTile(sourceCanvas, tileRect) {
  const spriteHeight = Math.max(12, Math.round(tileRect.height * (state.calibration.spriteBand / 100)));
  const spriteCanvas = document.createElement("canvas");
  spriteCanvas.width = tileRect.width;
  spriteCanvas.height = spriteHeight;
  const spriteCtx = spriteCanvas.getContext("2d", { willReadFrequently: true });
  spriteCtx.drawImage(
    sourceCanvas,
    tileRect.x,
    tileRect.y,
    tileRect.width,
    spriteHeight,
    0,
    0,
    tileRect.width,
    spriteHeight
  );

  const { data } = spriteCtx.getImageData(0, 0, spriteCanvas.width, spriteCanvas.height);
  let maskCount = 0;
  let colorPixels = 0;
  let saturationTotal = 0;

  const bg = sampleBackgroundColor(data);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = data[i + 3] / 255;
    if (alpha < 0.85) continue;
    const diff = Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b);
    if (diff < 34) continue;
    maskCount += 1;

    const saturation = computeSaturation(r, g, b);
    saturationTotal += saturation;
    if (saturation > 0.18) colorPixels += 1;
  }

  const totalPixels = data.length / 4;
  const coverage = maskCount / totalPixels;
  const colorRatio = maskCount ? colorPixels / maskCount : 0;
  const meanSaturation = maskCount ? saturationTotal / maskCount : 0;

  if (coverage < 0.028) return "missing";
  if (colorRatio > 0.33 || meanSaturation > 0.22) return "owned";
  return "seen";
}

function sampleBackgroundColor(data) {
  const samples = [];
  const pixelCount = data.length / 4;
  const step = Math.max(1, Math.floor(pixelCount / 24));
  for (let i = 0; i < pixelCount; i += step) {
    const base = i * 4;
    samples.push([data[base], data[base + 1], data[base + 2]]);
  }
  const avg = samples.reduce((sum, sample) => {
    sum.r += sample[0];
    sum.g += sample[1];
    sum.b += sample[2];
    return sum;
  }, { r: 0, g: 0, b: 0 });

  return {
    r: avg.r / samples.length,
    g: avg.g / samples.length,
    b: avg.b / samples.length
  };
}

function computeSaturation(r, g, b) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}

async function readDexNumber(worker, sourceCanvas, tileRect) {
  const numberBandHeight = Math.round(tileRect.height * (state.calibration.numberBand / 100));
  const numberCanvas = document.createElement("canvas");
  numberCanvas.width = Math.max(80, Math.round(tileRect.width * 1.8));
  numberCanvas.height = Math.max(26, Math.round(numberBandHeight * 2));
  const numberCtx = numberCanvas.getContext("2d", { willReadFrequently: true });

  numberCtx.drawImage(
    sourceCanvas,
    tileRect.x,
    tileRect.y + tileRect.height - numberBandHeight,
    tileRect.width,
    numberBandHeight,
    0,
    0,
    numberCanvas.width,
    numberCanvas.height
  );

  preprocessNumberCanvas(numberCanvas, numberCtx);
  const { data } = await worker.recognize(numberCanvas);
  const digits = String(data.text || "").replace(/[^\d]/g, "");
  if (digits.length < 2) return null;
  return Number(digits.slice(-4));
}

function preprocessNumberCanvas(canvas, ctx) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  let brightnessTotal = 0;
  for (let i = 0; i < data.length; i += 4) {
    brightnessTotal += data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
  }
  const mean = brightnessTotal / (data.length / 4);

  for (let i = 0; i < data.length; i += 4) {
    const brightness = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
    const value = brightness < mean ? 0 : 255;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}

function detectSnappedGridRect(canvas, rect) {
  try {
    const cols = 4;
    const rows = state.calibration.rowCount;
    const tileWidth = rect.width / cols;
    const tileHeight = rect.height / rows;
    const sampleRect = {
      x: Math.max(0, rect.x - Math.round(tileWidth * 0.14)),
      y: Math.max(0, rect.y - Math.round(tileHeight * 0.14)),
      width: Math.min(canvas.width - Math.max(0, rect.x - Math.round(tileWidth * 0.14)), rect.width + Math.round(tileWidth * 0.28)),
      height: Math.min(canvas.height - Math.max(0, rect.y - Math.round(tileHeight * 0.14)), rect.height + Math.round(tileHeight * 0.28))
    };
    const sampleCtx = canvas.getContext("2d", { willReadFrequently: true });
    const image = sampleCtx.getImageData(sampleRect.x, sampleRect.y, sampleRect.width, sampleRect.height);
    const vertical = scoreVerticalLines(image, sampleRect.width, sampleRect.height);
    const horizontal = scoreHorizontalLines(image, sampleRect.width, sampleRect.height);

    const left = snapAxisGroup(rect.x - sampleRect.x, tileWidth, cols, vertical, sampleRect.width);
    const top = snapAxisGroup(rect.y - sampleRect.y, tileHeight, rows, horizontal, sampleRect.height);
    const right = snapAxisSingle(rect.x - sampleRect.x + rect.width, vertical, sampleRect.width, tileWidth);
    const bottom = snapAxisSingle(rect.y - sampleRect.y + rect.height, horizontal, sampleRect.height, tileHeight);

    const snapped = {
      x: sampleRect.x + left,
      y: sampleRect.y + top,
      width: right - left,
      height: bottom - top
    };

    if (snapped.width < rect.width * 0.82 || snapped.height < rect.height * 0.82) {
      return rect;
    }
    return snapped;
  } catch {
    return rect;
  }
}

function scoreVerticalLines(image, width, height) {
  const scores = new Array(width).fill(0);
  for (let x = 1; x < width - 1; x += 1) {
    let score = 0;
    for (let y = 0; y < height; y += 3) {
      const center = pixelLuma(image.data, width, x, y);
      const left = pixelLuma(image.data, width, x - 1, y);
      const right = pixelLuma(image.data, width, x + 1, y);
      score += center * 0.6 + Math.abs(center - left) + Math.abs(center - right);
    }
    scores[x] = score;
  }
  return scores;
}

function scoreHorizontalLines(image, width, height) {
  const scores = new Array(height).fill(0);
  for (let y = 1; y < height - 1; y += 1) {
    let score = 0;
    for (let x = 0; x < width; x += 3) {
      const center = pixelLuma(image.data, width, x, y);
      const top = pixelLuma(image.data, width, x, y - 1);
      const bottom = pixelLuma(image.data, width, x, y + 1);
      score += center * 0.6 + Math.abs(center - top) + Math.abs(center - bottom);
    }
    scores[y] = score;
  }
  return scores;
}

function pixelLuma(data, width, x, y) {
  const index = (y * width + x) * 4;
  return data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
}

function snapAxis(currentBoundary, tileSize, count, scores, maxLength) {
  const searchRadius = Math.max(4, Math.round(tileSize * 0.18));
  let bestBoundary = currentBoundary;
  let bestTotal = -Infinity;

  for (let shift = -searchRadius; shift <= searchRadius; shift += 1) {
    const candidate = Math.round(currentBoundary + shift);
    if (candidate < 1 || candidate >= maxLength - 1) continue;
    let total = 0;
    for (let i = 0; i <= count; i += 1) {
      const boundary = Math.round(candidate + i * tileSize);
      if (boundary < 1 || boundary >= maxLength - 1) continue;
      total += scores[boundary] || 0;
    }
    if (total > bestTotal) {
      bestTotal = total;
      bestBoundary = candidate;
    }
  }

  return bestBoundary;
}

function snapAxisGroup(currentBoundary, tileSize, count, scores, maxLength) {
  return snapAxis(currentBoundary, tileSize, count, scores, maxLength);
}

function snapAxisSingle(currentBoundary, scores, maxLength, tileSize) {
  const searchRadius = Math.max(4, Math.round(tileSize * 0.18));
  let bestBoundary = currentBoundary;
  let bestScore = -Infinity;
  for (let shift = -searchRadius; shift <= searchRadius; shift += 1) {
    const candidate = Math.round(currentBoundary + shift);
    if (candidate < 1 || candidate >= maxLength - 1) continue;
    const score = scores[candidate] || 0;
    if (score > bestScore) {
      bestScore = score;
      bestBoundary = candidate;
    }
  }
  return bestBoundary;
}

async function getTesseractWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      const worker = await Tesseract.createWorker("eng");
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
        tessedit_char_whitelist: "0123456789"
      });
      return worker;
    })();
  }
  return tesseractWorkerPromise;
}

function applyScanResults(results) {
  const listEntries = state.lists[state.activeList];
  results.forEach(result => {
    const current = listEntries[result.dex] || {};
    if (statusRank(result.status) >= statusRank(current.status || "unknown")) {
      listEntries[result.dex] = {
        status: result.status,
        updatedAt: new Date().toISOString()
      };
    }
  });
}

function statusRank(status) {
  switch (status) {
    case "owned":
      return 3;
    case "seen":
      return 2;
    case "missing":
      return 1;
    default:
      return 0;
  }
}

function renderAll() {
  renderSummaryCards();
  renderDexTable();
  renderMatches();
  renderLogs();
}

function renderLogs() {
  if (!logPanel) return;
  const logs = state.logs || [];
  if (!logs.length) {
    logPanel.innerHTML = `<div class="log-entry"><strong>No logs yet</strong> <span>Events from capture, scans, imports, and publish attempts will appear here.</span></div>`;
    return;
  }
  logPanel.innerHTML = logs.slice().reverse().map(entry => {
    const details = entry.details ? escapeHtml(JSON.stringify(entry.details)) : "";
    return `<div class="log-entry"><strong>[${entry.level.toUpperCase()}]</strong> ${escapeHtml(entry.at)} ${escapeHtml(entry.message)}${details ? `<br><span>${details}</span>` : ""}</div>`;
  }).join("");
}

function renderSummaryCards() {
  listSummaryCards.innerHTML = "";

  let tracked = 0;
  let missing = 0;
  LIST_TYPES.forEach(list => {
    const entries = Object.values(state.lists[list.id]);
    const owned = entries.filter(entry => entry.status === "owned").length;
    const seen = entries.filter(entry => entry.status === "seen").length;
    const missingCount = entries.filter(entry => entry.status === "missing").length;
    tracked += entries.length;
    missing += missingCount;

    const card = document.createElement("article");
    card.className = "summary-card";
    card.innerHTML = `
      <span class="mini-label">${list.label}</span>
      <strong>${entries.length} tracked</strong>
      <p>Quick readout for the current captured state in this list.</p>
      <dl>
        <div><dt>Owned</dt><dd>${owned}</dd></div>
        <div><dt>Seen</dt><dd>${seen}</dd></div>
        <div><dt>Missing</dt><dd>${missingCount}</dd></div>
      </dl>
    `;
    listSummaryCards.append(card);
  });

  heroTrackedCount.textContent = tracked.toLocaleString();
  heroMissingCount.textContent = missing.toLocaleString();
}

function renderDexTable() {
  const dexSet = new Set();
  LIST_TYPES.forEach(list => {
    Object.keys(state.lists[list.id]).forEach(dex => dexSet.add(Number(dex)));
  });

  const dexNumbers = [...dexSet].sort((a, b) => a - b);
  dexTableBody.innerHTML = "";

  dexNumbers.forEach(dex => {
    const row = document.createElement("tr");
    const name = getPokemonName(dex);
    const cells = LIST_TYPES.map(list => renderStatePill(state.lists[list.id][dex]?.status || "unknown"));
    row.innerHTML = `
      <td>${String(dex).padStart(4, "0")}</td>
      <td>${name}</td>
      ${cells.map(cell => `<td>${cell}</td>`).join("")}
    `;
    dexTableBody.append(row);
  });
}

function renderStatePill(status) {
  return `<span class="state-pill ${status}">${status}</span>`;
}

function getPokemonName(dex) {
  if (nameCache[dex]) return nameCache[dex];
  return `Dex #${String(dex).padStart(4, "0")}`;
}

function getMissingEntries() {
  const missing = [];
  LIST_TYPES.forEach(list => {
    Object.entries(state.lists[list.id]).forEach(([dex, entry]) => {
      if (entry.status === "missing") {
        missing.push({
          dex: Number(dex),
          list: list.id
        });
      }
    });
  });
  return missing;
}

function renderMatches() {
  let feed;
  try {
    feed = JSON.parse(feedEditor.value);
    state.releaseFeed = feed;
    saveState();
  } catch {
    matchesTableBody.innerHTML = `<tr><td colspan="5">Release feed JSON is invalid.</td></tr>`;
    return;
  }

  const opportunities = [];
  (feed.releases || []).forEach(release => {
    (release.opportunities || []).forEach(opportunity => {
      opportunities.push({
        ...opportunity,
        releaseTitle: release.title,
        startsAt: release.startsAt,
        endsAt: release.endsAt,
        source: release.source
      });
    });
  });

  const missingEntries = getMissingEntries();
  const rows = missingEntries.flatMap(entry => {
    return opportunities
      .filter(opportunity => opportunity.list === entry.list && Number(opportunity.dex) === entry.dex)
      .map(opportunity => ({
        ...entry,
        opportunity
      }));
  }).sort((a, b) => new Date(a.opportunity.startsAt) - new Date(b.opportunity.startsAt));

  matchesTableBody.innerHTML = "";
  if (!rows.length) {
    matchesTableBody.innerHTML = `<tr><td colspan="5">No upcoming feed entries currently match your missing list statuses.</td></tr>`;
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${getPokemonName(row.dex)} <br><small>#${String(row.dex).padStart(4, "0")}</small></td>
      <td>${LIST_TYPES.find(list => list.id === row.list)?.label || row.list}</td>
      <td>${row.opportunity.releaseTitle}${row.opportunity.boost ? ` (${row.opportunity.boost})` : ""}<br><small>${row.opportunity.label || ""}</small></td>
      <td>${formatDateRange(row.opportunity.startsAt, row.opportunity.endsAt)}</td>
      <td>${row.opportunity.source || "No source yet"}</td>
    `;
    matchesTableBody.append(tr);
  });
}

function formatDateRange(start, end) {
  if (!start) return "TBA";
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const startText = startDate.toLocaleString();
  if (!endDate) return startText;
  return `${startText} - ${endDate.toLocaleString()}`;
}

function hashRect(data) {
  let hash = 0;
  for (let i = 0; i < data.length; i += 48) {
    hash = ((hash << 5) - hash) + data[i] + data[i + 1] + data[i + 2];
    hash |= 0;
  }
  return String(hash);
}

function requestMissingNames() {
  const dexNumbers = [...new Set(getMissingEntries().map(entry => entry.dex))].filter(dex => !nameCache[dex]).slice(0, 12);
  dexNumbers.forEach(fetchPokemonName);
}

async function fetchPokemonName(dex) {
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${dex}`);
    if (!response.ok) return;
    const payload = await response.json();
    const english = (payload.names || []).find(entry => entry.language?.name === "en");
    nameCache[dex] = english?.name || payload.name || `Dex #${dex}`;
    saveNameCache();
    renderAll();
  } catch {
    // Leave unresolved names as dex numbers.
  }
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pogo-pokedex-state-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importState(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
      Object.assign(state, payload);
      listTypeSelect.value = state.activeList || "pokemon";
      scanModeSelect.value = state.scanMode || "auto";
      setCalibrationInputs(state.calibration || DEFAULT_CALIBRATION);
      feedEditor.value = JSON.stringify(state.releaseFeed || DEFAULT_FEED, null, 2);
      addLog("info", "State imported");
      saveState();
      renderAll();
    } catch (error) {
      addLog("error", "State import failed", { error: error.message });
      alert(`Could not import JSON: ${error.message}`);
    } finally {
    importInput.value = "";
  }
}

async function handleUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const image = await fileToImage(file);
  previewCanvas.width = image.width;
  previewCanvas.height = image.height;
  previewCtx.drawImage(image, 0, 0);
  previewHasFrame = true;
  drawOverlay(getCalibrationRect(image.width, image.height));
  addLog("info", "Image uploaded for scanning", {
    width: image.width,
    height: image.height,
    name: file.name
  });
  await scanCurrentFrame("manual");
  uploadInput.value = "";
}

function exportLogs() {
  const payload = {
    exportedAt: new Date().toISOString(),
    logs: state.logs || [],
    history: state.history || [],
    activeList: state.activeList,
    calibration: state.calibration
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pogo-pokedex-logs-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function clearLogs() {
  state.logs = [];
  saveState();
  renderLogs();
}

function clearCurrentList() {
  state.lists[state.activeList] = {};
  lastScanTiles = [];
  addLog("warn", "Current list cleared", { list: state.activeList });
  saveState();
  renderAll();
  renderPreviewFrame();
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = reject;
    image.src = url;
  });
}

async function publishState() {
  try {
    const response = await fetch("/api/pogo-dex-state", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(state)
      });
      if (!response.ok) throw new Error(await response.text());
      lastScanSummary.textContent = "State published";
      lastScanDetail.textContent = "Your current tracker JSON was sent to the site API.";
      addLog("info", "State published to API");
    } catch (error) {
      lastScanSummary.textContent = "Publish failed";
      lastScanDetail.textContent = error.message;
      addLog("error", "State publish failed", { error: error.message });
    }
}

async function publishFeedToApi() {
  try {
    const parsed = JSON.parse(feedEditor.value);
    const response = await fetch("/api/pogo-release-feed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(parsed)
      });
      if (!response.ok) throw new Error(await response.text());
      state.releaseFeed = parsed;
      saveState();
      addLog("info", "Release feed published", { releases: parsed.releases?.length || 0 });
      renderMatches();
    } catch (error) {
      addLog("error", "Release feed publish failed", { error: error.message });
      alert(`Could not publish feed: ${error.message}`);
    }
}

async function loadFeedFromApi() {
  try {
    const response = await fetch("/api/pogo-release-feed");
    if (!response.ok) throw new Error(await response.text());
      const payload = await response.json();
      state.releaseFeed = payload;
      feedEditor.value = JSON.stringify(payload, null, 2);
      saveState();
      addLog("info", "Release feed loaded from API", { releases: payload.releases?.length || 0 });
      renderMatches();
    } catch (error) {
      addLog("error", "Release feed load failed", { error: error.message });
      alert(`Could not load feed: ${error.message}`);
    }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
