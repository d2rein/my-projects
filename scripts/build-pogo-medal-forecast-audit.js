const fs = require("fs");
const path = require("path");

const MAX_PROJECTION_DATE = "2099-12-31";
const BLEND_RECENT_WEIGHT = 0.65;
const BLEND_HISTORICAL_WEIGHT = 0.35;

function usage() {
  console.error("Usage: node scripts/build-pogo-medal-forecast-audit.js <backup-json-path> [output-prefix]");
  process.exit(1);
}

function daysBetween(a, b) {
  const start = new Date(`${a}T00:00:00Z`);
  const end = new Date(`${b}T00:00:00Z`);
  return (end - start) / 86400000;
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Math.round(days));
  return date.toISOString().slice(0, 10);
}

function clampProjectionDate(dateStr) {
  if (!dateStr) return MAX_PROJECTION_DATE;
  return dateStr > MAX_PROJECTION_DATE ? MAX_PROJECTION_DATE : dateStr;
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function fmt(value, digits = 3) {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(digits);
}

function buildAudit(data) {
  const medals = data.medals || [];
  const snapshots = [...(data.snapshots || [])].sort((a, b) => a.date.localeCompare(b.date));
  const latest = snapshots.at(-1);
  const snapshotDates = snapshots.map((snapshot) => snapshot.date);

  function computeRate(id) {
    const segments = [];
    for (let index = 1; index < snapshots.length; index += 1) {
      const previous = snapshots[index - 1];
      const current = snapshots[index];
      const days = daysBetween(previous.date, current.date);
      if (days <= 0) continue;
      segments.push({
        start: previous.date,
        end: current.date,
        startValue: Number(previous.medals[id] || 0),
        endValue: Number(current.medals[id] || 0),
        delta: Number(current.medals[id] || 0) - Number(previous.medals[id] || 0),
        days,
        rate: (Number(current.medals[id] || 0) - Number(previous.medals[id] || 0)) / days
      });
    }
    const recent = segments.at(-1)?.rate ?? 0;
    const historical = segments.length > 1
      ? segments.slice(0, -1).reduce((sum, segment) => sum + segment.rate, 0) / segments.slice(0, -1).length
      : recent;
    const blended = segments.length
      ? recent * BLEND_RECENT_WEIGHT + historical * BLEND_HISTORICAL_WEIGHT
      : 0;
    return { recent, historical, blended, segments };
  }

  function computeProjection(medal) {
    const current = Number(latest.medals[medal.id] || 0);
    if (current >= medal.platinum) {
      return {
        mode: "completed",
        current,
        projectedDate: latest.date,
        daysRemaining: 0,
        rate: 0
      };
    }

    if (["Pokedex", "Optional"].includes(medal.type)) {
      const projectedDate = clampProjectionDate(medal.manualExpected || MAX_PROJECTION_DATE);
      return {
        mode: "manual",
        current,
        projectedDate,
        daysRemaining: Math.max(0, daysBetween(latest.date, projectedDate)),
        rate: 0
      };
    }

    const rate = computeRate(medal.id);
    if (!Number.isFinite(rate.blended) || rate.blended <= 0) {
      const projectedDate = clampProjectionDate(medal.manualExpected || MAX_PROJECTION_DATE);
      return {
        mode: "fallback-2099",
        current,
        projectedDate,
        daysRemaining: Math.max(0, daysBetween(latest.date, projectedDate)),
        rate: 0,
        rateTerms: rate
      };
    }

    const rawDaysRemaining = Math.max(0, (medal.platinum - current) / rate.blended);
    const projectedDate = clampProjectionDate(addDays(latest.date, rawDaysRemaining));
    return {
      mode: projectedDate === MAX_PROJECTION_DATE ? "capped-2099" : "rate",
      current,
      projectedDate,
      daysRemaining: Math.max(0, daysBetween(latest.date, projectedDate)),
      rate: rate.blended,
      rawDaysRemaining,
      rateTerms: rate
    };
  }

  const rows = medals.map((medal) => {
    const rate = computeRate(medal.id);
    const projection = computeProjection(medal);
    const snapshotValues = Object.fromEntries(
      snapshotDates.map((date) => {
        const snapshot = snapshots.find((item) => item.date === date);
        return [date, Number(snapshot.medals[medal.id] || 0)];
      })
    );
    return {
      id: medal.id,
      name: medal.name,
      type: medal.type,
      platinum: medal.platinum,
      current: projection.current,
      manualExpected: medal.manualExpected || "",
      projectionMode: projection.mode,
      projectedDate: projection.projectedDate,
      daysRemaining: projection.daysRemaining,
      recentRate: rate.recent,
      historicalRate: rate.historical,
      blendedRate: rate.blended,
      formula: `recent*${BLEND_RECENT_WEIGHT} + historical*${BLEND_HISTORICAL_WEIGHT}`,
      segments: rate.segments.length,
      segmentBreakdown: rate.segments
        .map((segment) => `${segment.start}->${segment.end}: Δ${segment.delta} / ${segment.days}d = ${fmt(segment.rate)}`)
        .join(" | "),
      snapshotValues
    };
  });

  return { snapshotDates, latestDate: latest.date, rows };
}

function toCsv(audit) {
  const headers = [
    "id",
    "name",
    "type",
    "platinum",
    ...audit.snapshotDates,
    "current",
    "recent_rate_per_day",
    "historical_rate_per_day",
    "blended_rate_per_day",
    "formula",
    "projection_mode",
    "manual_expected",
    "projected_date",
    "days_remaining",
    "segments",
    "segment_breakdown"
  ];

  const lines = [headers.map(csvEscape).join(",")];
  for (const row of audit.rows) {
    const values = [
      row.id,
      row.name,
      row.type,
      row.platinum,
      ...audit.snapshotDates.map((date) => row.snapshotValues[date]),
      row.current,
      fmt(row.recentRate),
      fmt(row.historicalRate),
      fmt(row.blendedRate),
      row.formula,
      row.projectionMode,
      row.manualExpected,
      row.projectedDate,
      Number.isFinite(row.daysRemaining) ? row.daysRemaining.toFixed(0) : "",
      row.segments,
      row.segmentBreakdown
    ];
    lines.push(values.map(csvEscape).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function toMarkdown(audit) {
  const lines = [];
  lines.push("# Pokemon GO Medal Forecast Audit");
  lines.push("");
  lines.push(`Latest snapshot: ${audit.latestDate}`);
  lines.push("");
  lines.push(`Projection formula: blended = recent * ${BLEND_RECENT_WEIGHT} + historical * ${BLEND_HISTORICAL_WEIGHT}`);
  lines.push("");
  lines.push("`manual` means the medal still uses `manualExpected`.");
  lines.push("`fallback-2099` means the blended rate was zero or invalid, so the date was capped to `2099-12-31`.");
  lines.push("`capped-2099` means the rate formula produced a date beyond the cap, so it was clamped.");
  lines.push("");

  const headers = [
    "id",
    "name",
    "type",
    ...audit.snapshotDates,
    "recent",
    "historical",
    "blended",
    "mode",
    "manual",
    "projected"
  ];
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);

  for (const row of audit.rows) {
    const values = [
      row.id,
      row.name,
      row.type,
      ...audit.snapshotDates.map((date) => row.snapshotValues[date]),
      fmt(row.recentRate),
      fmt(row.historicalRate),
      fmt(row.blendedRate),
      row.projectionMode,
      row.manualExpected || "",
      row.projectedDate
    ];
    lines.push(`| ${values.join(" | ")} |`);
  }

  return `${lines.join("\n")}\n`;
}

function toHtml(audit) {
  const columns = [
    "id",
    "name",
    "type",
    ...audit.snapshotDates,
    "current",
    "recent",
    "historical",
    "blended",
    "mode",
    "manual",
    "projected",
    "segments"
  ];

  const rowsHtml = audit.rows.map((row) => {
    const values = [
      row.id,
      row.name,
      row.type,
      ...audit.snapshotDates.map((date) => row.snapshotValues[date]),
      row.current,
      fmt(row.recentRate),
      fmt(row.historicalRate),
      fmt(row.blendedRate),
      row.projectionMode,
      row.manualExpected || "",
      row.projectedDate,
      row.segments
    ];
    const cells = values.map((value, index) => {
      const title = index === columns.length - 1 ? ` title="${row.segmentBreakdown.replace(/"/g, "&quot;")}"` : "";
      return `<td${title}>${String(value ?? "")}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pokemon GO Medal Forecast Audit</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #09111f;
      --panel: #111c31;
      --line: rgba(255,255,255,0.12);
      --text: #edf4ff;
      --muted: #9fb2d9;
      --accent: #7fd4ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: linear-gradient(180deg, #08101d, #0f1b31 40%, #132341);
      color: var(--text);
      padding: 24px;
    }
    .shell {
      max-width: 100%;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 2rem;
    }
    p {
      margin: 6px 0;
      color: var(--muted);
    }
    .table-wrap {
      margin-top: 18px;
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: auto;
      background: rgba(11, 18, 33, 0.82);
      box-shadow: 0 20px 40px rgba(0,0,0,0.24);
    }
    table {
      border-collapse: collapse;
      min-width: 1500px;
      width: 100%;
    }
    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      white-space: nowrap;
      text-align: left;
      font-size: 0.92rem;
    }
    th {
      position: sticky;
      top: 0;
      background: #162847;
      color: #eef7ff;
      z-index: 1;
    }
    tr:nth-child(even) td {
      background: rgba(255,255,255,0.02);
    }
    .formula {
      color: var(--accent);
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="shell">
    <h1>Pokemon GO Medal Forecast Audit</h1>
    <p>Latest snapshot: ${audit.latestDate}</p>
    <p class="formula">Projection formula: blended = recent * ${BLEND_RECENT_WEIGHT} + historical * ${BLEND_HISTORICAL_WEIGHT}</p>
    <p><code>manual</code> uses <code>manualExpected</code>. <code>fallback-2099</code> means the blended rate was zero or invalid. <code>capped-2099</code> means the rate formula overflowed the cap.</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
`;
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) usage();
  const outputPrefix = process.argv[3] || path.join("output", "pogo-medal-forecast-audit");

  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const data = raw?.data?.medals;
  if (!data?.medals || !data?.snapshots) {
    throw new Error("Backup JSON did not contain data.medals.medals and data.medals.snapshots");
  }

  const audit = buildAudit(data);
  const outputDir = path.dirname(outputPrefix);
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(`${outputPrefix}.csv`, toCsv(audit), "utf8");
  fs.writeFileSync(`${outputPrefix}.md`, toMarkdown(audit), "utf8");
  fs.writeFileSync(`${outputPrefix}.html`, toHtml(audit), "utf8");

  console.log(`Wrote ${outputPrefix}.csv`);
  console.log(`Wrote ${outputPrefix}.md`);
  console.log(`Wrote ${outputPrefix}.html`);
  const showcase = audit.rows.find((row) => row.id === "showcase_star");
  if (showcase) {
    console.log(`showcase_star => current ${showcase.current}, recent ${fmt(showcase.recentRate)}, historical ${fmt(showcase.historicalRate)}, blended ${fmt(showcase.blendedRate)}, projected ${showcase.projectedDate}, mode ${showcase.projectionMode}`);
  }
}

main();
