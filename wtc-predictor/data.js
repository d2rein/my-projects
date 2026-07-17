window.WTC_DATA = {
  snapshotDate: "2026-07-07",
  snapshotLabel: "7 July 2026",
  updateCadence: "Weekly, plus the day after a scheduled series finish when dates are known.",
  sources: [
    {
      label: "ICC WTC schedule 2025-27",
      url: "https://images.icc-cricket.com/image/upload/prd/doztximb3sxhwcc4oo3f.pdf"
    },
    {
      label: "ICC WTC standings",
      url: "https://www.icc-cricket.com/tournaments/world-test-championship/standings"
    },
    {
      label: "ICC Bangladesh v Pakistan standings update",
      url: "https://www.icc-cricket.com/news/bangladesh-jump-india-on-wtc27-standings-after-pakistan-win"
    }
  ],
  teams: [
    { id: "AUS", name: "Australia", short: "AUS" },
    { id: "BAN", name: "Bangladesh", short: "BAN" },
    { id: "ENG", name: "England", short: "ENG" },
    { id: "IND", name: "India", short: "IND" },
    { id: "NZ", name: "New Zealand", short: "NZ" },
    { id: "PAK", name: "Pakistan", short: "PAK" },
    { id: "SA", name: "South Africa", short: "SA" },
    { id: "SL", name: "Sri Lanka", short: "SL" },
    { id: "WI", name: "West Indies", short: "WI" }
  ],
  deductions: {
    AUS: 0,
    BAN: 0,
    ENG: -14,
    IND: 0,
    NZ: 0,
    PAK: -8,
    SA: 0,
    SL: 0,
    WI: -2
  },
  series: [
    {
      id: 1,
      home: "ENG",
      away: "IND",
      matches: 5,
      status: "completed",
      stageLabel: "Completed",
      windowLabel: "Jun-Aug 2025",
      actual: { homeWins: 2, awayWins: 2, draws: 1 },
      notes: "Series drawn 2-2. England incurred a 2-point over-rate deduction."
    },
    {
      id: 2,
      home: "SL",
      away: "BAN",
      matches: 2,
      status: "completed",
      stageLabel: "Completed",
      windowLabel: "Jun 2025",
      actual: { homeWins: 1, awayWins: 0, draws: 1 },
      notes: "Sri Lanka won the series 1-0."
    },
    {
      id: 3,
      home: "WI",
      away: "AUS",
      matches: 3,
      status: "completed",
      stageLabel: "Completed",
      windowLabel: "Jun-Jul 2025",
      actual: { homeWins: 0, awayWins: 3, draws: 0 },
      notes: "Australia swept the series 3-0."
    },
    {
      id: 4,
      home: "IND",
      away: "WI",
      matches: 2,
      status: "completed",
      stageLabel: "Completed",
      windowLabel: "Oct 2025",
      actual: { homeWins: 2, awayWins: 0, draws: 0 },
      notes: "India swept the series 2-0."
    },
    {
      id: 5,
      home: "PAK",
      away: "SA",
      matches: 2,
      status: "completed",
      stageLabel: "Completed",
      windowLabel: "Oct 2025",
      actual: { homeWins: 1, awayWins: 1, draws: 0 },
      notes: "Series drawn 1-1."
    },
    {
      id: 6,
      home: "IND",
      away: "SA",
      matches: 2,
      status: "completed",
      stageLabel: "Completed",
      windowLabel: "Nov 2025",
      actual: { homeWins: 0, awayWins: 2, draws: 0 },
      notes: "South Africa swept the series 2-0."
    },
    {
      id: 7,
      home: "NZ",
      away: "WI",
      matches: 3,
      status: "completed",
      stageLabel: "Completed",
      windowLabel: "Dec 2025",
      actual: { homeWins: 2, awayWins: 0, draws: 1 },
      notes: "New Zealand won the series 2-0."
    },
    {
      id: 8,
      home: "AUS",
      away: "ENG",
      matches: 5,
      status: "completed",
      stageLabel: "Completed",
      windowLabel: "Nov 2025-Jan 2026",
      actual: { homeWins: 4, awayWins: 1, draws: 0 },
      notes: "Australia won the Ashes 4-1."
    },
    {
      id: 9,
      home: "BAN",
      away: "PAK",
      matches: 2,
      status: "completed",
      stageLabel: "Completed",
      windowLabel: "8-20 May 2026",
      scheduledEnd: "2026-05-20",
      actual: { homeWins: 2, awayWins: 0, draws: 0 },
      notes: "Bangladesh swept the series 2-0."
    },
    {
      id: 10,
      home: "ENG",
      away: "NZ",
      matches: 3,
      status: "completed",
      stageLabel: "Completed",
      windowLabel: "4-26 Jun 2026",
      actual: { homeWins: 1, awayWins: 2, draws: 0 },
      notes: "New Zealand won the series 2-1."
    },
    {
      id: 11,
      home: "WI",
      away: "SL",
      matches: 2,
      status: "completed",
      stageLabel: "Completed",
      windowLabel: "11-29 Jun 2026",
      actual: { homeWins: 1, awayWins: 1, draws: 0 },
      notes: "Series drawn 1-1."
    },
    {
      id: 12,
      home: "WI",
      away: "PAK",
      matches: 2,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "Later in 2026",
      actual: { homeWins: 0, awayWins: 0, draws: 0 }
    },
    {
      id: 13,
      home: "SL",
      away: "IND",
      matches: 2,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "Later in 2026",
      actual: { homeWins: 0, awayWins: 0, draws: 0 }
    },
    {
      id: 14,
      home: "ENG",
      away: "PAK",
      matches: 3,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "Later in 2026",
      actual: { homeWins: 0, awayWins: 0, draws: 0 }
    },
    {
      id: 15,
      home: "AUS",
      away: "BAN",
      matches: 2,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "13-26 Aug 2026",
      scheduledEnd: "2026-08-26",
      actual: { homeWins: 0, awayWins: 0, draws: 0 },
      notes: "Official ICC dates announced in February 2026."
    },
    {
      id: 16,
      home: "SA",
      away: "AUS",
      matches: 3,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "9-31 Oct 2026",
      scheduledEnd: "2026-10-31",
      actual: { homeWins: 0, awayWins: 0, draws: 0 }
    },
    {
      id: 17,
      home: "BAN",
      away: "WI",
      matches: 2,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "Later in 2026",
      actual: { homeWins: 0, awayWins: 0, draws: 0 }
    },
    {
      id: 18,
      home: "NZ",
      away: "IND",
      matches: 2,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "Later in 2026",
      actual: { homeWins: 0, awayWins: 0, draws: 0 }
    },
    {
      id: 19,
      home: "SA",
      away: "BAN",
      matches: 2,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "15-27 Nov 2026",
      scheduledEnd: "2026-11-27",
      actual: { homeWins: 0, awayWins: 0, draws: 0 }
    },
    {
      id: 20,
      home: "PAK",
      away: "SL",
      matches: 2,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "Later in 2026",
      actual: { homeWins: 0, awayWins: 0, draws: 0 }
    },
    {
      id: 21,
      home: "AUS",
      away: "NZ",
      matches: 4,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "Dec 2026-Jan 2027",
      actual: { homeWins: 0, awayWins: 0, draws: 0 },
      notes: "Official window referenced by ICC in February 2026."
    },
    {
      id: 22,
      home: "SA",
      away: "ENG",
      matches: 3,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "17 Dec 2026-7 Jan 2027",
      scheduledEnd: "2027-01-07",
      actual: { homeWins: 0, awayWins: 0, draws: 0 }
    },
    {
      id: 23,
      home: "NZ",
      away: "SL",
      matches: 2,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "Early 2027",
      actual: { homeWins: 0, awayWins: 0, draws: 0 }
    },
    {
      id: 24,
      home: "IND",
      away: "AUS",
      matches: 5,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "Early 2027",
      actual: { homeWins: 0, awayWins: 0, draws: 0 }
    },
    {
      id: 25,
      home: "BAN",
      away: "ENG",
      matches: 2,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "Early 2027",
      actual: { homeWins: 0, awayWins: 0, draws: 0 }
    },
    {
      id: 26,
      home: "SL",
      away: "SA",
      matches: 2,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "Early 2027",
      actual: { homeWins: 0, awayWins: 0, draws: 0 }
    },
    {
      id: 27,
      home: "PAK",
      away: "NZ",
      matches: 2,
      status: "upcoming",
      stageLabel: "Upcoming",
      windowLabel: "Early 2027",
      actual: { homeWins: 0, awayWins: 0, draws: 0 }
    }
  ]
};
