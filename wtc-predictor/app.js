(function () {
  const STORAGE_KEY = "wtc-predictor-series-picks-v1";
  const data = window.WTC_DATA;
  const teamMap = new Map(data.teams.map((team) => [team.id, team]));
  const seriesById = new Map(data.series.map((series) => [String(series.id), series]));

  const defaultPredictions = buildDefaultPredictions();
  let savedPredictions = loadSavedPredictions();

  const currentTable = computeCurrentTable();
  const rangeMap = computeRankRange(currentTable);

  renderHeaderCards();
  renderMatrix();
  renderSeriesTable();
  renderCurrentTable();
  renderProjectedTable();
  wireGlobalActions();

  function buildDefaultPredictions() {
    const defaults = {};
    for (const series of data.series) {
      const remaining = getRemainingMatches(series);
      defaults[series.id] = {
        homeExtraWins: defaultHomeWins(remaining),
        awayExtraWins: defaultAwayWins(remaining)
      };
    }
    return defaults;
  }

  function defaultHomeWins(remaining) {
    if (remaining <= 0) {
      return 0;
    }
    if (remaining === 2) {
      return 1;
    }
    if (remaining === 3) {
      return 2;
    }
    if (remaining === 4) {
      return 2;
    }
    return 3;
  }

  function defaultAwayWins(remaining) {
    if (remaining <= 2) {
      return 0;
    }
    if (remaining === 3) {
      return 0;
    }
    return 1;
  }

  function loadSavedPredictions() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return structuredClone(defaultPredictions);
      }
      const parsed = JSON.parse(raw);
      const merged = structuredClone(defaultPredictions);
      for (const [seriesId, prediction] of Object.entries(parsed)) {
        if (!merged[seriesId]) {
          continue;
        }
        merged[seriesId] = sanitizePrediction(seriesById.get(seriesId), prediction);
      }
      return merged;
    } catch (error) {
      return structuredClone(defaultPredictions);
    }
  }

  function savePredictions() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPredictions));
  }

  function sanitizePrediction(series, prediction) {
    const remaining = getRemainingMatches(series);
    const homeExtraWins = clampInt(prediction.homeExtraWins, 0, remaining);
    const awayExtraWins = clampInt(prediction.awayExtraWins, 0, remaining - homeExtraWins);
    return { homeExtraWins, awayExtraWins };
  }

  function clampInt(value, min, max) {
    const numeric = Number.parseInt(value, 10);
    if (Number.isNaN(numeric)) {
      return min;
    }
    return Math.max(min, Math.min(max, numeric));
  }

  function getRemainingMatches(series) {
    return series.matches - (series.actual.homeWins + series.actual.awayWins + series.actual.draws);
  }

  function getProjectedSeries(series) {
    const prediction = sanitizePrediction(series, savedPredictions[series.id] || defaultPredictions[series.id]);
    const remaining = getRemainingMatches(series);
    const projectedDraws = remaining - prediction.homeExtraWins - prediction.awayExtraWins;
    return {
      ...series.actual,
      homeWins: series.actual.homeWins + prediction.homeExtraWins,
      awayWins: series.actual.awayWins + prediction.awayExtraWins,
      draws: series.actual.draws + projectedDraws,
      remaining,
      projectedDraws,
      prediction
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

  function computeProjectedTable() {
    const totals = buildBlankTeamTotals();
    for (const series of data.series) {
      const projected = getProjectedSeries(series);
      applyRecord(totals[series.home], projected.homeWins, projected.awayWins, projected.draws);
      applyRecord(totals[series.away], projected.awayWins, projected.homeWins, projected.draws);
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
        deductions: data.deductions[team.id] || 0,
        totalMatches: getTotalScheduledMatches(team.id)
      };
    }
    return totals;
  }

  function getTotalScheduledMatches(teamId) {
    return data.series.reduce((sum, series) => {
      if (series.home === teamId || series.away === teamId) {
        return sum + series.matches;
      }
      return sum;
    }, 0);
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

  function computeRankRange(tableRows) {
    const rowsById = new Map(tableRows.map((row) => [row.teamId, row]));
    const rangeByTeam = {};

    for (const team of data.teams) {
      const row = rowsById.get(team.id);
      const totalAvailable = row.totalMatches * 12;
      const remainingMatches = row.totalMatches - row.played;
      const minPct = totalAvailable > 0 ? (row.points / totalAvailable) * 100 : 0;
      const maxPct = totalAvailable > 0 ? ((row.points + (remainingMatches * 12)) / totalAvailable) * 100 : 0;

      let guaranteedAbove = 0;
      let guaranteedBelow = 0;

      for (const other of data.teams) {
        if (other.id === team.id) {
          continue;
        }
        const otherRow = rowsById.get(other.id);
        const otherTotal = otherRow.totalMatches * 12;
        const otherRemaining = otherRow.totalMatches - otherRow.played;
        const otherMinPct = otherTotal > 0 ? (otherRow.points / otherTotal) * 100 : 0;
        const otherMaxPct = otherTotal > 0 ? ((otherRow.points + (otherRemaining * 12)) / otherTotal) * 100 : 0;

        if (otherMinPct > maxPct) {
          guaranteedAbove += 1;
        }
        if (otherMaxPct < minPct) {
          guaranteedBelow += 1;
        }
      }

      rangeByTeam[team.id] = {
        bestRank: guaranteedAbove + 1,
        worstRank: data.teams.length - guaranteedBelow,
        minPct,
        maxPct
      };
    }

    return rangeByTeam;
  }

  function renderHeaderCards() {
    document.getElementById("snapshot-date").textContent = data.snapshotLabel;
    document.getElementById("update-cadence").textContent = data.updateCadence;
    document.getElementById("current-leader").textContent = teamMap.get(currentTable[0].teamId).name;

    const projectedTable = computeProjectedTable();
    document.getElementById("projected-leader").textContent = teamMap.get(projectedTable[0].teamId).name;

    const sourceHost = new URL(data.sources[0].url).hostname.replace(/^www\./, "");
    document.getElementById("source-host").textContent = sourceHost;

    const sourceList = document.getElementById("source-list");
    sourceList.innerHTML = data.sources
      .map((source) => `<a href="${source.url}" target="_blank" rel="noopener">${source.label}</a>`)
      .join("");
  }

  function renderMatrix() {
    const table = document.getElementById("matrix-table");
    const header = document.createElement("tr");
    header.innerHTML = `<th>Home \\ Away</th>${data.teams.map((team) => `<th>${team.short}</th>`).join("")}`;
    table.appendChild(header);

    for (const home of data.teams) {
      const row = document.createElement("tr");
      row.appendChild(cell(`<strong>${home.short}</strong><span>${home.name}</span>`, "team-axis"));

      for (const away of data.teams) {
        if (home.id === away.id) {
          row.appendChild(cell("-", "diagonal"));
          continue;
        }

        const series = data.series.find((item) => item.home === home.id && item.away === away.id);
        if (!series) {
          row.appendChild(cell("-", "diagonal"));
          continue;
        }

        const projected = getProjectedSeries(series);
        const remaining = getRemainingMatches(series);
        const classes = series.status === "completed" ? "matrix-cell done" : "matrix-cell projected";
        const content = `
          <div class="cell-score">${projected.homeWins}-${projected.draws}-${projected.awayWins}</div>
          <div class="cell-meta">${remaining ? `${remaining} left` : "final"}</div>
          <div class="cell-note">${series.matches} Tests</div>
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
      const projected = getProjectedSeries(series);
      const remaining = getRemainingMatches(series);
      const home = teamMap.get(series.home);
      const away = teamMap.get(series.away);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="status-pill ${series.status}">${series.stageLabel}</span></td>
        <td>
          <strong>${home.name} v ${away.name}</strong>
          <div class="row-note">${series.windowLabel}</div>
        </td>
        <td>${series.matches}</td>
        <td>${formatRecord(series.actual.homeWins, series.actual.draws, series.actual.awayWins)}</td>
        <td>${remaining}</td>
        <td>
          <input class="mini-input" type="number" min="0" max="${remaining}" value="${projected.prediction.homeExtraWins}" data-role="home-extra" data-series-id="${series.id}" ${remaining ? "" : "disabled"}>
        </td>
        <td>
          <input class="mini-input" type="number" min="0" max="${remaining}" value="${projected.prediction.awayExtraWins}" data-role="away-extra" data-series-id="${series.id}" ${remaining ? "" : "disabled"}>
        </td>
        <td>${projected.projectedDraws}</td>
        <td>${formatRecord(projected.homeWins, projected.draws, projected.awayWins)}</td>
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", handlePredictionInput);
    });
  }

  function handlePredictionInput(event) {
    const input = event.target;
    const seriesId = input.dataset.seriesId;
    const role = input.dataset.role;
    const series = seriesById.get(seriesId);
    const remaining = getRemainingMatches(series);

    const next = sanitizePrediction(series, savedPredictions[seriesId] || defaultPredictions[seriesId]);
    next[role === "home-extra" ? "homeExtraWins" : "awayExtraWins"] = clampInt(input.value, 0, remaining);

    if ((next.homeExtraWins + next.awayExtraWins) > remaining) {
      if (role === "home-extra") {
        next.awayExtraWins = Math.max(0, remaining - next.homeExtraWins);
      } else {
        next.homeExtraWins = Math.max(0, remaining - next.awayExtraWins);
      }
    }

    savedPredictions[seriesId] = next;
    savePredictions();
    rerenderDynamicSections();
  }

  function renderCurrentTable() {
    const tbody = document.getElementById("current-body");
    tbody.innerHTML = currentTable.map((row) => {
      const range = rangeMap[row.teamId];
      return `
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
          <td>${range.bestRank}</td>
          <td>${range.worstRank}</td>
        </tr>
      `;
    }).join("");
  }

  function renderProjectedTable() {
    const projectedTable = computeProjectedTable();
    document.getElementById("projected-leader").textContent = teamMap.get(projectedTable[0].teamId).name;

    const tbody = document.getElementById("projected-body");
    tbody.innerHTML = projectedTable.map((row) => `
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

  function rerenderDynamicSections() {
    document.getElementById("matrix-table").innerHTML = "";
    renderMatrix();
    renderSeriesTable();
    renderProjectedTable();
  }

  function wireGlobalActions() {
    document.getElementById("reset-picks").addEventListener("click", function () {
      savedPredictions = structuredClone(defaultPredictions);
      savePredictions();
      rerenderDynamicSections();
    });
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
