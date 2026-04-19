import { useState, useMemo, useCallback, useEffect } from "react";

// ============================================================
// ASTRONOMICAL CALCULATION ENGINE — Sidereal positions
// Based on Jean Meeus "Astronomical Algorithms"
// ============================================================

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

const SIGN_SYMBOLS = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];

const SIGN_COLORS = [
  "#ef4444","#10b981","#f59e0b","#6366f1","#f97316","#22c55e",
  "#ec4899","#dc2626","#8b5cf6","#64748b","#06b6d4","#818cf8"
];

// Palette for additional people — distinct from gold (fave tint) and red (unfave tint)
const PERSON_COLORS = [
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#ec4899", // pink
  "#f97316", // orange
  "#14b8a6", // teal
  "#84cc16", // lime
  "#a855f7", // purple
  "#3b82f6", // blue
  "#d946ef", // fuchsia
  "#22d3ee", // sky
];

const PEOPLE_STORAGE_KEY = "favedayapp.people";
const MAX_PEOPLE = 11;

const OPPOSITE_SIGN = {
  0:6, 1:7, 2:8, 3:9, 4:10, 5:11,
  6:0, 7:1, 8:2, 9:3, 10:4, 11:5
};

// Convert date to Julian Day Number
function dateToJD(year, month, day) {
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) +
         Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

// Julian centuries from J2000.0
function julianCenturies(jd) {
  return (jd - 2451545.0) / 36525.0;
}

// Normalize angle to 0-360
function norm360(deg) {
  return ((deg % 360) + 360) % 360;
}

// Degrees to radians
function rad(deg) { return deg * Math.PI / 180; }

// ---- SUN LONGITUDE (tropical) ----
function sunLongitude(T) {
  // Geometric mean longitude
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  // Mean anomaly
  const M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mrad = rad(M);
  // Equation of center
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad) +
            (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
            0.000289 * Math.sin(3 * Mrad);
  // Sun's true longitude
  let longitude = L0 + C;
  // Apparent longitude (nutation correction)
  const omega = 125.04 - 1934.136 * T;
  longitude = longitude - 0.00569 - 0.00478 * Math.sin(rad(omega));
  return norm360(longitude);
}

// ---- MOON LONGITUDE (tropical) — Meeus Chapter 47 ----
function moonLongitude(T) {
  // Fundamental arguments
  const Lp = norm360(218.3164477 + 481267.88123421 * T -
    0.0015786 * T * T + T * T * T / 538841.0 - T * T * T * T / 65194000.0);
  const D = norm360(297.8501921 + 445267.1114034 * T -
    0.0018819 * T * T + T * T * T / 545868.0 - T * T * T * T / 113065000.0);
  const M = norm360(357.5291092 + 35999.0502909 * T -
    0.0001536 * T * T + T * T * T / 24490000.0);
  const Mp = norm360(134.9633964 + 477198.8675055 * T +
    0.0087414 * T * T + T * T * T / 69699.0 - T * T * T * T / 14712000.0);
  const F = norm360(93.2720950 + 483202.0175233 * T -
    0.0036539 * T * T - T * T * T / 3526000.0 + T * T * T * T / 863310000.0);

  const A1 = norm360(119.75 + 131.849 * T);
  const A2 = norm360(53.09 + 479264.290 * T);
  const A3 = norm360(313.45 + 481266.484 * T);

  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const E2 = E * E;

  // Longitude terms [D, M, Mp, F, coeff]
  const lTerms = [
    [0,0,1,0,6288774], [2,0,-1,0,1274027], [2,0,0,0,658314],
    [0,0,2,0,213618], [0,1,0,0,-185116], [0,0,0,2,-114332],
    [2,0,-2,0,58793], [2,-1,-1,0,57066], [2,0,1,0,53322],
    [2,-1,0,0,45758], [0,1,-1,0,-40923], [1,0,0,0,-34720],
    [0,1,1,0,-30383], [2,0,0,-2,15327], [0,0,1,2,-12528],
    [0,0,1,-2,10980], [4,0,-1,0,10675], [0,0,3,0,10034],
    [4,0,-2,0,8548], [2,1,-1,0,-7888], [2,1,0,0,-6766],
    [1,0,-1,0,-5163], [1,1,0,0,4987], [2,-1,1,0,4036],
    [2,0,2,0,3994], [4,0,0,0,3861], [2,0,-3,0,3665],
    [0,1,-2,0,-2689], [2,0,-1,2,-2602], [2,-1,-2,0,2390],
    [1,0,1,0,-2348], [2,-2,0,0,2236], [0,1,2,0,-2120],
    [0,2,0,0,-2069], [2,-2,-1,0,2048], [2,0,1,-2,-1773],
    [2,0,0,2,-1595], [4,-1,-1,0,1215], [0,0,2,2,-1110],
    [3,0,-1,0,-892], [2,1,1,0,-810], [4,-1,-2,0,759],
    [0,2,-1,0,-713], [2,2,-1,0,-700], [2,1,-2,0,691],
    [2,-1,0,-2,596], [4,0,1,0,549], [0,0,4,0,537],
    [4,-1,0,0,520], [1,0,-2,0,-487], [2,1,0,-2,-399],
    [0,0,2,-2,-381], [1,1,1,0,351], [3,0,-2,0,-340],
    [4,0,-3,0,330], [2,-1,2,0,327], [0,2,1,0,-323],
    [1,1,-1,0,299], [2,0,3,0,294]
  ];

  let sumL = 0;
  for (const [d, m, mp, f, coeff] of lTerms) {
    let c = coeff;
    if (Math.abs(m) === 1) c *= E;
    if (Math.abs(m) === 2) c *= E2;
    sumL += c * Math.sin(rad(d * D + m * M + mp * Mp + f * F));
  }

  // Additional corrections
  sumL += 3958 * Math.sin(rad(A1));
  sumL += 1962 * Math.sin(rad(Lp - F));
  sumL += 318 * Math.sin(rad(A2));

  const longitude = Lp + sumL / 1000000.0;
  return norm360(longitude);
}

// ---- LAHIRI AYANAMSA ----
// Based on the Indian government's official Lahiri ayanamsa
function lahiriAyanamsa(jd) {
  const T = (jd - 2451545.0) / 36525.0;
  // Lahiri ayanamsa: ~23.85° at J2000.0, precessing at ~50.29"/year
  // More precise formula from Indian Astronomical Ephemeris
  const ayan = 23.85 + (50.2912 / 3600) * ((jd - 2451545.0) / 365.25);
  // Nutation correction
  const omega = 125.04452 - 1934.136261 * T;
  const Ls = 280.4665 + 36000.7698 * T;
  const Lm = 218.3165 + 481267.8813 * T;
  const nutation = -17.2 / 3600 * Math.sin(rad(omega))
                  - 1.32 / 3600 * Math.sin(rad(2 * Ls))
                  - 0.23 / 3600 * Math.sin(rad(2 * Lm))
                  + 0.21 / 3600 * Math.sin(rad(2 * omega));
  return ayan + nutation;
}

// ---- GET SIDEREAL SIGN ----
function getSiderealSign(tropicalLongitude, jd) {
  const ayan = lahiriAyanamsa(jd);
  const siderealLong = norm360(tropicalLongitude - ayan);
  return Math.floor(siderealLong / 30);
}

function getSiderealLongitude(tropicalLongitude, jd) {
  const ayan = lahiriAyanamsa(jd);
  return norm360(tropicalLongitude - ayan);
}

// ---- SIDEREAL SUN SIGN FROM BIRTH DATE + TIME ----
function getSiderealSunSign(year, month, day, hour = 12) {
  // hour is 0-23, convert to fractional day (0 = midnight, 12 = noon)
  const fracDay = day + hour / 24.0;
  const jd = dateToJD(year, month, fracDay);
  const T = julianCenturies(jd);
  const tropSun = sunLongitude(T);
  return getSiderealSign(tropSun, jd);
}

// ---- MOON SIGN FOR A GIVEN DATE + HOUR (local time) ----
function getMoonSignForDateTime(year, month, day, hour = 12) {
  // Convert local hour to UTC for the astronomical calculation
  const localOffsetHrs = -(new Date().getTimezoneOffset()) / 60;
  const utcHour = hour - localOffsetHrs;
  const jd = dateToJD(year, month, day + utcHour / 24.0);
  const T = julianCenturies(jd);
  const tropMoon = moonLongitude(T);
  return getSiderealSign(tropMoon, jd);
}

// ---- FIND MOON TRANSIT PERIODS FOR THE YEAR ----
// Returns an array of transit objects: { sign, startDate, startHour, endDate, endHour }
function findMoonTransits(year) {
  const transits = [];
  // Start from Dec 31 of prior year to catch transits that begin before Jan 1
  const startJD = dateToJD(year, 1, 0); // Dec 31 of prior year, midnight
  const endJD = dateToJD(year + 1, 1, 1); // Jan 1 of next year, midnight

  // Check every 2 hours to find sign changes, then refine
  const STEP = 2 / 24; // 2 hours in days
  let prevSign = null;
  let transitStart = null;
  let transitStartDate = null;

  for (let jd = startJD; jd <= endJD; jd += STEP) {
    const T = julianCenturies(jd);
    const tropMoon = moonLongitude(T);
    const sign = getSiderealSign(tropMoon, jd);

    if (prevSign === null) {
      prevSign = sign;
      transitStart = jd;
      transitStartDate = jdToDate(jd);
      continue;
    }

    if (sign !== prevSign) {
      // Found a boundary — refine to nearest ~15 minutes using bisection
      let lo = jd - STEP;
      let hi = jd;
      for (let i = 0; i < 8; i++) { // 8 iterations ≈ 0.5 min precision
        const mid = (lo + hi) / 2;
        const Tm = julianCenturies(mid);
        const mLong = moonLongitude(Tm);
        const mSign = getSiderealSign(mLong, mid);
        if (mSign === prevSign) lo = mid;
        else hi = mid;
      }
      const boundaryJD = (lo + hi) / 2;

      // Record the completed transit
      const endInfo = jdToDate(boundaryJD);
      const startInfo = jdToDate(transitStart);
      transits.push({
        sign: prevSign,
        startJD: transitStart,
        endJD: boundaryJD,
        startYear: startInfo.year, startMonth: startInfo.month, startDay: startInfo.day, startHour: startInfo.hour,
        endYear: endInfo.year, endMonth: endInfo.month, endDay: endInfo.day, endHour: endInfo.hour,
      });

      prevSign = sign;
      transitStart = boundaryJD;
    }
  }

  // Close final transit
  if (prevSign !== null) {
    const endInfo = jdToDate(endJD);
    const startInfo = jdToDate(transitStart);
    transits.push({
      sign: prevSign,
      startJD: transitStart, endJD: endJD,
      startYear: startInfo.year, startMonth: startInfo.month, startDay: startInfo.day, startHour: startInfo.hour,
      endYear: endInfo.year, endMonth: endInfo.month, endDay: endInfo.day, endHour: endInfo.hour,
    });
  }

  // Filter to transits that overlap with the target year
  return transits.filter(t => t.endYear >= year && t.startYear <= year);
}

// Get browser's UTC offset in fractional days (e.g., CST = -6hrs = -0.25 days)
// getTimezoneOffset() returns minutes, positive for west of UTC
function getLocalOffsetDays() {
  return -(new Date().getTimezoneOffset()) / (60 * 24);
}

// Convert JD (UTC) back to date components, shifted to local time
function jdToDate(jd) {
  const localJD = jd + getLocalOffsetDays(); // shift UTC → local
  const z = Math.floor(localJD + 0.5);
  const f = (localJD + 0.5) - z;
  let A;
  if (z < 2299161) { A = z; }
  else {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    A = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const dayFrac = B - D - Math.floor(30.6001 * E) + f;
  const day = Math.floor(dayFrac);
  const hourFrac = (dayFrac - day) * 24;
  const hour = Math.round(hourFrac);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  return { year, month, day, hour: hour >= 24 ? 0 : hour };
}

// Format hour as 12h string
function formatHour(h) {
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}${ampm}`;
}

// ---- GENERATE RANGE DATA (12 months starting from startYear/startMonth) ----
function generateYearData(startYear, sunSign, startMonth) {
  // If startMonth not provided, default to full calendar year (backward compat)
  if (startMonth === undefined) startMonth = 0; // 0-indexed
  const oppositeSign = OPPOSITE_SIGN[sunSign];

  // Collect all transits covering the 12-month range (may span 2 calendar years)
  const endMonth = startMonth + 12;
  const endYear = startYear + Math.floor((startMonth + 11) / 12);
  const yearsNeeded = new Set();
  for (let m = startMonth; m < endMonth; m++) {
    yearsNeeded.add(startYear + Math.floor(m / 12));
  }
  let transits = [];
  for (const yr of yearsNeeded) {
    transits = transits.concat(findMoonTransits(yr));
  }
  // Deduplicate transits by startJD
  const seen = new Set();
  transits = transits.filter(t => {
    if (seen.has(t.startJD)) return false;
    seen.add(t.startJD);
    return true;
  });

  const results = [];

  for (let mi = 0; mi < 12; mi++) {
    const absMonth = startMonth + mi;
    const yr = startYear + Math.floor(absMonth / 12);
    const m = absMonth % 12; // 0-indexed month
    const daysInMonth = new Date(yr, m + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const moonSign = getMoonSignForDateTime(yr, m + 1, d, 12);
      let type = "neutral";
      if (moonSign === sunSign) type = "fave";
      else if (moonSign === oppositeSign) type = "unfave";

      // Find which transit this day belongs to
      const dayJD = dateToJD(yr, m + 1, d + 0.5);
      const transit = transits.find(t => dayJD >= t.startJD && dayJD < t.endJD);

      // Determine if this day is the start or end of a fave/unfave transit
      let transitStartHour = null;
      let transitEndHour = null;
      let transitStartDate = null;
      let transitEndDate = null;

      if (transit && (type === "fave" || type === "unfave")) {
        transitStartDate = `${transit.startYear}-${String(transit.startMonth).padStart(2,"0")}-${String(transit.startDay).padStart(2,"0")}`;
        transitEndDate = `${transit.endYear}-${String(transit.endMonth).padStart(2,"0")}-${String(transit.endDay).padStart(2,"0")}`;

        // If transit starts on this day
        if (transit.startYear === yr && transit.startMonth === m + 1 && transit.startDay === d) {
          transitStartHour = transit.startHour;
        }
        // If transit ends on this day (or the next day at hour 0)
        if (transit.endYear === yr && transit.endMonth === m + 1 && transit.endDay === d) {
          transitEndHour = transit.endHour;
        }
      }

      results.push({
        date: new Date(yr, m, d),
        dateStr: `${yr}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,
        moonSign,
        type,
        transitStartHour,
        transitEndHour,
        transitStartDate,
        transitEndDate,
      });
    }
  }
  return results;
}

// ============================================================
// PEOPLE HELPERS — multi-person state + persistence
// ============================================================

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "p-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function createPerson({ name, month, day, year, hour, colorIndex }) {
  const h = hour === null || hour === undefined ? 12 : hour;
  const sunSign = getSiderealSunSign(year, month, day, h);
  return {
    id: makeId(),
    name: (name || "").trim() || "Me",
    month, day, year,
    hour: hour === null || hour === undefined ? null : hour,
    sunSign,
    color: PERSON_COLORS[(colorIndex % PERSON_COLORS.length + PERSON_COLORS.length) % PERSON_COLORS.length],
    visible: true,
  };
}

function loadPeople() {
  try {
    const raw = localStorage.getItem(PEOPLE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(p => p && typeof p.year === "number" && typeof p.month === "number" && typeof p.day === "number")
      .map((p, idx) => {
        const hr = p.hour === null || p.hour === undefined ? 12 : p.hour;
        return {
          id: p.id || makeId(),
          name: typeof p.name === "string" && p.name.trim() ? p.name : (idx === 0 ? "Me" : `Person ${idx + 1}`),
          month: p.month, day: p.day, year: p.year,
          hour: p.hour === null || p.hour === undefined ? null : p.hour,
          // Re-derive sunSign as a safety net
          sunSign: getSiderealSunSign(p.year, p.month, p.day, hr),
          color: typeof p.color === "string" ? p.color : PERSON_COLORS[idx % PERSON_COLORS.length],
          visible: p.visible !== false,
        };
      })
      .slice(0, MAX_PEOPLE);
  } catch {
    return [];
  }
}

function savePeople(people) {
  try {
    if (people.length === 0) localStorage.removeItem(PEOPLE_STORAGE_KEY);
    else localStorage.setItem(PEOPLE_STORAGE_KEY, JSON.stringify(people));
  } catch {
    // ignore (private browsing, quota, etc.)
  }
}

// Compute a unique short label per person — starts at 1 char, grows until no
// other person shares the same prefix. So [Mom, Mike] -> {Mom: "Mo", Mike: "Mi"}.
function computeInitials(people) {
  const names = people.map(p => (p.name || "").trim() || "?");
  const out = {};
  for (let i = 0; i < people.length; i++) {
    const name = names[i];
    let len = 1;
    while (len < name.length) {
      const me = name.slice(0, len).toLowerCase();
      const clash = names.some((n, j) => j !== i && n.slice(0, len).toLowerCase() === me);
      if (!clash) break;
      len++;
    }
    const raw = name.slice(0, len);
    out[people[i].id] = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }
  return out;
}

// ---- ICS HELPERS ----
function formatICSDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatICSDateTime(date, hour) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  return `${y}${m}${d}T${hh}0000`;
}

function nextDay(date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
}

// Groups consecutive days of the same type, preserving the entries so
// we can use `transitStartHour` / `transitEndHour` on the boundary days.
function groupConsecutive(days) {
  if (days.length === 0) return [];
  const groups = [];
  let startEntry = days[0];
  let prevEntry = days[0];
  for (let i = 1; i < days.length; i++) {
    const diff = (days[i].date - prevEntry.date) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      prevEntry = days[i];
    } else {
      groups.push({ start: startEntry.date, end: prevEntry.date, startEntry, endEntry: prevEntry });
      startEntry = days[i];
      prevEntry = days[i];
    }
  }
  groups.push({ start: startEntry.date, end: prevEntry.date, startEntry, endEntry: prevEntry });
  return groups;
}

function icsStamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}T${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}00`;
}

function personEventLines({ person, yearData, type, includeName }) {
  const isFave = type === "fave";
  const sign = isFave ? person.sunSign : OPPOSITE_SIGN[person.sunSign];
  const label = isFave ? "Fave" : "Unfave";
  const days = yearData.filter(d => d.type === type);
  const groups = groupConsecutive(days);
  const stamp = icsStamp();
  const lines = [];
  let uid = 1;
  for (const g of groups) {
    const count = Math.round((g.end - g.start) / (1000*60*60*24)) + 1;
    const prefix = includeName ? `${person.name} — ` : "";
    const startHour = g.startEntry && g.startEntry.transitStartHour;
    const endHour = g.endEntry && g.endEntry.transitEndHour;
    const hasStartHour = startHour !== null && startHour !== undefined;
    const hasEndHour = endHour !== null && endHour !== undefined;

    lines.push("BEGIN:VEVENT");
    if (hasStartHour || hasEndHour) {
      // Timed event — use the transit boundary hours we know, fall back to
      // midnight / next-midnight for the unknown side so the event still
      // spans the full period.
      const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const dtStart = hasStartHour
        ? formatICSDateTime(g.start, startHour)
        : formatICSDateTime(g.start, 0);
      const dtEnd = hasEndHour
        ? formatICSDateTime(g.end, endHour)
        : formatICSDateTime(nextDay(g.end), 0);
      lines.push(`DTSTART;TZID=${tzid}:${dtStart}`);
      lines.push(`DTEND;TZID=${tzid}:${dtEnd}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${formatICSDate(g.start)}`);
      lines.push(`DTEND;VALUE=DATE:${formatICSDate(nextDay(g.end))}`);
    }
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`UID:faveday-${person.id}-${type}-${uid++}@favedayapp`);
    lines.push(`SUMMARY:${prefix}${SIGN_SYMBOLS[sign]} ${label} Day${count > 1 ? "s" : ""} (${SIGNS[sign]} Moon)`);
    const whoseSign = includeName ? `${person.name}'s` : "your";
    const timeLine = (hasStartHour || hasEndHour)
      ? `\\n\\nStarts ~${hasStartHour ? formatHour(startHour) : "midnight"}, ends ~${hasEndHour ? formatHour(endHour) : "midnight"}.`
      : "";
    lines.push(
      `DESCRIPTION:${isFave
        ? `The Moon is in ${SIGNS[sign]} (${whoseSign} sidereal Sun sign). Enjoy!`
        : `The Moon is in ${SIGNS[sign]}, opposite ${whoseSign} sidereal Sun sign.`}${timeLine}`
    );
    lines.push("END:VEVENT");
  }
  return lines;
}

// Build a combined ICS across every visible person. type: 'fave' | 'unfave' | 'all'
function buildCombinedICS({ people, peopleYearData, type }) {
  const visiblePeople = people.filter(p => p.visible);
  const includeName = visiblePeople.length > 1;
  const calName = type === "unfave" ? "Unfave Days" : "Fave Days";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//Fave Day App//Sidereal Moon Tracker//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${calName}`,
  ];
  for (const p of visiblePeople) {
    const yd = peopleYearData[p.id] || [];
    if (type === "fave" || type === "all") {
      lines.push(...personEventLines({ person: p, yearData: yd, type: "fave", includeName }));
    }
    if (type === "unfave" || type === "all") {
      lines.push(...personEventLines({ person: p, yearData: yd, type: "unfave", includeName }));
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function triggerDownload(content, filename) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadCombinedICS(people, peopleYearData, type) {
  const content = buildCombinedICS({ people, peopleYearData, type });
  const filename = type === "all" ? "fave-unfave-days.ics"
    : type === "fave" ? "fave-days.ics"
    : "unfave-days.ics";
  triggerDownload(content, filename);
}

function downloadPersonICS(person, yearData, type) {
  const calName = type === "fave" ? "Fave Days"
    : type === "unfave" ? "Unfave Days"
    : "Fave & Unfave Days";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//Fave Day App//Sidereal Moon Tracker//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${person.name} — ${calName}`,
  ];
  if (type === "fave" || type === "all") {
    lines.push(...personEventLines({ person, yearData, type: "fave", includeName: false }));
  }
  if (type === "unfave" || type === "all") {
    lines.push(...personEventLines({ person, yearData, type: "unfave", includeName: false }));
  }
  lines.push("END:VCALENDAR");
  const safeName = person.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "person";
  const suffix = type === "all" ? "fave-unfave" : `${type}`;
  triggerDownload(lines.join("\r\n"), `${safeName}-${suffix}-days.ics`);
}

// ============================================================
// MONTH NAMES AND HELPERS
// ============================================================
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

// ============================================================
// COMPONENTS
// ============================================================

// Starfield background
function Starfield() {
  const stars = useMemo(() => {
    const s = [];
    for (let i = 0; i < 200; i++) {
      s.push({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() * 2.5 + 0.5,
        opacity: Math.random() * 0.7 + 0.3,
        delay: Math.random() * 5
      });
    }
    return s;
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      {stars.map((s, i) => (
        <div key={i} style={{
          position: "absolute", left: s.left, top: s.top,
          width: s.size, height: s.size, borderRadius: "50%",
          backgroundColor: "#fff", opacity: s.opacity,
          animation: `twinkle ${2 + s.delay}s ease-in-out infinite alternate`,
          animationDelay: `${s.delay}s`
        }} />
      ))}
    </div>
  );
}

// Calendar month component — supports multiple people
// Every visible person renders as a chip inside each cell; chip color = person,
// solid fill = fave, outlined = unfave. No person-specific background treatment.
function CalendarMonth({ year, month, people, peopleYearData, initials, onSelectDay }) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const visiblePeople = people.filter(p => p.visible);
  const isSolo = visiblePeople.length === 1;

  function entryFor(person, d) {
    const yd = peopleYearData[person.id];
    if (!yd) return null;
    return yd.find(e =>
      e.date.getFullYear() === year &&
      e.date.getMonth() === month &&
      e.date.getDate() === d
    ) || null;
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const MAX_CHIPS = 4;

  return (
    <div style={{
      background: "rgba(15, 10, 40, 0.7)",
      border: "1px solid rgba(139, 92, 246, 0.25)",
      borderRadius: 16, padding: "16px 12px",
      backdropFilter: "blur(10px)"
    }}>
      <div style={{
        textAlign: "center", fontSize: 16, fontWeight: 700,
        color: "#c4b5fd", marginBottom: 12, letterSpacing: 1
      }}>
        {MONTH_NAMES[month]} {year}
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        gap: 2, textAlign: "center", fontSize: 10,
        color: "rgba(196,181,253,0.5)", marginBottom: 6
      }}>
        {DAY_NAMES.map(d => <div key={d}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />;
          const d = cell;

          // Contributors: every visible person with a fave/unfave on this day
          const contributors = [];
          for (const p of visiblePeople) {
            const e = entryFor(p, d);
            if (e && (e.type === "fave" || e.type === "unfave")) {
              contributors.push({ person: p, entry: e });
            }
          }

          const anyFave = contributors.some(c => c.entry.type === "fave");
          const anyUnfave = contributors.some(c => c.entry.type === "unfave");

          // Tooltip — always include times when we know the transit boundary
          let tooltip = "";
          if (contributors.length === 0) {
            if (isSolo) {
              const e = entryFor(visiblePeople[0], d);
              if (e) tooltip = `${SIGNS[e.moonSign]} Moon`;
            }
          } else if (isSolo) {
            const c = contributors[0];
            const label = c.entry.type === "fave" ? "Fave Day" : "Unfave Day";
            tooltip = `${label} (${SIGNS[c.entry.moonSign]} Moon)`;
            if (c.entry.transitStartHour !== null) tooltip += `\nStarts ~${formatHour(c.entry.transitStartHour)}`;
            if (c.entry.transitEndHour !== null) tooltip += `\nEnds ~${formatHour(c.entry.transitEndHour)}`;
          } else {
            tooltip = contributors.map(c => {
              const label = c.entry.type === "fave" ? "Fave Day" : "Unfave Day";
              let line = `${c.person.name} — ${label} (${SIGNS[c.entry.moonSign]} Moon)`;
              if (c.entry.transitStartHour !== null) line += ` · starts ~${formatHour(c.entry.transitStartHour)}`;
              if (c.entry.transitEndHour !== null) line += ` · ends ~${formatHour(c.entry.transitEndHour)}`;
              return line;
            }).join("\n");
          }

          // Solo-mode time tag (boundary days)
          let hasTimeTag = false;
          let timeTagText = "";
          let timeTagIsStart = false;
          if (isSolo && contributors.length === 1) {
            const e = contributors[0].entry;
            if (e.transitStartHour !== null) {
              hasTimeTag = true; timeTagIsStart = true;
              timeTagText = formatHour(e.transitStartHour);
            } else if (e.transitEndHour !== null) {
              hasTimeTag = true; timeTagIsStart = false;
              timeTagText = formatHour(e.transitEndHour);
            }
          }

          // Soft cell tint — gold if fave-only, brown if unfave-only, purple if mixed
          let cellBackground = "transparent";
          let cellBorder = "1px solid transparent";
          if (anyFave && !anyUnfave) {
            cellBackground = "radial-gradient(circle, rgba(250,204,21,0.32) 0%, rgba(250,204,21,0.08) 100%)";
            cellBorder = "1px solid rgba(250,204,21,0.4)";
          } else if (anyUnfave && !anyFave) {
            cellBackground = "radial-gradient(circle, rgba(180,83,9,0.28) 0%, rgba(180,83,9,0.08) 100%)";
            cellBorder = "1px solid rgba(180,83,9,0.35)";
          } else if (anyFave && anyUnfave) {
            cellBackground = "radial-gradient(circle, rgba(139,92,246,0.22) 0%, rgba(139,92,246,0.06) 100%)";
            cellBorder = "1px solid rgba(139,92,246,0.35)";
          }

          const cellTextColor = anyFave && !anyUnfave ? "#fef08a"
            : anyUnfave && !anyFave ? "#fdba74"
            : anyFave && anyUnfave ? "#e9d5ff"
            : "rgba(255,255,255,0.5)";

          const shown = contributors.slice(0, MAX_CHIPS);
          const overflow = Math.max(0, contributors.length - MAX_CHIPS);

          const isClickable = contributors.length > 0 && typeof onSelectDay === "function";
          return (
            <div key={i} title={tooltip}
              onClick={isClickable ? () => onSelectDay({ year, month, day: d, contributors }) : undefined}
              style={{
                aspectRatio: "1",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
                padding: "3px 0",
                borderRadius: 8, position: "relative",
                fontSize: 12,
                fontWeight: contributors.length > 0 ? 700 : 400,
                color: cellTextColor,
                background: cellBackground,
                border: cellBorder,
                cursor: isClickable ? "pointer" : "default",
                transition: "all 0.2s"
              }}>
              <div style={{ lineHeight: 1, marginTop: 1 }}>{d}</div>

              {hasTimeTag && (
                <div style={{
                  fontSize: 6, lineHeight: 1, marginTop: 1,
                  opacity: 0.75, letterSpacing: -0.3
                }}>
                  {timeTagIsStart ? `▸${timeTagText}` : `${timeTagText}▸`}
                </div>
              )}

              {contributors.length > 0 && !isSolo && (
                <div style={{
                  marginTop: "auto", marginBottom: 2,
                  display: "flex", flexWrap: "wrap", justifyContent: "center",
                  alignItems: "center", gap: 2, maxWidth: "100%",
                  pointerEvents: "none"
                }}>
                  {shown.map((c, idx) => {
                    const isFaveChip = c.entry.type === "fave";
                    const label = (initials && initials[c.person.id]) || (c.person.name.trim()[0] || "?").toUpperCase();
                    return (
                      <span key={idx} style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        minWidth: 12, height: 12, padding: label.length > 1 ? "0 3px" : 0,
                        borderRadius: 7, boxSizing: "border-box",
                        fontSize: 8, fontWeight: 800, lineHeight: 1, letterSpacing: 0,
                        background: isFaveChip ? c.person.color : "transparent",
                        border: `1.5px solid ${c.person.color}`,
                        color: isFaveChip ? "#0a0015" : c.person.color,
                        boxShadow: isFaveChip ? "0 0 0 0.5px rgba(0,0,0,0.35)" : "none"
                      }}>
                        {label}
                      </span>
                    );
                  })}
                  {overflow > 0 && (
                    <span style={{
                      fontSize: 8, lineHeight: 1, color: "rgba(255,255,255,0.7)",
                      fontWeight: 700, marginLeft: 1
                    }}>+{overflow}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Upcoming fave/unfave transit periods — spans every visible person
function UpcomingDays({ people, peopleYearData, type, limit = 5 }) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const visiblePeople = people.filter(p => p.visible);
  const showNames = visiblePeople.length > 1;

  // Collect transit periods across every visible person, tagged with the person
  const allPeriods = [];
  for (const person of visiblePeople) {
    const yd = peopleYearData[person.id] || [];
    const ofType = yd.filter(d => d.type === type);
    let current = null;
    for (const d of ofType) {
      if (!current) {
        current = { person, start: d, end: d };
      } else {
        const diff = (d.date - current.end.date) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          current.end = d;
        } else {
          allPeriods.push(current);
          current = { person, start: d, end: d };
        }
      }
    }
    if (current) allPeriods.push(current);
  }

  const upcoming = allPeriods
    .filter(p => p.end.date >= today)
    .sort((a, b) => a.start.date - b.start.date)
    .slice(0, limit);

  const isFave = type === "fave";
  const color = isFave ? "#fef08a" : "#fdba74";
  const label = isFave ? "Fave Days" : "Unfave Days";
  const emoji = isFave ? "✨" : "🙃";

  function fmtDate(d) {
    return d.date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div style={{
      background: "rgba(15, 10, 40, 0.7)",
      border: `1px solid ${isFave ? "rgba(250,204,21,0.3)" : "rgba(180,83,9,0.35)"}`,
      borderRadius: 16, padding: 20,
      backdropFilter: "blur(10px)"
    }}>
      <h3 style={{ color, fontSize: 16, fontWeight: 700, margin: "0 0 12px 0", letterSpacing: 1 }}>
        {emoji} Upcoming {label}
      </h3>
      {upcoming.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>None remaining this year</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {upcoming.map((p, i) => {
            const startTime = p.start.transitStartHour !== null ? formatHour(p.start.transitStartHour) : null;
            const endTime = p.end.transitEndHour !== null ? formatHour(p.end.transitEndHour) : null;
            const sameDay = p.start.dateStr === p.end.dateStr;

            return (
              <div key={i} style={{
                padding: "10px 14px", borderRadius: 12,
                background: isFave ? "rgba(250,204,21,0.08)" : "rgba(180,83,9,0.18)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    {showNames && (
                      <>
                        <span style={{
                          width: 10, height: 10, borderRadius: "50%",
                          background: p.person.color, display: "inline-block", flexShrink: 0
                        }} />
                        <span style={{
                          color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 90
                        }}>
                          {p.person.name}
                        </span>
                      </>
                    )}
                    <span style={{ color: "rgba(255,255,255,0.88)", fontSize: 14, fontWeight: 600 }}>
                      {sameDay ? fmtDate(p.start) : `${fmtDate(p.start)} → ${fmtDate(p.end)}`}
                    </span>
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, whiteSpace: "nowrap" }}>
                    {SIGN_SYMBOLS[p.start.moonSign]} {SIGNS[p.start.moonSign]}
                  </span>
                </div>
                {(startTime || endTime) && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                    {startTime && endTime
                      ? `~${startTime} → ~${endTime}`
                      : startTime
                      ? `Starts ~${startTime}`
                      : `Ends ~${endTime}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Educational section
function LearnSection() {
  return (
    <div style={{
      background: "rgba(15, 10, 40, 0.7)",
      border: "1px solid rgba(139, 92, 246, 0.25)",
      borderRadius: 20, padding: "32px 28px",
      backdropFilter: "blur(10px)",
      maxWidth: 800, margin: "0 auto",
      lineHeight: 1.7
    }}>
      <h2 style={{ color: "#c4b5fd", fontSize: 24, fontWeight: 800, marginTop: 0, marginBottom: 8, textAlign: "center" }}>
        Why Sidereal Time Matters
      </h2>
      <p style={{ color: "rgba(196,181,253,0.6)", textAlign: "center", fontSize: 14, marginBottom: 28 }}>
        Understanding the real sky vs. the calendar sky
      </p>

      <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 15 }}>
        <h3 style={{ color: "#fef08a", fontSize: 17, marginBottom: 8 }}>The Wobble That Changes Everything</h3>
        <p>
          Earth doesn't spin perfectly upright. It wobbles on its axis like a spinning top winding down.
          This slow wobble, called <strong style={{color:"#c4b5fd"}}>axial precession</strong>, takes about 25,772 years
          to complete one full cycle. Over centuries, this gradually shifts where the constellations appear
          relative to the calendar dates.
        </p>
        <p>
          When Western (tropical) astrology was first developed around 2,000 years ago, the Sun really was in
          the constellation Aries at the spring equinox. But because of precession, the spring equinox point
          has drifted backward through nearly an entire zodiac sign. Today, the Sun is actually in Pisces during
          what tropical astrology still calls "Aries season."
        </p>

        <h3 style={{ color: "#fef08a", fontSize: 17, marginTop: 24, marginBottom: 8 }}>Tropical vs. Sidereal: Two Different Systems</h3>
        <p>
          <strong style={{color:"#c4b5fd"}}>Tropical astrology</strong> anchors the zodiac to the seasons, specifically
          to the spring equinox point. It defines 0° Aries as the moment the Sun crosses the celestial equator heading
          north each spring, regardless of which constellation is actually behind it. This means tropical signs have
          drifted roughly 24° away from the constellations they're named after.
        </p>
        <p>
          <strong style={{color:"#c4b5fd"}}>Sidereal astrology</strong> anchors the zodiac to the actual fixed stars.
          It accounts for precession by applying a correction called the <strong style={{color:"#c4b5fd"}}>ayanamsa</strong>
          (currently about 24°) to align the zodiac signs with their corresponding constellations. This is the system
          used in Vedic (Jyotish) astrology and is consistent with what astronomers observe in the real sky.
        </p>

        <h3 style={{ color: "#fef08a", fontSize: 17, marginTop: 24, marginBottom: 8 }}>Why Astronomers Use Sidereal Time</h3>
        <p>
          Professional astronomers rely on sidereal time to track celestial objects. A sidereal day is measured by
          Earth's rotation relative to the distant stars, not the Sun. Observatories worldwide use sidereal clocks
          to know exactly when a star, galaxy, or planet will cross their field of view. If the people pointing
          telescopes at the actual sky use sidereal measurements, it makes sense that astrology based on real
          star positions would too.
        </p>

        <h3 style={{ color: "#fef08a", fontSize: 17, marginTop: 24, marginBottom: 8 }}>What This Means for Your Sign</h3>
        <p>
          If you've always identified as a certain tropical sign, your sidereal sign is very likely one sign earlier.
          For example, if tropical astrology says you're a Leo, sidereal astrology may place your Sun in Cancer.
          This app calculates your true sidereal Sun sign based on where the Sun actually was among the stars
          on the day you were born, then tracks the Moon's real position through those same constellations
          to find your Fave and Unfave days all year long.
        </p>

        <div style={{
          marginTop: 28, padding: "16px 20px",
          background: "rgba(139, 92, 246, 0.12)",
          border: "1px solid rgba(139, 92, 246, 0.3)",
          borderRadius: 12, fontSize: 14, color: "rgba(196,181,253,0.85)"
        }}>
          <strong style={{color:"#c4b5fd"}}>The Lahiri Ayanamsa:</strong> This app uses the Lahiri ayanamsa,
          officially adopted by the Indian government and the most widely used correction value in Vedic astrology.
          It is recalculated for each date to maintain accuracy as precession continues its slow march.
        </div>
      </div>
    </div>
  );
}


// Tips & Advice section
function TipsSection() {
  const cardStyle = {
    background: "rgba(15, 10, 40, 0.6)",
    border: "1px solid rgba(139, 92, 246, 0.2)",
    borderRadius: 16, padding: "24px 22px",
    marginBottom: 20
  };
  const tipStyle = {
    color: "rgba(255,255,255,0.75)", fontSize: 14, lineHeight: 1.7,
    margin: "8px 0 0 0"
  };

  return (
    <div style={{
      maxWidth: 800, margin: "0 auto", lineHeight: 1.7
    }}>
      <h2 style={{ color: "#c4b5fd", fontSize: 24, fontWeight: 800, marginTop: 0, marginBottom: 8, textAlign: "center" }}>
        Tips & Advice
      </h2>
      <p style={{ color: "rgba(196,181,253,0.6)", textAlign: "center", fontSize: 14, marginBottom: 28 }}>
        Practical wisdom from years of tracking these days
      </p>

      {/* The Big Idea */}
      <div style={{
        ...cardStyle,
        background: "rgba(139, 92, 246, 0.1)",
        border: "1px solid rgba(139, 92, 246, 0.3)",
        textAlign: "center", padding: "28px 24px"
      }}>
        <div style={{ fontSize: 14, color: "rgba(196,181,253,0.7)", marginBottom: 6, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
          The Most Important Thing
        </div>
        <p style={{ color: "rgba(255,255,255,0.88)", fontSize: 16, margin: "0 0 12px 0", fontWeight: 500 }}>
          Do not stress. Knowing about these days can be helpful but don't take it too intensely.
          An Unfave day doesn't mean a guaranteed bad day and a Fave day doesn't mean a guaranteed great day.
          This app is meant to give you a little helpful insight but do not let it stress you out.
          Everyday is a miracle to be grateful for.
        </p>
      </div>

      {/* Fave Day Tips */}
      <div style={{
        ...cardStyle,
        borderColor: "rgba(250, 204, 21, 0.25)"
      }}>
        <h3 style={{ color: "#fef08a", fontSize: 18, margin: "0 0 14px 0", fontWeight: 700 }}>
          How to Use Highly Fave Days
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={tipStyle}>
            <strong style={{ color: "#fef08a" }}>Think of Fave Days as days when the solar system is in harmony with your natural born energy.</strong> Because of that,
            it can be a good time to take a little more risk than usual, though nothing too extreme or too far out of
            your comfort zone. These are excellent days for trying new things, following through on opportunities,
            tackling difficult projects you have been putting off, starting new ventures, asking for what you want,
            visiting new places, stretching beyond your comfort zone, and getting more done than usual. In many cases,
            things will go at least a little more smoothly than normal, and sometimes much more smoothly.
          </div>
          <div style={tipStyle}>
            <strong style={{ color: "#fef08a" }}>Be more social and say yes to invitations more often than you normally would.</strong> They tend to be strong days
            for connection, visibility, and putting yourself out there. Trust the opportunities that show up. You can
            usually place more confidence in opportunities that arise on Fave Days or are scheduled for one.
          </div>
          <div style={tipStyle}>
            <strong style={{ color: "#fef08a" }}>That said, this is not a time to be careless or overconfident.</strong> It is not about acting as if you are
            untouchable. In fact, about once a year, one of my Highly Fave Days turns out to be very challenging.
            Even then, I have noticed that within a few weeks, I often realize those challenges led to major benefits.
          </div>
        </div>
      </div>

      {/* Unfave Day Tips */}
      <div style={{
        ...cardStyle,
        borderColor: "rgba(239, 68, 68, 0.25)"
      }}>
        <h3 style={{ color: "#fca5a5", fontSize: 18, margin: "0 0 14px 0", fontWeight: 700 }}>
          How to Use Unfave Days
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={tipStyle}>
            Do not automatically think of it as a bad day. Instead, think of it as a day where your energy is slightly
            out of harmony with the solar system and it's only temporary. You can actually come to really enjoy these days.
          </div>
          <div style={tipStyle}>
            <strong style={{ color: "#fca5a5" }}>Give yourself permission to rest.</strong> I recommend taking the day off whenever possible.
            You may find it beneficial to release the need to be as productive as you usually are these days. Instead
            you can spend time doing some of your favorite activities you usually don't have time for like: watching
            movies, working on pet projects that don't really matter or have any big significance, experimenting with
            new hobbies, taking extra long walks in nature etc. If you're someone who always wants to be super
            productive, it can actually feel good to take a couple days off a month.
          </div>
          <div style={tipStyle}>
            <strong style={{ color: "#fca5a5" }}>Don't force productivity.</strong> Sometimes when you try to get a lot done on these
            days, you may realize at the end of the day you would have been better off doing nothing.
            The effort-to-result ratio can be a little off.
          </div>
          <div style={tipStyle}>
            <strong style={{ color: "#fca5a5" }}>Take extra precautions.</strong> Lock your car. Drive the speed limit. Leave extra
            early and expect delays. If you have to work with computers, expect issues and errors. Double check and
            triple check things. Take as little risk as possible. Don't push your luck unnecessarily.
          </div>
          <div style={tipStyle}>
            <strong style={{ color: "#fca5a5" }}>Be skeptical of new opportunities.</strong> Put less trust in any opportunity that
            appears on these days or is scheduled for these days. In my experience, things that get scheduled for a
            future Unfave day often end up getting cancelled anyway.
          </div>
          <div style={tipStyle}>
            <strong style={{ color: "#fca5a5" }}>Use them to find hidden issues.</strong> Problems tend to surface on Unfave days.
            This isn't because the day creates issues, it just helps expose them. Though uncomfortable, this is
            actually helpful because once exposed, issues become much easier to resolve.
          </div>
          <div style={tipStyle}>
            <strong style={{ color: "#fca5a5" }}>You can still have fun.</strong> You know those activities that you love to do but
            feel slightly guilty about because they're not very productive, don't make money, and aren't necessarily
            moving you closer to your goals? For some it's reading a romance novel, others it's playing video games,
            or watching their favorite TV series all day. For me it's playing disc golf or goofing off in the music
            studio. Unfave days are the perfect day to give yourself permission to enjoy these activities guilt free.
            Because of this I have actually learned to look forward to my Unfave days.
          </div>
          <div style={tipStyle}>
            <strong style={{ color: "#fca5a5" }}>What not to do.</strong> Not a great day to skydive for the first time or
            take on other high risk activities. I wouldn't recommend making major purchases or decisions on these days.
            Sometimes it's unavoidable and that's ok, but if you can hold off until your Unfave days pass, it's
            probably worth it.
          </div>
        </div>
      </div>
    </div>
  );
}


// Day detail popup — shown when a fave/unfave cell is clicked
function DayDetailModal({ selected, onClose, isSolo }) {
  const { year, month, day, contributors } = selected;
  const dateLabel = new Date(year, month, day).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(4,2,15,0.72)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "linear-gradient(135deg, rgba(26,10,46,0.98), rgba(15,10,40,0.98))",
        border: "1px solid rgba(139,92,246,0.4)",
        borderRadius: 18, padding: "24px 26px",
        maxWidth: 440, width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        color: "#fff"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ color: "#c4b5fd", fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
            Day Details
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "rgba(196,181,253,0.7)",
            fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 0
          }}>×</button>
        </div>
        <h3 style={{ margin: "0 0 18px 0", fontSize: 20, fontWeight: 800, color: "#fff" }}>
          {dateLabel}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {contributors.map((c, i) => {
            const isFave = c.entry.type === "fave";
            const label = isFave ? "Fave Day" : "Unfave Day";
            const accent = isFave ? "#fef08a" : "#fdba74";
            const bg = isFave ? "rgba(250,204,21,0.10)" : "rgba(180,83,9,0.18)";
            const border = isFave ? "rgba(250,204,21,0.35)" : "rgba(180,83,9,0.45)";
            const hasStart = c.entry.transitStartHour !== null && c.entry.transitStartHour !== undefined;
            const hasEnd = c.entry.transitEndHour !== null && c.entry.transitEndHour !== undefined;
            return (
              <div key={i} style={{
                padding: "12px 14px", borderRadius: 12,
                background: bg, border: `1px solid ${border}`
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  {!isSolo && (
                    <span style={{
                      width: 12, height: 12, borderRadius: "50%",
                      background: c.person.color, flexShrink: 0,
                      boxShadow: "0 0 0 1px rgba(255,255,255,0.15)"
                    }} />
                  )}
                  {!isSolo && (
                    <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>
                      {c.person.name}
                    </span>
                  )}
                  <span style={{ color: accent, fontSize: 14, fontWeight: 700 }}>
                    {label}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginLeft: "auto" }}>
                    {SIGN_SYMBOLS[c.entry.moonSign]} {SIGNS[c.entry.moonSign]} Moon
                  </span>
                </div>
                {(hasStart || hasEnd) ? (
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
                    {hasStart && <div>Starts ~{formatHour(c.entry.transitStartHour)}</div>}
                    {hasEnd && <div>Ends ~{formatHour(c.entry.transitEndHour)}</div>}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                    In progress all day (no transit boundary today)
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{
          marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.4)",
          textAlign: "center"
        }}>
          Times in {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function FaveDayApp() {
  const [page, setPage] = useState("home"); // home, results, learn, tips
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthHour, setBirthHour] = useState("");
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const [displayStartMonth, setDisplayStartMonth] = useState(new Date().getMonth()); // 0-indexed

  // Multi-person state
  const [people, setPeople] = useState([]);
  const [editingPersonId, setEditingPersonId] = useState(null); // null | 'new' | <id>
  const [formName, setFormName] = useState("");
  const [formMonth, setFormMonth] = useState("");
  const [formDay, setFormDay] = useState("");
  const [formYear, setFormYear] = useState("");
  const [formHour, setFormHour] = useState("");
  const [formError, setFormError] = useState("");
  const [perPersonOpen, setPerPersonOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null); // { year, month, day, contributors }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Hydrate from localStorage on mount; skip straight to results if we have anyone stored.
  useEffect(() => {
    const stored = loadPeople();
    if (stored.length > 0) {
      setPeople(stored);
      setPage("results");
    }
  }, []);

  // Persist on every change
  useEffect(() => {
    savePeople(people);
  }, [people]);

  // Precompute year data per person. Memoized on people + window so we don't
  // re-run the astronomical engine more than necessary.
  const peopleYearData = useMemo(() => {
    const map = {};
    for (const p of people) {
      map[p.id] = generateYearData(displayYear, p.sunSign, displayStartMonth);
    }
    return map;
  }, [people, displayYear, displayStartMonth]);

  const calculate = useCallback(() => {
    setError("");
    const y = parseInt(birthYear);
    const m = parseInt(birthMonth);
    const d = parseInt(birthDay);

    if (!y || !m || !d || y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
      setError("Please enter a valid date of birth.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      try {
        const hr = birthHour === "" ? null : parseInt(birthHour);
        const primary = createPerson({
          name: "Me", month: m, day: d, year: y, hour: hr, colorIndex: 0,
        });
        setPeople([primary]);
        const now = new Date();
        setDisplayYear(now.getFullYear());
        setDisplayStartMonth(now.getMonth());
        setPage("results");
      } catch {
        setError("Calculation error. Please check your date.");
      }
      setLoading(false);
    }, 100);
  }, [birthYear, birthMonth, birthDay, birthHour]);

  const switchRange = useCallback((direction) => {
    if (people.length === 0) return;
    setDisplayYear(y => y + direction);
  }, [people.length]);

  // ---- Person CRUD handlers ----
  const openAddForm = useCallback(() => {
    if (people.length >= MAX_PEOPLE) return;
    setEditingPersonId("new");
    setFormName("");
    setFormMonth(""); setFormDay(""); setFormYear(""); setFormHour("");
    setFormError("");
  }, [people.length]);

  const openEditForm = useCallback((person) => {
    setEditingPersonId(person.id);
    setFormName(person.name);
    setFormMonth(String(person.month));
    setFormDay(String(person.day));
    setFormYear(String(person.year));
    setFormHour(person.hour === null ? "" : String(person.hour));
    setFormError("");
  }, []);

  const cancelForm = useCallback(() => {
    setEditingPersonId(null);
    setFormError("");
  }, []);

  const submitForm = useCallback(() => {
    setFormError("");
    const name = formName.trim();
    const y = parseInt(formYear);
    const m = parseInt(formMonth);
    const d = parseInt(formDay);
    if (!name) { setFormError("Please enter a name."); return; }
    if (!y || !m || !d || y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
      setFormError("Please enter a valid date of birth.");
      return;
    }
    const hr = formHour === "" ? null : parseInt(formHour);
    if (editingPersonId === "new") {
      if (people.length >= MAX_PEOPLE) { setFormError(`Maximum ${MAX_PEOPLE} people.`); return; }
      const next = createPerson({
        name, month: m, day: d, year: y, hour: hr, colorIndex: people.length,
      });
      setPeople([...people, next]);
    } else {
      setPeople(people.map(p => {
        if (p.id !== editingPersonId) return p;
        const h = hr === null ? 12 : hr;
        return {
          ...p,
          name, month: m, day: d, year: y, hour: hr,
          sunSign: getSiderealSunSign(y, m, d, h),
        };
      }));
    }
    setEditingPersonId(null);
  }, [editingPersonId, formName, formMonth, formDay, formYear, formHour, people]);

  const deletePerson = useCallback((id) => {
    setPeople(prev => prev.filter(p => p.id !== id));
    setEditingPersonId(cur => (cur === id ? null : cur));
  }, []);

  const togglePersonVisibility = useCallback((id) => {
    setPeople(prev => prev.map(p => p.id === id ? { ...p, visible: !p.visible } : p));
  }, []);

  const clearAllAndGoHome = useCallback(() => {
    setPeople([]);
    setEditingPersonId(null);
    setBirthMonth(""); setBirthDay(""); setBirthYear(""); setBirthHour("");
    setPage("home");
  }, []);

  // Shared styles
  const containerStyle = {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0a0015 0%, #0d0b2e 30%, #1a0a2e 60%, #0a0015 100%)",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#fff", position: "relative", overflow: "hidden"
  };

  const btnBase = {
    border: "none", borderRadius: 12, cursor: "pointer",
    fontWeight: 700, fontSize: 15, letterSpacing: 0.5,
    transition: "all 0.3s ease"
  };

  // ---- HOME PAGE ----
  if (page === "home") {
    return (
      <div style={containerStyle}>
        <Starfield />
        <style>{`
          @keyframes twinkle { from { opacity: 0.2; } to { opacity: 1; } }
          @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
          @keyframes glow { 0%,100% { box-shadow: 0 0 20px rgba(139,92,246,0.3); } 50% { box-shadow: 0 0 40px rgba(139,92,246,0.6); } }
          input:focus { outline: none; border-color: rgba(139,92,246,0.6) !important; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
          * { box-sizing: border-box; }
        `}</style>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 520, margin: "0 auto", padding: "60px 20px" }}>
          {/* Logo / Title */}
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{
              fontSize: 56, marginBottom: 8,
              animation: "float 4s ease-in-out infinite"
            }}>🌙</div>
            <h1 style={{
              fontSize: 36, fontWeight: 900, margin: "0 0 8px 0",
              background: "linear-gradient(135deg, #c4b5fd, #fef08a)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              letterSpacing: -0.5
            }}>
              Fave Day
            </h1>
            <p style={{
              fontSize: 15, color: "rgba(196,181,253,0.6)", margin: 0, fontWeight: 500
            }}>
              Sidereal Moon Tracker
            </p>
          </div>

          {/* Input Card */}
          <div style={{
            background: "rgba(15, 10, 40, 0.75)",
            border: "1px solid rgba(139, 92, 246, 0.25)",
            borderRadius: 24, padding: "32px 28px",
            backdropFilter: "blur(20px)",
            animation: "glow 4s ease-in-out infinite"
          }}>
            <p style={{ color: "rgba(196,181,253,0.7)", fontSize: 14, marginTop: 0, marginBottom: 20, textAlign: "center" }}>
              Enter your date of birth to discover your sidereal Sun sign and find your Fave Days, when the Moon visits your sign.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: "rgba(196,181,253,0.5)", display: "block", marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>Month</label>
                <input type="number" min="1" max="12" placeholder="MM"
                  value={birthMonth} onChange={e => setBirthMonth(e.target.value)}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 10,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(139,92,246,0.2)",
                    color: "#fff", fontSize: 16, fontWeight: 600
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "rgba(196,181,253,0.5)", display: "block", marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>Day</label>
                <input type="number" min="1" max="31" placeholder="DD"
                  value={birthDay} onChange={e => setBirthDay(e.target.value)}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 10,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(139,92,246,0.2)",
                    color: "#fff", fontSize: 16, fontWeight: 600
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "rgba(196,181,253,0.5)", display: "block", marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>Year</label>
                <input type="number" min="1900" max="2100" placeholder="YYYY"
                  value={birthYear} onChange={e => setBirthYear(e.target.value)}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 10,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(139,92,246,0.2)",
                    color: "#fff", fontSize: 16, fontWeight: 600
                  }}
                />
              </div>
            </div>

            {/* Birth time (optional) */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: "rgba(196,181,253,0.5)", display: "block", marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>
                Birth time <span style={{ opacity: 0.6, textTransform: "none" }}>(optional, improves accuracy for cusp births)</span>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <select
                  value={birthHour}
                  onChange={e => setBirthHour(e.target.value)}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 10,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(139,92,246,0.2)",
                    color: birthHour === "" ? "rgba(255,255,255,0.35)" : "#fff",
                    fontSize: 16, fontWeight: 600,
                    appearance: "none", WebkitAppearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23c4b5fd' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 12px center"
                  }}
                >
                  <option value="" style={{ background: "#1a0a2e" }}>Unknown</option>
                  {Array.from({ length: 24 }, (_, i) => {
                    const ampm = i < 12 ? "AM" : "PM";
                    const h12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
                    return (
                      <option key={i} value={i} style={{ background: "#1a0a2e", color: "#fff" }}>
                        {h12}:00 {ampm}
                      </option>
                    );
                  })}
                </select>
                <div style={{
                  display: "flex", alignItems: "center", padding: "0 12px",
                  fontSize: 12, color: "rgba(196,181,253,0.4)", lineHeight: 1.3
                }}>
                  Only matters if you were born near a sign boundary
                </div>
              </div>
            </div>

            {/* Calendar starts automatically from the current month */}

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 10, padding: "10px 14px", marginBottom: 16,
                color: "#fca5a5", fontSize: 13
              }}>{error}</div>
            )}

            <button onClick={calculate} disabled={loading}
              style={{
                ...btnBase, width: "100%", padding: "14px 0",
                background: loading
                  ? "rgba(139,92,246,0.3)"
                  : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                color: "#fff",
              }}>
              {loading ? "Calculating..." : "Find My Fave Days"}
            </button>
          </div>

          {/* Bottom links */}
          <div style={{ textAlign: "center", marginTop: 24, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <button onClick={() => setPage("tips")}
              style={{
                background: "none", border: "none", color: "rgba(196,181,253,0.5)",
                cursor: "pointer", fontSize: 14, fontWeight: 500,
                textDecoration: "underline", textUnderlineOffset: 3
              }}>
              Tips & advice for using Fave Days →
            </button>
            <button onClick={() => setPage("learn")}
              style={{
                background: "none", border: "none", color: "rgba(196,181,253,0.5)",
                cursor: "pointer", fontSize: 14, fontWeight: 500,
                textDecoration: "underline", textUnderlineOffset: 3
              }}>
              Why sidereal? Learn the difference →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- LEARN PAGE ----
  if (page === "learn") {
    return (
      <div style={containerStyle}>
        <Starfield />
        <style>{`
          @keyframes twinkle { from { opacity: 0.2; } to { opacity: 1; } }
          * { box-sizing: border-box; }
        `}</style>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 860, margin: "0 auto", padding: "40px 20px" }}>
          <button onClick={() => setPage(people.length > 0 ? "results" : "home")}
            style={{
              ...btnBase, background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(139,92,246,0.2)",
              color: "#c4b5fd", padding: "8px 18px", fontSize: 13, marginBottom: 24
            }}>
            ← Back
          </button>
          <LearnSection />
        </div>
      </div>
    );
  }

  // ---- TIPS PAGE ----
  if (page === "tips") {
    return (
      <div style={containerStyle}>
        <Starfield />
        <style>{`
          @keyframes twinkle { from { opacity: 0.2; } to { opacity: 1; } }
          * { box-sizing: border-box; }
        `}</style>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 860, margin: "0 auto", padding: "40px 20px" }}>
          <button onClick={() => setPage(people.length > 0 ? "results" : "home")}
            style={{
              ...btnBase, background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(139,92,246,0.2)",
              color: "#c4b5fd", padding: "8px 18px", fontSize: 13, marginBottom: 24
            }}>
            ← Back
          </button>
          <TipsSection />
        </div>
      </div>
    );
  }

  // ---- RESULTS PAGE ----
  if (page === "results" && people.length > 0) {
    const primary = people[0];
    const primarySign = primary.sunSign;
    const primaryOpp = OPPOSITE_SIGN[primarySign];
    const visibleCount = people.filter(p => p.visible).length;
    const isEditingForm = editingPersonId !== null;

    const formInputStyle = {
      width: "100%", padding: "10px 12px", borderRadius: 8,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(139,92,246,0.2)",
      color: "#fff", fontSize: 13, fontWeight: 600,
      fontFamily: "inherit",
    };

    const renderPersonForm = () => {
      const isNew = editingPersonId === "new";
      return (
        <div style={{
          padding: 14, borderRadius: 10,
          background: "rgba(139,92,246,0.08)",
          border: "1px solid rgba(139,92,246,0.35)"
        }}>
          <div style={{ color: "#c4b5fd", fontSize: 13, fontWeight: 700, marginBottom: 10, letterSpacing: 0.5, textTransform: "uppercase" }}>
            {isNew ? "Add Person" : "Edit Person"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 0.7fr 0.9fr 1.3fr", gap: 8, marginBottom: 10 }}>
            <input placeholder="Name" value={formName} onChange={e => setFormName(e.target.value)} style={formInputStyle} />
            <input type="number" placeholder="MM" min="1" max="12" value={formMonth} onChange={e => setFormMonth(e.target.value)} style={formInputStyle} />
            <input type="number" placeholder="DD" min="1" max="31" value={formDay} onChange={e => setFormDay(e.target.value)} style={formInputStyle} />
            <input type="number" placeholder="YYYY" min="1900" max="2100" value={formYear} onChange={e => setFormYear(e.target.value)} style={formInputStyle} />
            <select value={formHour} onChange={e => setFormHour(e.target.value)}
              style={{
                ...formInputStyle,
                appearance: "none", WebkitAppearance: "none",
                color: formHour === "" ? "rgba(255,255,255,0.5)" : "#fff",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%23c4b5fd' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center"
              }}>
              <option value="" style={{ background: "#1a0a2e" }}>Hour (optional)</option>
              {Array.from({ length: 24 }, (_, i) => {
                const ampm = i < 12 ? "AM" : "PM";
                const h12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
                return <option key={i} value={i} style={{ background: "#1a0a2e", color: "#fff" }}>{h12}:00 {ampm}</option>;
              })}
            </select>
          </div>
          {formError && (
            <div style={{
              color: "#fca5a5", fontSize: 12, marginBottom: 8,
              padding: "6px 10px", background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6
            }}>{formError}</div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={cancelForm}
              style={{ ...btnBase, padding: "8px 16px", fontSize: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(139,92,246,0.2)", color: "#c4b5fd" }}>
              Cancel
            </button>
            <button onClick={submitForm}
              style={{ ...btnBase, padding: "8px 16px", fontSize: 12, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff" }}>
              {isNew ? "Add" : "Save"}
            </button>
          </div>
        </div>
      );
    };

    return (
      <div style={containerStyle}>
        <Starfield />
        <style>{`
          @keyframes twinkle { from { opacity: 0.2; } to { opacity: 1; } }
          input:focus, select:focus { outline: none; border-color: rgba(139,92,246,0.6) !important; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
          * { box-sizing: border-box; }
        `}</style>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto", padding: "40px 20px 80px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
            <button onClick={clearAllAndGoHome}
              style={{
                ...btnBase, background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(139,92,246,0.2)",
                color: "#c4b5fd", padding: "8px 18px", fontSize: 13
              }}>
              ← New Search
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPage("tips")}
                style={{
                  ...btnBase, background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(139,92,246,0.2)",
                  color: "#c4b5fd", padding: "8px 18px", fontSize: 13
                }}>
                Tips & Advice
              </button>
              <button onClick={() => setPage("learn")}
                style={{
                  ...btnBase, background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(139,92,246,0.2)",
                  color: "#c4b5fd", padding: "8px 18px", fontSize: 13
                }}>
                Why Sidereal?
              </button>
            </div>
          </div>

          {/* Sign banner — always shows the primary user */}
          <div style={{
            textAlign: "center", marginBottom: 24,
            background: "rgba(15,10,40,0.7)",
            border: "1px solid rgba(139,92,246,0.25)",
            borderRadius: 24, padding: "28px 20px",
            backdropFilter: "blur(10px)"
          }}>
            <div style={{ fontSize: 48, marginBottom: 4 }}>{SIGN_SYMBOLS[primarySign]}</div>
            <h2 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 4px 0", color: SIGN_COLORS[primarySign] }}>
              {SIGNS[primarySign]}
            </h2>
            <p style={{ margin: 0, color: "rgba(196,181,253,0.6)", fontSize: 14 }}>
              {people.length > 1 ? `${primary.name}'s Sidereal Sun Sign` : "Your Sidereal Sun Sign"}
            </p>
            <div style={{
              display: "inline-flex", flexWrap: "wrap", justifyContent: "center",
              gap: 20, marginTop: 16, fontSize: 13, color: "rgba(255,255,255,0.5)"
            }}>
              <span>Fave Day = <span style={{ color: "#fef08a", fontWeight: 700 }}>{SIGN_SYMBOLS[primarySign]} {SIGNS[primarySign]}</span> Moon</span>
              <span>Unfave Day = <span style={{ color: "#fdba74", fontWeight: 700 }}>{SIGN_SYMBOLS[primaryOpp]} {SIGNS[primaryOpp]}</span> Moon</span>
            </div>
          </div>

          {/* People card */}
          <div style={{
            background: "rgba(15,10,40,0.7)",
            border: "1px solid rgba(139,92,246,0.25)",
            borderRadius: 16, padding: "20px 24px", marginBottom: 20,
            backdropFilter: "blur(10px)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ color: "#c4b5fd", fontSize: 15, fontWeight: 700 }}>People</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>
                  {people.length === 1
                    ? "Add family or friends to see everyone's Fave Days on one calendar"
                    : `${visibleCount} of ${people.length} visible`}
                </div>
              </div>
              <button onClick={openAddForm}
                disabled={people.length >= MAX_PEOPLE || isEditingForm}
                title={people.length >= MAX_PEOPLE ? `Max ${MAX_PEOPLE} people` : undefined}
                style={{
                  ...btnBase, padding: "8px 16px", fontSize: 13,
                  background: people.length >= MAX_PEOPLE || isEditingForm ? "rgba(255,255,255,0.04)" : "rgba(139,92,246,0.2)",
                  border: "1px solid rgba(139,92,246,0.35)",
                  color: people.length >= MAX_PEOPLE || isEditingForm ? "rgba(196,181,253,0.4)" : "#c4b5fd",
                  cursor: people.length >= MAX_PEOPLE || isEditingForm ? "not-allowed" : "pointer"
                }}>
                {people.length >= MAX_PEOPLE ? `Max ${MAX_PEOPLE} people` : "+ Add person"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {people.map((p, idx) => (
                editingPersonId === p.id
                  ? <div key={p.id}>{renderPersonForm()}</div>
                  : (
                    <div key={p.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 10,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(139,92,246,0.15)",
                      opacity: p.visible ? 1 : 0.55,
                      flexWrap: "wrap"
                    }}>
                      <input
                        type="checkbox"
                        checked={p.visible}
                        onChange={() => togglePersonVisibility(p.id)}
                        style={{ width: 16, height: 16, accentColor: p.color, cursor: "pointer", flexShrink: 0 }}
                        title={p.visible ? "Hide on calendar" : "Show on calendar"}
                      />
                      <span style={{
                        width: 14, height: 14, borderRadius: "50%",
                        background: p.color, flexShrink: 0,
                        boxShadow: "0 0 0 1px rgba(255,255,255,0.1)"
                      }} />
                      <span style={{ color: "#fff", fontSize: 14, fontWeight: 600, minWidth: 60 }}>
                        {p.name}{idx === 0 && people.length > 1 ? (
                          <span style={{ color: "rgba(196,181,253,0.5)", fontSize: 11, fontWeight: 500, marginLeft: 6 }}>
                            primary
                          </span>
                        ) : null}
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                        {SIGN_SYMBOLS[p.sunSign]} {SIGNS[p.sunSign]}
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginLeft: "auto" }}>
                        {String(p.month).padStart(2, "0")}/{String(p.day).padStart(2, "0")}/{p.year}
                        {p.hour !== null && <span> · {formatHour(p.hour)}</span>}
                      </span>
                      <button onClick={() => openEditForm(p)}
                        disabled={isEditingForm}
                        style={{
                          ...btnBase, padding: "6px 12px", fontSize: 12,
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(139,92,246,0.2)",
                          color: "#c4b5fd",
                          opacity: isEditingForm ? 0.4 : 1,
                          cursor: isEditingForm ? "not-allowed" : "pointer"
                        }}>
                        Edit
                      </button>
                      {idx !== 0 && (
                        <button onClick={() => deletePerson(p.id)}
                          disabled={isEditingForm}
                          style={{
                            ...btnBase, padding: "6px 12px", fontSize: 12,
                            background: "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.3)",
                            color: "#fca5a5",
                            opacity: isEditingForm ? 0.4 : 1,
                            cursor: isEditingForm ? "not-allowed" : "pointer"
                          }}>
                          Delete
                        </button>
                      )}
                    </div>
                  )
              ))}
              {editingPersonId === "new" && renderPersonForm()}
            </div>
          </div>

          {/* Year nav */}
          <div style={{
            display: "flex", justifyContent: "center", alignItems: "center",
            gap: 16, marginBottom: 24
          }}>
            <button onClick={() => switchRange(-1)}
              style={{ ...btnBase, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(139,92,246,0.2)", color: "#c4b5fd", padding: "8px 14px", fontSize: 18 }}>
              ‹
            </button>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#c4b5fd", letterSpacing: 1 }}>
              {MONTH_NAMES[displayStartMonth].slice(0,3)} {displayYear} – {MONTH_NAMES[(displayStartMonth + 11) % 12].slice(0,3)} {displayYear + Math.floor((displayStartMonth + 11) / 12)}
            </span>
            <button onClick={() => switchRange(1)}
              style={{ ...btnBase, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(139,92,246,0.2)", color: "#c4b5fd", padding: "8px 14px", fontSize: 18 }}>
              ›
            </button>
          </div>

          {/* Calendar Export */}
          <div style={{
            background: "rgba(15,10,40,0.7)",
            border: "1px solid rgba(139,92,246,0.25)",
            borderRadius: 16, padding: "20px 24px", marginBottom: 28,
            backdropFilter: "blur(10px)"
          }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ color: "#c4b5fd", fontSize: 15, fontWeight: 700 }}>Add to Calendar</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>
                  {people.length > 1
                    ? `Fave + Unfave days for ${visibleCount} visible ${visibleCount === 1 ? "person" : "people"}`
                    : "Fave + Unfave days — works with Apple Calendar, Google, and Outlook"}
                </div>
              </div>
              <button onClick={() => downloadCombinedICS(people, peopleYearData, "all")}
                disabled={visibleCount === 0}
                style={{
                  ...btnBase, padding: "10px 20px", fontSize: 13,
                  background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  color: "#fff",
                  opacity: visibleCount === 0 ? 0.4 : 1,
                  cursor: visibleCount === 0 ? "not-allowed" : "pointer"
                }}>
                Download .ics
              </button>
            </div>

            {people.length > 1 && (
              <div style={{ marginTop: 14, borderTop: "1px solid rgba(139,92,246,0.2)", paddingTop: 12 }}>
                <button onClick={() => setPerPersonOpen(o => !o)}
                  style={{
                    background: "none", border: "none", padding: 0,
                    color: "rgba(196,181,253,0.7)", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 4
                  }}>
                  <span style={{ fontSize: 10 }}>{perPersonOpen ? "▾" : "▸"}</span>
                  Per-person downloads
                </button>
                {perPersonOpen && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {people.map(p => (
                      <div key={p.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 10px", borderRadius: 8,
                        background: "rgba(255,255,255,0.02)"
                      }}>
                        <span style={{
                          width: 10, height: 10, borderRadius: "50%",
                          background: p.color, flexShrink: 0,
                          boxShadow: "0 0 0 1px rgba(255,255,255,0.1)"
                        }} />
                        <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.name}
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, whiteSpace: "nowrap" }}>
                          {SIGN_SYMBOLS[p.sunSign]} {SIGNS[p.sunSign]}
                        </span>
                        <button onClick={() => downloadPersonICS(p, peopleYearData[p.id] || [], "all")}
                          style={{
                            ...btnBase, padding: "6px 14px", fontSize: 12,
                            background: "rgba(139,92,246,0.18)",
                            border: "1px solid rgba(139,92,246,0.4)",
                            color: "#c4b5fd"
                          }}>
                          Download .ics
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upcoming */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
            <UpcomingDays people={people} peopleYearData={peopleYearData} type="fave" limit={6} />
            <UpcomingDays people={people} peopleYearData={peopleYearData} type="unfave" limit={6} />
          </div>

          {/* Calendar grid */}
          <h3 style={{ color: "#c4b5fd", fontSize: 18, fontWeight: 700, marginBottom: 16, textAlign: "center" }}>
            12-Month Calendar
          </h3>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16
          }}>
            {Array.from({ length: 12 }, (_, i) => {
              const absMonth = displayStartMonth + i;
              const yr = displayYear + Math.floor(absMonth / 12);
              const mo = absMonth % 12;
              return (
                <CalendarMonth
                  key={`${yr}-${mo}`}
                  year={yr} month={mo}
                  people={people}
                  peopleYearData={peopleYearData}
                  onSelectDay={setSelectedDay}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap",
            marginTop: 28, fontSize: 13, color: "rgba(255,255,255,0.5)"
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: "rgba(250,204,21,0.35)", border: "1px solid rgba(250,204,21,0.4)", display: "inline-block" }} />
              {people.length > 1 ? `${primary.name}'s Fave Day` : "Fave Day"}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: "rgba(239,68,68,0.3)", border: "1px solid rgba(239,68,68,0.3)", display: "inline-block" }} />
              {people.length > 1 ? `${primary.name}'s Unfave Day` : "Unfave Day"}
            </span>
            {people.length > 1 && (
              <>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#c4b5fd", display: "inline-block" }} />
                  Other person's Fave
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "transparent", border: "1px solid #c4b5fd", display: "inline-block" }} />
                  Other person's Unfave
                </span>
              </>
            )}
          </div>
          {/* Timezone note */}
          <div style={{
            textAlign: "center", marginTop: 12, fontSize: 11,
            color: "rgba(255,255,255,0.3)"
          }}>
            All times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone} ({(() => {
              const offset = -new Date().getTimezoneOffset() / 60;
              return `UTC${offset >= 0 ? "+" : ""}${offset}`;
            })()})
          </div>
        </div>

        {selectedDay && (
          <DayDetailModal
            selected={selectedDay}
            onClose={() => setSelectedDay(null)}
            isSolo={people.filter(p => p.visible).length <= 1}
          />
        )}
      </div>
    );
  }

  return null;
}
