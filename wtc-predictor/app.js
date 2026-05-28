(function () {
  const STORAGE_KEY = "wtc-predictor-category-picks-v1";
  const SIMULATION_COUNT = 12000;
  const data = window.WTC_DATA;
  const model = window.WTC_MODEL;
  const teamMap = new Map(data.teams.map((team) => [team.id, team]));
  const seriesById = new Map(data.series.map((series) => [String(series.id), series]));

  const defaultSelections = buildDefaultSelections();
  let savedSelections = loadSavedSelections();
  let liveSyncState = {
    mode: "fallback",
    detail: `Using seeded ICC snapshot from ${data.snapshotLabel}.`
  };
  let simulationTimer = null;
  let simulationSummary = null;

  const currentTable = computeCurrentTable();

  renderHeaderMeta();
  renderCurrentTable();
  renderMatrix();
  renderSeriesTable();
  wireGlobalActions();
  syncLiveStatus();
  scheduleSimulation();

  function buildDefaultSelections() {
    const defaults = {};
    for (const series of data.series) {
      defaults[series.id] = getRemainingMatches(series) > 0 ? "even" : "completed";
    }
    return defaults;
  }

  function loadSavedSelections() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return structuredClone(defaultSelections);
      }
      const parsed = JSON.parse(raw);
      const merged = structuredClone(defaultSelections);
      for (const [seriesId, value] of Object.entries(parsed)) {
        if (!(seriesId in merged)) {
          continue;
        }
        merged[seriesId] = sanitizeSelection(seriesById.get(seriesId), value);
      }
      return merged;
    } catch (error) {
      return structuredClone(defaultSelections);
    }
  }

  function saveSelections() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSelections));
  }

  function sanitizeSelection(series, value) {
    if (!series || getRemainingMatches(series) <= 0) {
      return "completed";
    }
    return model.CATEGORY_OPTIONS.some((option) => option.key === value) ? value : "even";
  }

  function getRemainingMatches(series) {
    return series.matches - (series.actual.homeWins + series.actual.awayWins + series.actual.draws);
  }

  function getSeriesSelection(series) {
    return sanitizeSelection(series, savedSelections[series.id] || defaultSelections[series.id]);
  }

  function getMostLikelyProjectedSeries(series) {
    const selection = getSeriesSelection(series);
    const remaining = getRemainingMatches(series);
    if (remaining <= 0) {
      return {
        categoryKey: "completed",
        categoryLabel: "Completed",
        shortLabel: "FIN",
        homeWins: series.actual.homeWins,
        draws: series.actual.draws,
        awayWins: series.actual.awayWins
      };
    }

    const scoreline = model.getMostLikelyScoreline(remaining, selection);
    const option = model.getCategoryOption(selection);
    return {
      categoryKey: selection,
      categoryLabel: option.label,
      shortLabel: option.short,
      homeWins: series.actual.homeWins + scoreline.homeWins,
      draws: series.actual.draws + scoreline.draws,
      awayWins: series.actual.awayWins + scoreline.awayWins
    };
  }

  function computeCurrentTable() {
    const totals = buildBlankTeamTotals();
    for (const series of data.series) {
      applyRecord(totals[series.home], series.actual.homeWins, series.actual.awayWins, series.actual.draws);
      applyRecord(totals[series.away], series.actual.awayWins, series.actual.homeWins, series.actual.draws);
    }
    return finalizeTable(totals);
  }

  function buildBlankTeamTotals() {
    const totals = {};
    for (const team of data.teams) {
      totals[team.id] = {
        teamId: team.id,
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        rawPoints: 0,
        deductions: data.deductions[team.id] || 0
      };
    }
    return totals;
  }

  function applyRecord(entry, wins, losses, draws) {
    entry.played += wins + losses + draws;
    entry.wins += wins;
    entry.losses += losses;
    entry.draws += draws;
    entry.rawPoints += (wins * 12) + (draws * 4);
  }

  function finalizeTable(totals) {
    const rows = Object.values(totals).map((entry) => {
      const points = entry.rawPoints + entry.deductions;
      const maxPossiblePoints = entry.played * 12;
      const pct = maxPossiblePoints > 0 ? (points / maxPossiblePoints) * 100 : 0;
      return {
        ...entry,
        points,
        pct
      };
    });
    rows.sort(sortTableRows);
    rows.forEach((row, index) => {
      row.rank = index + 1;
    });
    return rows;
  }

  function sortTableRows(a, b) {
    if (b.pct !== a.pct) {
      return b.pct - a.pct;
    }
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    return teamMap.get(a.teamId).name.localeCompare(teamMap.get(b.teamId).name);
  }

  function renderHeaderMeta() {
    document.getElementById("snapshot-date").textContent = data.snapshotLabel;
    document.getElementById("update-cadence").textContent = data.updateCadence;
    document.getElementById("source-list").innerHTML = data.sources
      .map((source) => `<a href="${source.url}" target="_blank" rel="noopener">${source.label}</a>`)
      .join("");
    renderSyncState();
  }

  function renderSyncState() {
    const syncPill = document.getElementById("sync-pill");
    syncPill.className = `sync-pill ${liveSyncState.mode}`;
    syncPill.textContent = liveSyncState.mode === "live" ? "Live source checked" : "Seeded snapshot";
    document.getElementById("sync-detail").textContent = liveSyncState.detail;
  }

  function renderCurrentTable() {
    const tbody = document.getElementById("current-body");
    tbody.innerHTML = currentTable.map((row) => `
      <tr>
        <td>${row.rank}</td>
        <td><strong>${teamMap.get(row.teamId).name}</strong></td>
        <td>${row.played}</td>
        <td>${row.wins}</td>
        <td>${row.draws}</td>
        <td>${row.losses}</td>
        <td>${row.points}</td>
        <td>${row.deductions}</td>
        <td>${row.pct.toFixed(2)}</td>
      </tr>
    `).join("");
  }

  function renderSimulationTable() {
    const tbody = document.getElementById("simulation-body");
    const status = document.getElementById("simulation-status");

    if (!simulationSummary) {
      status.textContent = `Running ${SIMULATION_COUNT.toLocaleString()} simulations...`;
      tbody.innerHTML = "";
      return;
    }

    status.textContent = `${simulationSummary.simulations.toLocaleString()} simulations. Middle 80% rank band uses the 10th-90th percentile ranks.`;
    tbody.innerHTML = simulationSummary.rows.map((row) => `
      <tr>
        <td><strong>${teamMap.get(row.teamId).name}</strong></td>
        <td>${row.avgPoints.toFixed(1)}</td>
        <td>${row.avgPct.toFixed(2)}</td>
        <td>${row.avgWins.toFixed(2)}-${row.avgDraws.toFixed(2)}-${row.avgLosses.toFixed(2)}</td>
        <td>${row.mostLikelyRank}</td>
        <td>${formatPercent(row.topTwoChance)}</td>
        <td>${row.middle80Low}-${row.middle80High}</td>
      </tr>
    `).join("");
  }

  function renderMatrix() {
    const table = document.getElementById("matrix-table");
    table.innerHTML = "";

    const header = document.createElement("tr");
    header.innerHTML = `<th class="matrix-head">Home</th>${data.teams.map((team) => `<th class="matrix-head">${team.short}</th>`).join("")}`;
    table.appendChild(header);

    for (const home of data.teams) {
      const row = document.createElement("tr");
      row.appendChild(cell(home.short, "matrix-team"));

      for (const away of data.teams) {
        if (home.id === away.id) {
          row.appendChild(cell("-", "diagonal matrix-cell"));
          continue;
        }

        const series = data.series.find((item) => item.home === home.id && item.away === away.id);
        if (!series) {
          row.appendChild(cell("-", "diagonal matrix-cell"));
          continue;
        }

        const projected = getMostLikelyProjectedSeries(series);
        const remaining = getRemainingMatches(series);
        const classes = series.status === "completed" ? "matrix-cell done" : "matrix-cell projected";
        const content = `
          <div class="cell-score">${projected.homeWins}-${projected.draws}-${projected.awayWins}</div>
          <div class="cell-meta">${remaining ? projected.shortLabel : "final"}</div>
        `;
        row.appendChild(cell(content, classes));
      }

      table.appendChild(row);
    }
  }

  function renderSeriesTable() {
    const tbody = document.getElementById("series-body");
    tbody.innerHTML = "";

    for (const series of data.series) {
      const projected = getMostLikelyProjectedSeries(series);
      const remaining = getRemainingMatches(series);
      const home = teamMap.get(series.home);
      const away = teamMap.get(series.away);
      const scoreline = remaining > 0 ? model.getMostLikelyScoreline(remaining, projected.categoryKey) : null;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="status-pill ${series.status}">${series.stageLabel}</span></td>
        <td><strong>${home.name} v ${away.name}</strong><div class="small-note">${series.windowLabel}</div></td>
        <td>${series.matches}</td>
        <td>${formatRecord(series.actual.homeWins, series.actual.draws, series.actual.awayWins)}</td>
        <td>${remaining}</td>
        <td>
          ${remaining > 0 ? buildCategorySelect(series.id, projected.categoryKey) : '<span class="small-note">Locked</span>'}
        </td>
        <td>${remaining > 0 ? formatRecord(scoreline.homeWins, scoreline.draws, scoreline.awayWins) : '-'}</td>
        <td>${formatRecord(projected.homeWins, projected.draws, projected.awayWins)}</td>
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll("select").forEach((select) => {
      select.addEventListener("change", handleCategoryChange);
    });
  }

  function buildCategorySelect(seriesId, selectedKey) {
    const options = model.CATEGORY_OPTIONS.map((option) => `
      <option value="${option.key}" ${option.key === selectedKey ? "selected" : ""}>${option.label}</option>
    `).join("");
    return `<select class="category-select" data-series-id="${seriesId}">${options}</select>`;
  }

  function handleCategoryChange(event) {
    const select = event.target;
    const seriesId = select.dataset.seriesId;
    const series = seriesById.get(seriesId);
    savedSelections[seriesId] = sanitizeSelection(series, select.value);
    saveSelections();
    renderMatrix();
    renderSeriesTable();
    scheduleSimulation();
  }

  function scheduleSimulation() {
    if (simulationTimer) {
      window.clearTimeout(simulationTimer);
    }
    simulationSummary = null;
    renderSimulationTable();
    simulationTimer = window.setTimeout(runSimulation, 20);
  }

  function runSimulation() {
    const aggregate = buildSimulationAggregate();

    for (let simIndex = 0; simIndex < SIMULATION_COUNT; simIndex += 1) {
      const totals = buildBlankTeamTotals();
      for (const series of data.series) {
        applyRecord(totals[series.home], series.actual.homeWins, series.actual.awayWins, series.actual.draws);
        applyRecord(totals[series.away], series.actual.awayWins, series.actual.homeWins, series.actual.draws);

        const remaining = getRemainingMatches(series);
        if (remaining <= 0) {
          continue;
        }

        const categoryKey = getSeriesSelection(series);
        const simResult = model.simulateSeries(remaining, categoryKey);
        applyRecord(totals[series.home], simResult.homeWins, simResult.awayWins, simResult.draws);
        applyRecord(totals[series.away], simResult.awayWins, simResult.homeWins, simResult.draws);
      }

      const finalRows = finalizeTable(totals);
      for (const row of finalRows) {
        const bucket = aggregate[row.teamId];
        bucket.points += row.points;
        bucket.pct += row.pct;
        bucket.wins += row.wins;
        bucket.draws += row.draws;
        bucket.losses += row.losses;
        bucket.rankCounts[row.rank] += 1;
        bucket.ranks.push(row.rank);
        if (row.rank <= 2) {
          bucket.topTwo += 1;
        }
      }
    }

    simulationSummary = {
      simulations: SIMULATION_COUNT,
      rows: data.teams.map((team) => buildSummaryRow(team.id, aggregate[team.id]))
        .sort((a, b) => {
          if (b.avgPct !== a.avgPct) {
            return b.avgPct - a.avgPct;
          }
          return a.mostLikelyRank - b.mostLikelyRank;
        })
    };

    renderSimulationTable();
  }

  function buildSimulationAggregate() {
    const aggregate = {};
    for (const team of data.teams) {
      aggregate[team.id] = {
        points: 0,
        pct: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        topTwo: 0,
        ranks: [],
        rankCounts: Array(data.teams.length + 1).fill(0)
      };
    }
    return aggregate;
  }

  function buildSummaryRow(teamId, bucket) {
    const sortedRanks = bucket.ranks.slice().sort((a, b) => a - b);
    return {
      teamId,
      avgPoints: bucket.points / SIMULATION_COUNT,
      avgPct: bucket.pct / SIMULATION_COUNT,
      avgWins: bucket.wins / SIMULATION_COUNT,
      avgDraws: bucket.draws / SIMULATION_COUNT,
      avgLosses: bucket.losses / SIMULATION_COUNT,
      mostLikelyRank: getMostLikelyRank(bucket.rankCounts),
      topTwoChance: bucket.topTwo / SIMULATION_COUNT,
      middle80Low: percentileRank(sortedRanks, 0.10),
      middle80High: percentileRank(sortedRanks, 0.90)
    };
  }

  function getMostLikelyRank(rankCounts) {
    let bestRank = 1;
    let bestCount = -1;
    for (let rank = 1; rank < rankCounts.length; rank += 1) {
      if (rankCounts[rank] > bestCount) {
        bestCount = rankCounts[rank];
        bestRank = rank;
      }
    }
    return bestRank;
  }

  function percentileRank(sortedRanks, percentile) {
    if (!sortedRanks.length) {
      return "-";
    }
    const index = Math.min(sortedRanks.length - 1, Math.max(0, Math.ceil(sortedRanks.length * percentile) - 1));
    return sortedRanks[index];
  }

  function wireGlobalActions() {
    document.getElementById("reset-picks").addEventListener("click", function () {
      savedSelections = structuredClone(defaultSelections);
      saveSelections();
      renderMatrix();
      renderSeriesTable();
      scheduleSimulation();
    });
  }

  async function syncLiveStatus() {
    try {
      const response = await fetch("/api/wtc-live", { headers: { "Accept": "application/json" } });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const payload = await response.json();
      if (payload && payload.ok) {
        liveSyncState = {
          mode: payload.liveDataAvailable ? "live" : "fallback",
          detail: payload.message || liveSyncState.detail
        };
        renderSyncState();
      }
    } catch (error) {
      liveSyncState = {
        mode: "fallback",
        detail: `Using seeded ICC snapshot from ${data.snapshotLabel}. Live check unavailable right now.`
      };
      renderSyncState();
    }
  }

  function formatPercent(value) {
    return `${(value * 100).toFixed(1)}%`;
  }

  function formatRecord(homeWins, draws, awayWins) {
    return `${homeWins}-${draws}-${awayWins}`;
  }

  function cell(content, className) {
    const td = document.createElement("td");
    td.className = className;
    td.innerHTML = content;
    return td;
  }
})();
