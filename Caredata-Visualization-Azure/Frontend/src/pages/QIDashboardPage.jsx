import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import MobileSidebarPanel, { PAGE_MAIN_ROW } from "../components/common/MobileSidebarPanel";
import { getQIAggregates, getGPMSList, getGPMSByDate } from "../services/api";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, PieChart, Pie, Cell, Legend, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  CHART_PALETTE, STATUS, CHART_GRID, CHART_AXIS, axisTickStyle,
  tooltipStyle, legendStyle,
} from "../theme/chartTokens";

// ─── Constants (structural only, no demo data) ──────────────────────────────

const PRIMARY = CHART_PALETTE[0];
const COLORS = { red: STATUS.bad, amber: STATUS.warn, green: STATUS.good, blue: CHART_PALETTE[1], purple: CHART_PALETTE[2] };

const INDICATORS_EMPTY = [
  "Pressure injuries", "Falls & major injury", "Unplanned weight loss", "Medications",
  "Activities of daily living", "Incontinence care", "Restrictive practices", "Hospitalisation",
  "Allied health", "Consumer experience", "Quality of life", "Workforce",
  "Enrolled nursing", "Lifestyle officer",
];

const TREND_LABEL = { up: "↑ Worsening", down: "↓ Improving", stable: "→ Stable" };
const STATUS_LABEL = { red: "Above threshold", amber: "Monitor", green: "On track", nodata: "No data", grey: "No data" };
const REPORTS_SECTION_IDS = ["pi","falls","uwl","meds","adl","ic","rp","hosp","ah","cx","qol","wf","en","ls"];
const DASHBOARD_TO_REPORTS_SECTION = {
  pi:"pi",falls:"falls",uwl:"uwl",meds:"meds",adl:"adl",
  incontinence:"ic",rp:"rp",hosp:"hosp",allied_health:"ah",
  consumer_exp:"cx",qol:"qol",workforce:"wf",enrolled_nursing:"en",lifestyle:"ls",
};

const HEATMAP_COLS = ["PI","RP","UWL","Falls","Meds","ADL","IC","Hosp","WF","CX","QoL","EN","AH","LS"];
const STATUS_DIST_COLORS = [STATUS.good, STATUS.warn, STATUS.bad, STATUS.none];
const TREND_DIR_COLORS = [STATUS.good, STATUS.warn, STATUS.bad];

const ID_TO_SHORT = {pi:"PI",rp:"RP",falls:"Falls",meds:"Meds",adl:"ADL",uwl:"UWL",incontinence:"IC",hosp:"Hosp",allied_health:"AH Gap",consumer_exp:"CX",qol:"QoL",workforce:"WF",enrolled_nursing:"EN",lifestyle:"LS"};
const LOB_IDS = new Set(["pi","rp","falls","meds","adl","uwl","incontinence","hosp","allied_health"]);

// 14 distinct colours for the all-indicators multi-line trend chart.
// Light 7-tone palette + slightly deeper variants so legends stay readable.
const TREND_COLORS = [
  "#8AA791","#95A8BD","#B7A07F","#A4ACA6","#B4CDBA","#C4D0DC","#DBC7A2",
  "#6E8A77","#7889A0","#967F61","#7E867F","#9CB7A2","#A7B7C9","#C2AC83",
];
const TREND_SHORT = {
  pi:"PI",rp:"RP",falls:"Falls",meds:"Meds",adl:"ADL",uwl:"UWL",
  ic:"IC",hosp:"Hosp",ah:"AH",cx:"CX",qol:"QoL",wf:"WF",en:"EN",ls:"LS",
};

// AIHW national median benchmarks (published figures, not demo data)
const NATIONAL_BENCHMARKS = {
  pi: 10.2, rp: 7.8, falls: 8.3, meds: 19.8,
  uwl: 5.1, incontinence: 6.9, hosp: 11.0, adl: 20.1,
};

// Visualization panel sidebar items,14 per-category deep-dive panels
const VIS_PANELS = [
  { id: "panel-qi-pi",    label: "Pressure Injuries",          qis: "QI 1",  indicatorId: "pi" },
  { id: "panel-qi-rp",    label: "Restrictive Practices",      qis: "QI 2",  indicatorId: "rp" },
  { id: "panel-qi-uwl",   label: "Unplanned Weight Loss",      qis: "QI 3",  indicatorId: "uwl" },
  { id: "panel-qi-falls", label: "Falls & Major Injury",       qis: "QI 4",  indicatorId: "falls" },
  { id: "panel-qi-meds",  label: "Medications",                qis: "QI 5",  indicatorId: "meds" },
  { id: "panel-qi-adl",   label: "Activities of Daily Living", qis: "QI 6",  indicatorId: "adl" },
  { id: "panel-qi-ic",    label: "Incontinence Care",          qis: "QI 7",  indicatorId: "incontinence" },
  { id: "panel-qi-hosp",  label: "Hospitalisation",            qis: "QI 8",  indicatorId: "hosp" },
  { id: "panel-qi-wf",    label: "Workforce",                  qis: "QI 9",  indicatorId: "workforce" },
  { id: "panel-qi-cx",    label: "Consumer Experience",        qis: "QI 10", indicatorId: "consumer_exp" },
  { id: "panel-qi-qol",   label: "Quality of Life",            qis: "QI 11", indicatorId: "qol" },
  { id: "panel-qi-en",    label: "Enrolled Nursing",           qis: "QI 12", indicatorId: "enrolled_nursing" },
  { id: "panel-qi-ah",    label: "Allied Health",              qis: "QI 13", indicatorId: "allied_health" },
  { id: "panel-qi-ls",    label: "Lifestyle Officer",          qis: "QI 14", indicatorId: "lifestyle" },
];

// Stacked bar color palettes, severity ramps from good (sage) to bad (muted red).
// "Without Dx" antipsychotic stays in red because the user called it auditor-critical.
const PI_STAGE_COLORS = {
  "Stage 1": STATUS.good,
  "Stage 2": "#B4CDBA",
  "Stage 3": STATUS.warn,
  "Stage 4": STATUS.bad,
  Unstageable: CHART_PALETTE[1],
  DTI: CHART_PALETTE[3],
};
const RP_COLORS = {
  Mechanical: STATUS.bad,
  Physical: STATUS.warn,
  Environmental: CHART_PALETTE[1],
  Seclusion: CHART_PALETTE[3],
};
const IAD_COLORS = {
  "Cat 1A": STATUS.good,
  "Cat 1B": "#B4CDBA",
  "Cat 2A": STATUS.warn,
  "Cat 2B": STATUS.bad,
};
const AP_COLORS = {
  "No AP": STATUS.good,
  "With Dx": STATUS.warn,
  "Without Dx": STATUS.bad,
};
const CX_QOL_COLORS = {
  Excellent: STATUS.good,
  Good: "#B4CDBA",
  Moderate: STATUS.warn,
  Poor: "#D4A088",
  "Very Poor": STATUS.bad,
};
const MED_RANGE_COLORS = {
  "0–3": STATUS.good,
  "4–6": "#B4CDBA",
  "7–9": STATUS.warn,
  "10+": STATUS.bad,
};
const ADL_CHANGE_COLORS = {
  Improved: STATUS.good,
  Stable: CHART_PALETTE[3],
  Declined: STATUS.bad,
};

// ─── Builder functions (derive display data from API aggregates) ──────────────

function buildTrendSeriesFromAggregates(qiAggregates) {
  if (!qiAggregates?.aggregates?.length) return null;
  const aggs = qiAggregates.aggregates;
  const firstIndicators = aggs[0]?.indicators || [];
  if (!firstIndicators.length) return null;
  return firstIndicators.map(ind => ({
    id: DASHBOARD_TO_REPORTS_SECTION[ind.id] || ind.id,
    name: ind.name,
    unit: String(ind.valueDisplay || "").endsWith("%") ? "%" : "",
    lob: LOB_IDS.has(ind.id),
    data: aggs.map(a => {
      const matching = (a.indicators || []).find(i => i.id === ind.id);
      return { date: a.quarterLabel || a.assessmentDate, value: matching?.currentRate ?? null };
    }).filter(d => d.value !== null),
  }));
}

function buildOverviewFromAggregates(qiAggregates) {
  if (!qiAggregates?.aggregates?.length) return null;
  const latest = qiAggregates.aggregates[qiAggregates.aggregates.length - 1];
  return (latest.indicators || []).map(ind => ({
    name: ID_TO_SHORT[ind.id] || ind.id,
    rate: ind.currentRate ?? 0,
    status: ind.status || "grey",
  }));
}

function buildStatusDistFromAggregates(qiAggregates) {
  if (!qiAggregates?.aggregates?.length) return null;
  const latest = qiAggregates.aggregates[qiAggregates.aggregates.length - 1];
  const counts = { green: 0, amber: 0, red: 0, grey: 0 };
  (latest.indicators || []).forEach(ind => { counts[ind.status || "grey"] = (counts[ind.status || "grey"] || 0) + 1; });
  return [
    { name: "On track", value: counts.green },
    { name: "Monitor", value: counts.amber },
    { name: "Above threshold", value: counts.red },
    { name: "No data", value: counts.grey },
  ].filter(d => d.value > 0);
}

// (buildChartSidebarFromAggregates and buildSectionsFromAggregates removed, replaced by panel builders)

function buildTrendDirectionCounts(trendSeries) {
  if (!trendSeries?.length) return [];
  let improving = 0, stable = 0, worsening = 0;
  trendSeries.forEach(ts => {
    if (ts.data.length < 2) { stable++; return; }
    const first = ts.data[0].value;
    const last = ts.data[ts.data.length - 1].value;
    const delta = last - first;
    const isImproving = ts.lob ? delta < 0 : delta > 0;
    if (Math.abs(delta) < 0.5) stable++;
    else if (isImproving) improving++;
    else worsening++;
  });
  return [
    { name: "Improving", value: improving },
    { name: "Stable", value: stable },
    { name: "Worsening", value: worsening },
  ];
}

function buildOverviewRadar(qiAggregates) {
  if (!qiAggregates?.aggregates?.length) return [];
  const latest = qiAggregates.aggregates[qiAggregates.aggregates.length - 1];
  return (latest.indicators || [])
    .filter(ind => ind.id in NATIONAL_BENCHMARKS)
    .map(ind => ({
      subject: ID_TO_SHORT[ind.id] || ind.id,
      value: ind.currentRate ?? 0,
      benchmark: NATIONAL_BENCHMARKS[ind.id] ?? 0,
      fullMark: 25,
    }));
}

function buildAllIndicatorsTrendData(trendSeries) {
  if (!trendSeries?.length) return [];
  const dates = trendSeries[0]?.data?.map(d => d.date) || [];
  return dates.map((date, i) => {
    const point = { date };
    trendSeries.forEach(ts => { point[ts.name] = ts.data[i]?.value ?? null; });
    return point;
  });
}

// ─── Per-category visualization builders (GPMS + aggregates) ────────────────

function buildDateToQuarterMap(qiAggregates) {
  const map = {};
  const dates = qiAggregates?.dates || [];
  const labels = qiAggregates?.quarterLabels || [];
  dates.forEach((d, i) => { map[d] = labels[i] || d; });
  return map;
}

function _sortedGpms(allGpmsData) {
  if (!allGpmsData) return [];
  return Object.entries(allGpmsData).sort(([a], [b]) => a.localeCompare(b));
}

/** QI 1: PI severity stacked bar + S3+ proportion */
function buildPISeverityData(allGpmsData, dateToQuarter) {
  if (!allGpmsData) return [];
  return _sortedGpms(allGpmsData)
    .filter(([, fd]) => fd.pi_total > 0)
    .map(([date, fd]) => {
      const s3plus = (fd.pi_s3 || 0) + (fd.pi_s4 || 0) + (fd.pi_unstage || 0) + (fd.pi_dti || 0);
      const piAny = fd.pi_any || 0;
      return {
        quarter: dateToQuarter[date] || date,
        "Stage 1": fd.pi_s1 || 0, "Stage 2": fd.pi_s2 || 0,
        "Stage 3": fd.pi_s3 || 0, "Stage 4": fd.pi_s4 || 0,
        Unstageable: fd.pi_unstage || 0, DTI: fd.pi_dti || 0,
        _total: fd.pi_total, _any: piAny, _s3plus: s3plus,
        _s3PlusPct: piAny > 0 ? Number((s3plus / piAny * 100).toFixed(1)) : 0,
      };
    });
}

/** QI 2: RP sub-type breakdown */
function buildRPData(allGpmsData, dateToQuarter) {
  if (!allGpmsData) return { subTypeBreakdown: [] };
  const sorted = _sortedGpms(allGpmsData);
  const hasSubs = sorted.some(([, fd]) => fd.rp_mech != null || fd.rp_phys != null);
  if (!hasSubs) return { subTypeBreakdown: [] };
  const subTypeBreakdown = sorted
    .filter(([, fd]) => fd.rp_total > 0)
    .map(([date, fd]) => ({
      quarter: dateToQuarter[date] || date,
      Mechanical: fd.rp_mech || 0, Physical: fd.rp_phys || 0,
      Environmental: fd.rp_env || 0, Seclusion: fd.rp_sec || 0,
      _total: fd.rp_total, _any: fd.rp_any || 0,
    }));
  return { subTypeBreakdown };
}

/** QI 3: UWL significant vs consecutive dual-line */
function buildUWLData(allGpmsData, dateToQuarter) {
  if (!allGpmsData) return { dualTrend: [] };
  const dualTrend = _sortedGpms(allGpmsData)
    .filter(([, fd]) => fd.uwl_total_sig > 0)
    .map(([date, fd]) => ({
      quarter: dateToQuarter[date] || date,
      Significant: Number(((fd.uwl_sig || 0) / fd.uwl_total_sig * 100).toFixed(1)),
      Consecutive: Number(((fd.uwl_con || 0) / (fd.uwl_total_con || fd.uwl_total_sig) * 100).toFixed(1)),
    }));
  return { dualTrend };
}

/** QI 4: Falls, any/major/severity ratio */
function buildFallsData(allGpmsData, dateToQuarter) {
  if (!allGpmsData) return { fallsTrend: [] };
  const fallsTrend = _sortedGpms(allGpmsData)
    .filter(([, fd]) => fd.falls_total > 0)
    .map(([date, fd]) => {
      const anyFall = fd.falls_any || 0;
      const major = fd.falls_major || 0;
      return {
        quarter: dateToQuarter[date] || date,
        "Any fall": Number((anyFall / fd.falls_total * 100).toFixed(1)),
        "Major injury": Number((major / fd.falls_total * 100).toFixed(1)),
        "Severity ratio": anyFall > 0 ? Number((major / anyFall * 100).toFixed(1)) : 0,
      };
    });
  return { fallsTrend };
}

/** QI 5: Medication analysis, polypharmacy trend + AP breakdown (unchanged) */
function buildMedicationData(allGpmsData, dateToQuarter) {
  if (!allGpmsData) return { polyTrend: [], apBreakdown: [] };
  const sorted = _sortedGpms(allGpmsData);
  const polyTrend = sorted
    .filter(([, fd]) => fd.poly_total > 0)
    .map(([date, fd]) => ({ quarter: dateToQuarter[date] || date, rate: Number(((fd.poly_count || 0) / fd.poly_total * 100).toFixed(1)) }));
  const apBreakdown = sorted
    .filter(([, fd]) => fd.ap_total > 0)
    .map(([date, fd]) => {
      const any = fd.ap_any || 0;
      const withDx = fd.ap_with_dx || 0;
      return {
        quarter: dateToQuarter[date] || date,
        "No AP": fd.ap_total - any,
        "With Dx": withDx,
        "Without Dx": Math.max(0, any - withDx),
      };
    });
  return { polyTrend, apBreakdown };
}

/** QI 6: ADL Barthel radar */
function buildADLData(allGpmsData, dateToQuarter) {
  const DOMAINS = ["Bowels","Bladder","Grooming","Toilet","Feeding","Transfer","Mobility","Dressing","Stairs","Bathing"];
  const KEYS = ["adl_bowel","adl_bladder","adl_grooming","adl_toilet","adl_feeding","adl_transfer","adl_mobility","adl_dressing","adl_stairs","adl_bathing"];
  if (!allGpmsData) return { radarData: [], hasSubScores: false };
  const sorted = _sortedGpms(allGpmsData);
  const hasSubs = sorted.some(([, fd]) => KEYS.some(k => fd[k] != null));
  if (!hasSubs) return { radarData: [], hasSubScores: false };
  const earliest = sorted[0]?.[1];
  const latest = sorted[sorted.length - 1]?.[1];
  const radarData = DOMAINS.map((domain, i) => ({
    domain,
    latest: latest?.[KEYS[i]] ?? 0,
    earliest: earliest?.[KEYS[i]] ?? 0,
  }));
  return { radarData, hasSubScores: true };
}

/** QI 7: IAD severity stacked bar */
function buildICData(allGpmsData, dateToQuarter) {
  if (!allGpmsData) return { iadSeverity: [] };
  const iadSeverity = _sortedGpms(allGpmsData)
    .filter(([, fd]) => fd.ic_total > 0)
    .map(([date, fd]) => ({
      quarter: dateToQuarter[date] || date,
      "Cat 1A": fd.ic_iad_1a || 0, "Cat 1B": fd.ic_iad_1b || 0,
      "Cat 2A": fd.ic_iad_2a || 0, "Cat 2B": fd.ic_iad_2b || 0,
      _total: fd.ic_total, _iadAny: fd.ic_iad_any || 0,
    }));
  return { iadSeverity };
}

/** QI 8: Hospitalisation, ED vs All dual-line */
function buildHospData(allGpmsData, dateToQuarter) {
  if (!allGpmsData) return { dualTrend: [] };
  const dualTrend = _sortedGpms(allGpmsData)
    .filter(([, fd]) => fd.hosp_total > 0)
    .map(([date, fd]) => ({
      quarter: dateToQuarter[date] || date,
      "All hosp": Number(((fd.hosp_all || 0) / fd.hosp_total * 100).toFixed(1)),
      "ED presentations": Number(((fd.hosp_ed || 0) / fd.hosp_total * 100).toFixed(1)),
    }));
  return { dualTrend };
}

/** QI 9/12/14: Single indicator trend from aggregates with optional target line */
function buildSingleTrendPanel(trendSeries, indicatorId, target) {
  const ts = (trendSeries || []).find(t => t.id === indicatorId);
  if (!ts || !ts.data?.length) return { data: [], target, current: null, gap: null };
  const current = ts.data[ts.data.length - 1]?.value ?? null;
  return {
    data: ts.data,
    name: ts.name,
    unit: ts.unit,
    lob: ts.lob,
    target: target ?? null,
    current,
    gap: target != null && current != null ? Number((target - current).toFixed(1)) : null,
  };
}

/** QI 10: Consumer experience score band distribution */
function buildCXData(allGpmsData, dateToQuarter) {
  if (!allGpmsData) return { bands: [], positivePct: null };
  const bands = _sortedGpms(allGpmsData)
    .filter(([, fd]) => (fd.cx_excellent ?? fd.cx_good) != null)
    .map(([date, fd]) => ({
      quarter: dateToQuarter[date] || date,
      Excellent: fd.cx_excellent || 0, Good: fd.cx_good || 0,
      Moderate: fd.cx_moderate || 0, Poor: fd.cx_poor || 0, "Very Poor": fd.cx_very_poor || 0,
    }));
  const last = bands[bands.length - 1];
  const total = last ? (last.Excellent + last.Good + last.Moderate + last.Poor + last["Very Poor"]) : 0;
  const positivePct = total > 0 ? Number(((last.Excellent + last.Good) / total * 100).toFixed(1)) : null;
  return { bands, positivePct };
}

/** QI 11: Quality of life score band distribution */
function buildQoLData(allGpmsData, dateToQuarter) {
  if (!allGpmsData) return { bands: [], positivePct: null };
  const bands = _sortedGpms(allGpmsData)
    .filter(([, fd]) => (fd.qol_excellent ?? fd.qol_good) != null)
    .map(([date, fd]) => ({
      quarter: dateToQuarter[date] || date,
      Excellent: fd.qol_excellent || 0, Good: fd.qol_good || 0,
      Moderate: fd.qol_moderate || 0, Poor: fd.qol_poor || 0, "Very Poor": fd.qol_very_poor || 0,
    }));
  const last = bands[bands.length - 1];
  const total = last ? (last.Excellent + last.Good + last.Moderate + last.Poor + last["Very Poor"]) : 0;
  const positivePct = total > 0 ? Number(((last.Excellent + last.Good) / total * 100).toFixed(1)) : null;
  return { bands, positivePct };
}

/** QI 13: Allied health discipline breakdown + time series */
function buildAlliedHealthData(allGpmsData, qiAggregates, dateToQuarter) {
  if (!allGpmsData) return { disciplines: [], gapRate: null, timeSeries: [] };
  const dates = Object.keys(allGpmsData).sort();
  const latestFd = dates.length ? allGpmsData[dates[dates.length - 1]] : null;
  if (!latestFd) return { disciplines: [], gapRate: null, timeSeries: [] };
  const DISC_KEYS = [
    { name: "Physiotherapy", key: "ah_rcv_physio" },
    { name: "Occupational Therapy", key: "ah_rcv_ot" },
    { name: "Speech Pathology", key: "ah_rcv_speech" },
    { name: "Podiatry", key: "ah_rcv_pod" },
    { name: "Dietetics", key: "ah_rcv_diet" },
    { name: "AH Assistants", key: "ah_rcv_assist" },
    { name: "Other", key: "ah_rcv_other" },
  ];
  const disciplines = DISC_KEYS.map(d => ({ name: d.name, received: latestFd[d.key] || 0 }));
  const timeSeries = dates.map(d => {
    const fd = allGpmsData[d];
    const pt = { quarter: dateToQuarter?.[d] || d };
    DISC_KEYS.forEach(dk => { pt[dk.name] = fd[dk.key] || 0; });
    return pt;
  });
  const ahInd = (qiAggregates?.aggregates || []).at(-1)?.indicators?.find(i => i.id === "allied_health");
  // Gap analysis: recommended vs received per discipline
  const RCMD_KEYS = [
    { name: "Physiotherapy", key: "ah_rcmd_physio" },
    { name: "Occupational Therapy", key: "ah_rcmd_ot" },
    { name: "Speech Pathology", key: "ah_rcmd_speech" },
    { name: "Podiatry", key: "ah_rcmd_pod" },
    { name: "Dietetics", key: "ah_rcmd_diet" },
    { name: "AH Assistants", key: "ah_rcmd_assist" },
    { name: "Other", key: "ah_rcmd_other" },
  ];
  const hasRcmd = RCMD_KEYS.some(d => latestFd[d.key] != null);
  const gapData = hasRcmd
    ? DISC_KEYS.map((d, i) => ({
        name: d.name,
        Recommended: latestFd[RCMD_KEYS[i].key] || 0,
        Received: latestFd[d.key] || 0,
      }))
    : null;
  return { disciplines, gapRate: ahInd?.currentRate ?? null, total: latestFd.ah_total || 0, timeSeries, gapData };
}

// ─── Additional builder functions (Phase 2 additions) ─────────────────────────


function buildMedDistribution(allGpmsData, dateToQuarter) {
  if (!allGpmsData) return [];
  return _sortedGpms(allGpmsData)
    .filter(([, fd]) => fd.med_range_0_3 != null)
    .map(([d, fd]) => ({
      quarter: dateToQuarter?.[d] || d,
      "0–3": fd.med_range_0_3 || 0,
      "4–6": fd.med_range_4_6 || 0,
      "7–9": fd.med_range_7_9 || 0,
      "10+": fd.med_range_10plus || 0,
    }));
}

function buildADLChangeDistribution(allGpmsData, dateToQuarter) {
  if (!allGpmsData) return [];
  return _sortedGpms(allGpmsData)
    .filter(([, fd]) => fd.adl_improved != null)
    .map(([d, fd]) => ({
      quarter: dateToQuarter?.[d] || d,
      Improved: fd.adl_improved || 0,
      Stable: fd.adl_stable || 0,
      Declined: fd.adl_declined || 0,
    }));
}


// ─── Helper components ────────────────────────────────────────────────────────

function SparklineSVG({ data, status }) {
  if (!data || data.length === 0) return null;
  const w = 100, h = 28, pad = 2;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  const colors = { green: STATUS.good, amber: STATUS.warn, red: STATUS.bad, nodata: STATUS.none };
  const c = colors[status] || "#999";
  const last = pts.split(" ").pop();
  const [cx, cy] = last ? last.split(",") : ["0", "0"];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-7">
      <polyline points={pts} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx={cx} cy={cy} r="2.5" fill={c} />
    </svg>
  );
}

// ─── Left sidebar nav ─────────────────────────────────────────────────────────

const LEFT_NAV_BASE = [
  {
    id: "overview", label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: "visualization", label: "Visualization", hasChildren: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: "trends", label: "Trend Analysis",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: "risk", label: "Risk Overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function QIDashboardPage() {
  const [activePage, setActivePage] = useState("overview");
  const [visExpanded, setVisExpanded] = useState(false);
  const [quarterIndex, setQuarterIndex] = useState(0);
  const [qiAggregates, setQiAggregates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allGpmsData, setAllGpmsData] = useState(null);
  const [gpmsLoading, setGpmsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getQIAggregates()
      .then(data => {
        if (cancelled) return;
        setQiAggregates(data);
        const aggs = data?.aggregates || [];
        if (aggs.length > 0) setQuarterIndex(aggs.length - 1);
      })
      .catch(err => console.warn("getQIAggregates failed:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Fetch GPMS sub-indicator data for all known dates
  useEffect(() => {
    if (!qiAggregates?.dates?.length) return;
    let cancelled = false;
    setGpmsLoading(true);
    getGPMSList()
      .then(resp => {
        const dates = (resp?.submissions || []).map(s => s.date || s.assessmentDate || s.RowKey);
        if (!dates.length || cancelled) return {};
        return Promise.allSettled(dates.map(d => getGPMSByDate(d)))
          .then(results => {
            const gpmsMap = {};
            results.forEach((r, i) => {
              if (r.status === "fulfilled" && r.value?.formData) {
                gpmsMap[dates[i]] = r.value.formData;
              }
            });
            return gpmsMap;
          });
      })
      .then(gpmsMap => { if (!cancelled && gpmsMap) setAllGpmsData(gpmsMap); })
      .catch(err => console.warn("GPMS fetch failed:", err))
      .finally(() => { if (!cancelled) setGpmsLoading(false); });
    return () => { cancelled = true; };
  }, [qiAggregates]);

  // ─── Derived data ──────────────────────────────────────────────────────────
  const aggs = qiAggregates?.aggregates || [];
  const hasData = aggs.length > 0;
  const latest = hasData ? aggs[aggs.length - 1] : null;
  const dashboardData = latest ? {
    header: {
      facilityName: latest.facilityName || "",
      quarterLabels: qiAggregates.quarterLabels || [],
      residentCountForLatestQuarter: latest.totalResidents || 0,
    },
    summaryStrip: latest.summaryStrip || {},
    indicators: latest.indicators || [],
    residentsAtRisk: latest.residentsAtRisk || {},
  } : null;

  const quarters = qiAggregates?.quarterLabels || [];
  const hasQuarters = quarters.length > 0;
  const safeQI = hasQuarters ? Math.min(quarterIndex, quarters.length - 1) : 0;
  const currentQuarterLabel = hasQuarters ? quarters[safeQI] : "—";

  const effectiveTrendSeries = buildTrendSeriesFromAggregates(qiAggregates) || [];
  const trendDirectionCounts = buildTrendDirectionCounts(effectiveTrendSeries);
  const overviewRadar = buildOverviewRadar(qiAggregates);
  const allIndicatorsTrendData = buildAllIndicatorsTrendData(effectiveTrendSeries);

  // Per-category visualization data (GPMS + aggregates)
  const dateToQuarter = buildDateToQuarterMap(qiAggregates);
  const piSeverity = buildPISeverityData(allGpmsData, dateToQuarter);
  const rpData = buildRPData(allGpmsData, dateToQuarter);
  const uwlData = buildUWLData(allGpmsData, dateToQuarter);
  const fallsData = buildFallsData(allGpmsData, dateToQuarter);
  const medData = buildMedicationData(allGpmsData, dateToQuarter);
  const adlData = buildADLData(allGpmsData, dateToQuarter);
  const icData = buildICData(allGpmsData, dateToQuarter);
  const hospData = buildHospData(allGpmsData, dateToQuarter);
  const wfPanel = buildSingleTrendPanel(effectiveTrendSeries, "wf", 90);
  const cxData = buildCXData(allGpmsData, dateToQuarter);
  const qolData = buildQoLData(allGpmsData, dateToQuarter);
  const enPanel = buildSingleTrendPanel(effectiveTrendSeries, "en", 90);
  const ahData = buildAlliedHealthData(allGpmsData, qiAggregates, dateToQuarter);
  const lsPanel = buildSingleTrendPanel(effectiveTrendSeries, "ls");
  // Phase 2 additions, deeper charts
  const medDistribution = buildMedDistribution(allGpmsData, dateToQuarter);
  const adlChange = buildADLChangeDistribution(allGpmsData, dateToQuarter);

  // ─── Navigation helpers ────────────────────────────────────────────────────
  // Map indicator section IDs to their visualization panel
  const SECTION_TO_PANEL = { pi: "panel-qi-pi", falls: "panel-qi-falls", uwl: "panel-qi-uwl", meds: "panel-qi-meds", adl: "panel-qi-adl", ic: "panel-qi-ic", rp: "panel-qi-rp", hosp: "panel-qi-hosp", ah: "panel-qi-ah", cx: "panel-qi-cx", qol: "panel-qi-qol", wf: "panel-qi-wf", en: "panel-qi-en", ls: "panel-qi-ls" };
  const goToChartSection = (sectionId) => {
    setActivePage("visualization");
    setVisExpanded(true);
    const panelId = SECTION_TO_PANEL[sectionId] || "panel-qi-pi";
    setTimeout(() => {
      document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleNavClick = (navId) => {
    if (navId === "visualization") {
      setVisExpanded(v => !v);
      if (!visExpanded) setActivePage("visualization");
    } else {
      setActivePage(navId);
      setVisExpanded(false);
    }
  };

  const handlePanelClick = (panelId) => {
    setActivePage("visualization");
    setVisExpanded(true);
    setTimeout(() => {
      document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const isVisActive = activePage === "visualization";

  // Status dot color for a single indicator
  const panelDotColor = (indicatorId) => {
    const dotColors = { red: STATUS.bad, amber: STATUS.warn, green: STATUS.good, grey: STATUS.none };
    if (!latest) return dotColors.grey;
    const ind = (latest.indicators || []).find(i => i.id === indicatorId);
    if (!ind) return dotColors.grey;
    return dotColors[ind.status] || dotColors.grey;
  };

  // ─── Sidebar ──────────────────────────────────────────────────────────────

  const sidebar = (
    <aside
      className="shrink-0 w-full lg:w-60 self-start static lg:sticky lg:top-24"
      style={{
        background: "var(--bg-white)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        padding: "16px 12px",
      }}
    >
      <p
        className="uppercase mb-3 px-3"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "var(--ink-500)",
        }}
      >
        Facility view
      </p>
      <ul className="space-y-0.5">
        {LEFT_NAV_BASE.map(nav => {
          const isActive = activePage === nav.id || (nav.id === "visualization" && isVisActive);
          const hasChildren = nav.hasChildren;
          return (
            <li key={nav.id}>
              <button
                type="button"
                onClick={() => handleNavClick(nav.id)}
                className="w-full flex items-center gap-2.5 transition text-left"
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? "var(--ink-900)" : "var(--ink-700)",
                  background: isActive ? "var(--bg-sage-tint)" : "transparent",
                  boxShadow: isActive ? "inset 0 0 0 1px var(--sage)" : "none",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg-cream)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ color: isActive ? "var(--sage-ink)" : "var(--ink-500)" }}>{nav.icon}</span>
                <span className="flex-1">{nav.label}</span>
                {hasChildren && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3 h-3 transition-transform ${visExpanded ? "rotate-90" : ""}`}><polyline points="9 18 15 12 9 6" /></svg>
                )}
              </button>
              {hasChildren && visExpanded && (
                <ul
                  className="mt-1 ml-3 pl-3 space-y-0.5"
                  style={{ borderLeft: "1px solid var(--line-soft)" }}
                >
                  {VIS_PANELS.map(panel => (
                    <li key={panel.id}>
                      <button
                        type="button"
                        onClick={() => handlePanelClick(panel.id)}
                        className="w-full flex items-center gap-2 transition text-left"
                        style={{
                          padding: "6px 8px",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "var(--ink-700)",
                          background: "transparent",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-cream)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: panelDotColor(panel.indicatorId) }} />
                        <span className="flex-1 truncate">{panel.label}</span>
                        <span className="shrink-0" style={{ fontSize: 10, color: "var(--ink-500)" }}>{panel.qis}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );

  // ─── Overview tab ─────────────────────────────────────────────────────────

  const overviewTab = (
    <div className="flex-1 min-w-0">
      {/* Page header */}
      <div className="mb-6">
        <span className="cd-chip mb-3">Facility · {hasData ? currentQuarterLabel : "Awaiting data"}</span>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(30px, 4vw, 42px)",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            color: "var(--ink-900)",
            marginTop: 8,
          }}
        >
          Quality indicator dashboard
        </h1>
        <p className="mt-2" style={{ color: "var(--ink-500)", fontSize: 14 }}>
          14 AIHW categories at a glance, open any card to drill into the indicator.
        </p>
      </div>

      {/* Risk strip */}
      {hasData && dashboardData?.residentsAtRisk?.count > 0 && (
        <div
          className="mb-5 flex flex-wrap items-center gap-3"
          style={{
            background: "var(--bg-clay-tint)",
            border: "1px solid var(--line-soft)",
            borderLeft: "3px solid var(--clay-ink)",
            borderRadius: "var(--r-md)",
            padding: "12px 16px",
          }}
        >
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--clay-ink)" }} />
          <span className="text-sm flex-1" style={{ color: "var(--ink-900)", fontWeight: 500 }}>
            {dashboardData.residentsAtRisk.count} resident(s) flagged across 2 or more categories this quarter
          </span>
          <div className="flex gap-2 flex-wrap">
            {(dashboardData.residentsAtRisk.residentIds || []).slice(0, 8).map(id => (
              <span
                key={id}
                className="text-xs px-2 py-1 rounded-full"
                style={{ background: "var(--bg-paper)", color: "var(--ink-700)", border: "1px solid var(--line-soft)", fontWeight: 500 }}
              >
                {id}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setActivePage("risk"); setVisExpanded(false); }}
            className="text-sm underline underline-offset-2"
            style={{ color: "var(--clay-ink)", fontWeight: 500 }}
          >
            View risk overview →
          </button>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total residents", value: hasData ? <>{dashboardData.summaryStrip?.totalResidents ?? "—"}<span className="text-sm font-normal ml-1" style={{ color: "var(--ink-500)" }}>this quarter</span></> : "—", empty: !hasData },
          { label: "Categories at risk", value: hasData ? <><span style={{ color: "var(--clay-ink)" }}>{dashboardData.summaryStrip?.categoriesAtRiskCount ?? 0}</span><span className="text-sm font-normal ml-1" style={{ color: "var(--ink-500)" }}>of {dashboardData.summaryStrip?.categoriesAtRiskOf ?? 14} red</span></> : "—", empty: !hasData },
          { label: "Last submission", value: hasData ? <>{dashboardData.summaryStrip?.lastSubmissionDate ?? "—"}<span className="text-sm font-normal ml-1" style={{ color: "var(--ink-500)" }}>{currentQuarterLabel !== "—" ? currentQuarterLabel : ""}</span></> : "—", empty: !hasData },
        ].map(({ label, value, empty }) => (
          <div key={label} className="cd-kpi">
            <div
              className="uppercase mb-1.5"
              style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--ink-500)", fontWeight: 600 }}
            >
              {label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 28,
                color: empty ? "var(--ink-500)" : "var(--ink-900)",
                lineHeight: 1.1,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Overview visualizations */}
      {hasData && (
        <div className="mb-6">
          <h2 className="cd-section-title mb-4">Facility performance overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* All category rates bar chart */}
            <div className="cd-surface" style={{ padding: 18 }}>
              <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--ink-900)" }}>All category rates</h3>
              <p className="text-xs mb-3" style={{ color: "var(--ink-500)" }}>Latest prevalence/score across all 14 QI categories</p>
              <ResponsiveContainer width="100%" height={260}>
                {(() => { const rates = buildOverviewFromAggregates(qiAggregates) || []; return (
                  <BarChart data={rates} margin={{ top: 5, right: 5, left: 5, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="name" tick={axisTickStyle} angle={-45} textAnchor="end" height={50} stroke={CHART_AXIS} />
                    <YAxis tick={axisTickStyle} stroke={CHART_AXIS} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="rate" name="Rate" radius={4}>
                      {rates.map((entry, i) => (
                        <Cell key={i} fill={entry.status === "red" ? STATUS.bad : entry.status === "amber" ? STATUS.warn : CHART_PALETTE[0]} />
                      ))}
                    </Bar>
                  </BarChart>
                ); })()}
              </ResponsiveContainer>
            </div>
            {/* Radar, facility vs national */}
            {overviewRadar.length > 0 && (
              <div className="cd-surface" style={{ padding: 18 }}>
                <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--ink-900)" }}>Key indicators, facility vs national</h3>
                <p className="text-xs mb-3" style={{ color: "var(--ink-500)" }}>Prevalence rates compared to AIHW national medians</p>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={overviewRadar} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                    <PolarGrid stroke={CHART_GRID} />
                    <PolarAngleAxis dataKey="subject" tick={axisTickStyle} />
                    <PolarRadiusAxis angle={90} domain={[0, 25]} tick={axisTickStyle} />
                    <Radar name="Facility" dataKey="value" stroke={CHART_PALETTE[0]} fill={CHART_PALETTE[0]} fillOpacity={0.35} strokeWidth={2} />
                    <Radar name="National" dataKey="benchmark" stroke={CHART_AXIS} fill="none" fillOpacity={0} strokeWidth={2} strokeDasharray="5 3" />
                    <Legend wrapperStyle={legendStyle} /><Tooltip {...tooltipStyle} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload banner (no data state) */}
      {!hasData && !loading && (
        <div
          className="mb-6 flex flex-wrap items-center gap-6 transition"
          style={{
            background: "var(--bg-paper)",
            border: "1px dashed var(--line-strong)",
            borderRadius: "var(--r-lg)",
            padding: 28,
          }}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "var(--bg-sage-tint)",
              color: "var(--sage-ink)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold mb-1" style={{ color: "var(--ink-900)" }}>No QI data loaded yet</h3>
            <p className="text-sm" style={{ color: "var(--ink-500)" }}>Upload your quarterly CSV export to populate all 14 indicators.</p>
          </div>
          <Link to="/upload-csv" className="cd-btn cd-btn-primary shrink-0">
            Go to Data entry →
          </Link>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="mb-6 text-center py-12">
          <div
            className="inline-block w-8 h-8 rounded-full animate-spin mb-3"
            style={{ border: "2px solid var(--sage)", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "var(--ink-500)" }}>Loading QI data...</p>
        </div>
      )}

      {/* Quarter selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div
          className="uppercase"
          style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--ink-500)" }}
        >
          {hasData ? "Quality indicators" : "Quality indicators, awaiting data"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="cd-chip">
            {hasData ? `ACFI registered · ${dashboardData?.header?.residentCountForLatestQuarter ?? ""} residents` : loading ? "Loading…" : "No data loaded"}
          </span>
          {hasQuarters && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="w-9 h-9 flex items-center justify-center transition disabled:opacity-50"
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--line)",
                  background: "var(--bg-white)",
                  color: "var(--ink-700)",
                }}
                onClick={() => setQuarterIndex(i => Math.max(0, i - 1))}
                disabled={safeQI <= 0}
              >‹</button>
              <span
                className="text-sm font-medium min-w-[88px] text-center"
                style={{
                  color: "var(--ink-900)",
                  background: "var(--bg-white)",
                  border: "1px solid var(--line)",
                  padding: "6px 12px",
                  borderRadius: 10,
                }}
              >
                {currentQuarterLabel}
              </span>
              <button
                type="button"
                className="w-9 h-9 flex items-center justify-center transition disabled:opacity-50"
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--line)",
                  background: "var(--bg-white)",
                  color: "var(--ink-700)",
                }}
                onClick={() => setQuarterIndex(i => Math.min(quarters.length - 1, i + 1))}
                disabled={safeQI >= quarters.length - 1}
              >›</button>
            </div>
          )}
        </div>
      </div>

      {/* Indicator cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {hasData
          ? (dashboardData?.indicators ?? []).map((ind, i) => {
              const ratePerQ = ind.ratePerQuarter ?? [];
              const rateForQ = ratePerQ.length > 0 ? (ratePerQ[safeQI] ?? ratePerQ[ratePerQ.length - 1]) : null;
              const valDisp = ind.valueDisplay ?? "—";
              const isPct = String(valDisp).endsWith("%");
              let displayRate = rateForQ != null && typeof rateForQ === "number" ? `${Number(rateForQ).toFixed(2)}${isPct ? "%" : ""}` : (valDisp ?? "—");
              const isNoData = rateForQ == null || valDisp === "N/A";
              if (isNoData) displayRate = "N/A";
              let status = ind.status || "grey";
              if (displayRate === "N/A") status = "nodata";
              const trend = displayRate === "N/A" ? null : (ind.trendArrow ?? null);
              const spark = displayRate === "N/A" ? [] : ratePerQ.filter(v => v != null).map(Number);
              const showAsND = displayRate === "N/A";
              const secId = ind.id ? (DASHBOARD_TO_REPORTS_SECTION[ind.id] ?? REPORTS_SECTION_IDS[i]) : REPORTS_SECTION_IDS[i];
              const accentVar = status === "green" ? "var(--sage)" : status === "amber" ? "var(--clay)" : status === "red" ? "var(--clay-ink)" : "var(--line)";
              const pillBg = status === "green" ? "var(--bg-sage-tint)" : status === "amber" ? "var(--bg-clay-tint)" : status === "red" ? "var(--bg-clay-tint)" : "var(--bg-cream)";
              const pillInk = status === "green" ? "var(--sage-ink)" : status === "amber" ? "var(--clay-ink)" : status === "red" ? "var(--clay-ink)" : "var(--ink-500)";
              return (
                <button
                  key={ind.id ?? i}
                  type="button"
                  onClick={() => goToChartSection(secId)}
                  className="block text-left relative overflow-hidden animate-[fadeIn_0.3s_ease_both] transition-all cursor-pointer"
                  style={{
                    background: "var(--bg-white)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--r-lg)",
                    padding: 16,
                    animationDelay: `${0.03 * (i + 1)}s`,
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ background: accentVar, borderTopLeftRadius: "var(--r-lg)", borderTopRightRadius: "var(--r-lg)" }} />
                  <div className="text-sm font-semibold mb-2 min-h-[2rem]" style={{ color: showAsND ? "var(--ink-500)" : "var(--ink-900)" }}>{ind.name}</div>
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: 26,
                      lineHeight: 1.1,
                      color: showAsND ? "var(--ink-500)" : "var(--ink-900)",
                      marginBottom: 2,
                    }}
                  >
                    {displayRate}
                  </div>
                  <div className="uppercase mb-2" style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--ink-500)" }}>{showAsND ? "no data" : "prevalence rate"}</div>
                  <div className="h-7 mb-2"><SparklineSVG data={spark} status={status} /></div>
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    {trend ? <span className="text-xs font-medium" style={{ color: trend === "up" ? "var(--clay-ink)" : trend === "down" ? "var(--sage-ink)" : "var(--ink-500)" }}>{TREND_LABEL[trend] ?? "→ Stable"}</span> : <span className="text-xs" style={{ color: "var(--ink-500)" }}>No data</span>}
                    <span
                      className="text-xs font-semibold uppercase"
                      style={{ background: pillBg, color: pillInk, padding: "2px 8px", borderRadius: 999 }}
                    >
                      {STATUS_LABEL[status] ?? STATUS_LABEL.nodata}
                    </span>
                  </div>
                </button>
              );
            })
          : INDICATORS_EMPTY.map((name, i) => (
              <button
                key={name}
                type="button"
                onClick={() => goToChartSection(REPORTS_SECTION_IDS[i] ?? "pi")}
                className="block text-left relative overflow-hidden animate-[fadeIn_0.3s_ease_both] transition-all cursor-pointer"
                style={{
                  background: "var(--bg-white)",
                  border: "1px solid var(--line-soft)",
                  borderRadius: "var(--r-lg)",
                  padding: 16,
                  animationDelay: `${0.02 * (i + 1)}s`,
                }}
              >
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "var(--line)", borderTopLeftRadius: "var(--r-lg)", borderTopRightRadius: "var(--r-lg)" }} />
                <div className="text-sm font-semibold mb-2 min-h-[2rem]" style={{ color: "var(--ink-500)" }}>{name}</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 26, color: "var(--ink-300, #B7B0A1)", marginBottom: 2 }}>—</div>
                <div className="uppercase mb-2" style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--ink-500)" }}>no data</div>
                <div className="h-7 mb-2 rounded overflow-hidden relative qi-shimmer" style={{ background: "var(--bg-cream)" }} />
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--ink-500)" }}>awaiting upload</span>
                  <span className="text-xs font-semibold uppercase" style={{ background: "var(--bg-cream)", color: "var(--ink-500)", padding: "2px 8px", borderRadius: 999 }}>No data</span>
                </div>
              </button>
            ))}
      </div>
    </div>
  );

  // ─── Visualization tab (14 per-category panels) ────────────────────────────

  const gpmsEmpty = !allGpmsData || Object.keys(allGpmsData).length === 0;
  const GpmsPlaceholder = ({ msg }) => (
    <p className="text-sm py-8 text-center" style={{ color: "var(--ink-500)" }}>{gpmsLoading ? "Loading sub-indicator data…" : (msg || "Upload QI CSV to see sub-indicator breakdowns.")}</p>
  );
  // Helper: find indicator from latest aggregates
  const getInd = (id) => (latest?.indicators || []).find(i => i.id === id);
  // Helper: stat card
  const StatCard = ({ label, value, sub, danger }) => (
    <div
      style={{
        background: danger ? "var(--bg-clay-tint)" : "var(--bg-white)",
        border: `1px solid ${danger ? "var(--clay)" : "var(--line)"}`,
        borderRadius: "var(--r-md)",
        padding: 12,
      }}
    >
      <div className="uppercase mb-0.5" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "var(--ink-500)" }}>{label}</div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 22,
          lineHeight: 1.1,
          color: danger ? "var(--clay-ink)" : "var(--ink-900)",
        }}
      >
        {value ?? "—"}
      </div>
      {sub && <div className="mt-0.5" style={{ fontSize: 10, color: "var(--ink-500)" }}>{sub}</div>}
    </div>
  );
  // Helper: single-indicator trend line panel
  const SingleTrendChart = ({ panelData, color = CHART_PALETTE[0] }) => {
    if (!panelData?.data?.length) return <GpmsPlaceholder />;
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={panelData.data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis dataKey="date" tick={axisTickStyle} stroke={CHART_AXIS} />
          <YAxis tick={axisTickStyle} stroke={CHART_AXIS} unit={panelData.unit || ""} />
          <Tooltip formatter={(v) => `${Number(v).toFixed(1)}${panelData.unit || ""}`} />
          {panelData.target != null && <ReferenceLine y={panelData.target} stroke={CHART_AXIS} strokeDasharray="6 3" label={{ value: `${panelData.target}% target`, position: "right", fontSize: 10, fill: CHART_AXIS }} />}
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} name={panelData.name || "Rate"} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const visualizationTab = (
    <div className="flex-1 min-w-0 space-y-6">
      <div className="mb-2">
        <span className="cd-chip">Deep dive</span>
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(28px, 3.6vw, 36px)",
            letterSpacing: "-0.02em",
            color: "var(--ink-900)",
            marginTop: 8,
          }}
        >
          Per-category visualisation
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--ink-500)" }}>Deep-dive analytics across all 14 QI categories</p>
      </div>

      {!hasData && !loading && (
        <div
          className="text-center"
          style={{
            background: "var(--bg-paper)",
            border: "1px dashed var(--line-strong)",
            borderRadius: "var(--r-lg)",
            padding: 32,
          }}
        >
          <p style={{ color: "var(--ink-500)" }}>No QI data available. Upload CSV to populate visualizations.</p>
          <Link to="/upload-csv" className="text-sm hover:underline mt-2 inline-block" style={{ color: "var(--sage-ink)", fontWeight: 500 }}>Go to Data entry →</Link>
        </div>
      )}

      {/* ── QI 1: Pressure Injuries ── */}
      <div id="panel-qi-pi" className="cd-surface p-6">
        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)", border: "1px solid var(--sage)" }}>QI 1</span><h3 className="text-base font-semibold text-gray-900">Pressure Injuries, Severity Distribution</h3></div>
        <p className="text-sm text-gray-500 mb-4">Is PI severity getting worse even if the count is stable?</p>
        {piSeverity.length > 0 ? (<>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard label="PI count" value={piSeverity[piSeverity.length-1]?._any} sub="latest quarter" />
            <StatCard label="Prevalence" value={getInd("pi")?.currentRate != null ? `${getInd("pi").currentRate}%` : "—"} />
            <StatCard label="High-acuity (S3+)" value={piSeverity[piSeverity.length-1]?._s3plus} />
            <StatCard label="S3+ %" value={piSeverity[piSeverity.length-1]?._s3PlusPct != null ? `${piSeverity[piSeverity.length-1]._s3PlusPct}%` : "—"} danger={piSeverity[piSeverity.length-1]?._s3PlusPct > 30} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Severity Distribution</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={piSeverity} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="quarter" tick={axisTickStyle} stroke={CHART_AXIS} />
                <YAxis tick={axisTickStyle} stroke={CHART_AXIS} label={{ value: "Residents", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: CHART_AXIS } }} />
                <Tooltip {...tooltipStyle} />
                {Object.entries(PI_STAGE_COLORS).map(([key, color]) => (<Bar key={key} dataKey={key} stackId="pi" fill={color} name={key} />))}
                <Legend wrapperStyle={legendStyle} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>) : <GpmsPlaceholder />}
      </div>

      {/* ── QI 2: Restrictive Practices ── */}
      <div id="panel-qi-rp" className="cd-surface p-6">
        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)", border: "1px solid var(--sage)" }}>QI 2</span><h3 className="text-base font-semibold text-gray-900">Restrictive Practices, Sub-Type Distribution</h3></div>
        <p className="text-sm text-gray-500 mb-4">Which types of restraint are being used, and is the mix shifting?</p>
        {(() => { const ind = getInd("rp"); return (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="RP rate" value={ind?.currentRate != null ? `${ind.currentRate}%` : "—"} />
            <StatCard label="Residents with RP" value={rpData.subTypeBreakdown[rpData.subTypeBreakdown.length-1]?._any ?? "—"} sub="latest quarter" />
            <StatCard label="Trend" value={ind?.trendArrow === "up" ? "▲ Worsening" : ind?.trendArrow === "down" ? "▼ Improving" : "Stable"} />
          </div>
        ); })()}
        {rpData.subTypeBreakdown.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Sub-Type Breakdown</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={rpData.subTypeBreakdown} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="quarter" tick={axisTickStyle} stroke={CHART_AXIS} />
                <YAxis tick={axisTickStyle} stroke={CHART_AXIS} label={{ value: "Residents", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: CHART_AXIS } }} />
                <Tooltip {...tooltipStyle} />
                {Object.entries(RP_COLORS).map(([key, color]) => (<Bar key={key} dataKey={key} fill={color} name={key} />))}
                <Legend wrapperStyle={legendStyle} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <GpmsPlaceholder msg="Upload CSV with RP sub-type columns (RP_MECH, RP_PHYS, RP_ENV, RP_SECLUSION) for detailed breakdown." />}
      </div>

      {/* ── QI 3: Unplanned Weight Loss ── */}
      <div id="panel-qi-uwl" className="cd-surface p-6">
        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)", border: "1px solid var(--sage)" }}>QI 3</span><h3 className="text-base font-semibold text-gray-900">Unplanned Weight Loss, Significant vs Consecutive</h3></div>
        <p className="text-sm text-gray-500 mb-4">Are we catching weight loss early (consecutive) before it becomes significant?</p>
        {uwlData.dualTrend.length > 0 ? (<>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Significant UWL" value={getInd("uwl")?.currentRate != null ? `${getInd("uwl").currentRate}%` : "—"} />
            <StatCard label="Consecutive (latest)" value={uwlData.dualTrend[uwlData.dualTrend.length-1]?.Consecutive != null ? `${uwlData.dualTrend[uwlData.dualTrend.length-1].Consecutive}%` : "—"} />
            <StatCard label="Early detection" value={uwlData.dualTrend[uwlData.dualTrend.length-1]?.Consecutive > uwlData.dualTrend[uwlData.dualTrend.length-1]?.Significant ? "Working" : "Monitor"} sub="Consecutive > Significant = good" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={uwlData.dualTrend} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="quarter" tick={axisTickStyle} stroke={CHART_AXIS} />
              <YAxis tick={axisTickStyle} stroke={CHART_AXIS} unit="%" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="Significant" stroke={STATUS.bad} strokeWidth={2} dot={{ r: 3, fill: STATUS.bad }} />
              <Line type="monotone" dataKey="Consecutive" stroke={STATUS.bad} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: STATUS.bad }} />
              <Legend wrapperStyle={legendStyle} />
            </LineChart>
          </ResponsiveContainer>
        </>) : <GpmsPlaceholder />}
      </div>

      {/* ── QI 4: Falls & Major Injury ── */}
      <div id="panel-qi-falls" className="cd-surface p-6">
        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)", border: "1px solid var(--sage)" }}>QI 4</span><h3 className="text-base font-semibold text-gray-900">Falls, Rate & Severity Ratio</h3></div>
        <p className="text-sm text-gray-500 mb-4">Are falls becoming more severe even if the rate is stable?</p>
        {fallsData.fallsTrend.length > 0 ? (<>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard label="Any fall rate" value={getInd("falls")?.currentRate != null ? `${getInd("falls").currentRate}%` : "—"} />
            <StatCard label="Major injury" value={fallsData.fallsTrend[fallsData.fallsTrend.length-1]?.["Major injury"] != null ? `${fallsData.fallsTrend[fallsData.fallsTrend.length-1]["Major injury"]}%` : "—"} />
            <StatCard label="Severity ratio" value={fallsData.fallsTrend[fallsData.fallsTrend.length-1]?.["Severity ratio"] != null ? `${fallsData.fallsTrend[fallsData.fallsTrend.length-1]["Severity ratio"]}%` : "—"} sub="% of falls = major" danger={fallsData.fallsTrend[fallsData.fallsTrend.length-1]?.["Severity ratio"] > 25} />
            <StatCard label="Trend" value={getInd("falls")?.trendArrow === "up" ? "▲ Worsening" : getInd("falls")?.trendArrow === "down" ? "▼ Improving" : "Stable"} />
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={fallsData.fallsTrend} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="quarter" tick={axisTickStyle} stroke={CHART_AXIS} />
              <YAxis tick={axisTickStyle} stroke={CHART_AXIS} unit="%" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="Any fall" stroke={CHART_PALETTE[0]} strokeWidth={2} dot={{ r: 3, fill: CHART_PALETTE[0] }} />
              <Line type="monotone" dataKey="Major injury" stroke={STATUS.bad} strokeWidth={2} dot={{ r: 3, fill: STATUS.bad }} />
              <Line type="monotone" dataKey="Severity ratio" stroke={CHART_PALETTE[2]} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: CHART_PALETTE[2] }} />
              <Legend wrapperStyle={legendStyle} />
            </LineChart>
          </ResponsiveContainer>
        </>) : <GpmsPlaceholder />}
      </div>

      {/* ── QI 5: Medications ── */}
      <div id="panel-qi-meds" className="cd-surface p-6">
        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)", border: "1px solid var(--sage)" }}>QI 5</span><h3 className="text-base font-semibold text-gray-900">Medications, Polypharmacy & Antipsychotic Use</h3></div>
        <p className="text-sm text-gray-500 mb-4">How many antipsychotic prescriptions lack a diagnosis? <span className="font-medium" style={{ color: "var(--clay-ink)" }}>"Without Dx"</span> = regulatory red flag.</p>
        {medData.polyTrend.length > 0 || medData.apBreakdown.length > 0 ? (<>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard label="Polypharmacy" value={getInd("meds")?.currentRate != null ? `${getInd("meds").currentRate}%` : "—"} />
            <StatCard label="AP rate" value={medData.apBreakdown.length > 0 ? `${Number(((medData.apBreakdown[medData.apBreakdown.length-1]["With Dx"] + medData.apBreakdown[medData.apBreakdown.length-1]["Without Dx"]) / (medData.apBreakdown[medData.apBreakdown.length-1]["No AP"] + medData.apBreakdown[medData.apBreakdown.length-1]["With Dx"] + medData.apBreakdown[medData.apBreakdown.length-1]["Without Dx"]) * 100).toFixed(1))}%` : "—"} />
            <StatCard label="Without Dx" value={medData.apBreakdown.length > 0 ? medData.apBreakdown[medData.apBreakdown.length-1]["Without Dx"] : "—"} danger />
            <StatCard label="Without Dx %" value={medData.apBreakdown.length > 0 ? (() => { const last = medData.apBreakdown[medData.apBreakdown.length-1]; const allAP = last["With Dx"] + last["Without Dx"]; return allAP > 0 ? `${Number((last["Without Dx"] / allAP * 100).toFixed(1))}%` : "0%"; })() : "—"} danger />
          </div>
          {medDistribution.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Medication Count Distribution</h4>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={medDistribution} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="quarter" tick={axisTickStyle} stroke={CHART_AXIS} />
                  <YAxis tick={axisTickStyle} stroke={CHART_AXIS} label={{ value: "Residents", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: CHART_AXIS } }} />
                  <Tooltip {...tooltipStyle} />
                  {Object.entries(MED_RANGE_COLORS).map(([key, color]) => (<Bar key={key} dataKey={key} stackId="med" fill={color} name={`${key} meds`} />))}
                  <Legend wrapperStyle={legendStyle} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>) : <GpmsPlaceholder />}
      </div>

      {/* ── QI 6: Activities of Daily Living ── */}
      <div id="panel-qi-adl" className="cd-surface p-6">
        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)", border: "1px solid var(--sage)" }}>QI 6</span><h3 className="text-base font-semibold text-gray-900">Activities of Daily Living, Barthel Domain Profile</h3></div>
        <p className="text-sm text-gray-500 mb-4">Which functional domains are weakest, and is decline concentrated?</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard label="ADL decline rate" value={getInd("adl")?.currentRate != null ? `${getInd("adl").currentRate}%` : "—"} />
          <StatCard label="Trend" value={getInd("adl")?.trendArrow === "up" ? "▲ Worsening" : getInd("adl")?.trendArrow === "down" ? "▼ Improving" : "Stable"} />
        </div>
        {adlData.hasSubScores ? (
          <ResponsiveContainer width="100%" height={360}>
            <RadarChart data={adlData.radarData} margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
              <PolarGrid stroke={CHART_GRID} />
              <PolarAngleAxis dataKey="domain" tick={axisTickStyle} />
              <PolarRadiusAxis angle={90} domain={[0, 3]} tick={axisTickStyle} />
              <Radar name="Latest" dataKey="latest" stroke={CHART_PALETTE[0]} fill={CHART_PALETTE[0]} fillOpacity={0.35} strokeWidth={2} />
              <Radar name="Earliest" dataKey="earliest" stroke={CHART_AXIS} fill="none" fillOpacity={0} strokeWidth={2} strokeDasharray="5 3" />
              <Legend wrapperStyle={legendStyle} /><Tooltip {...tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        ) : <GpmsPlaceholder msg="Upload CSV with Barthel sub-scores (ADL_BOWEL..ADL_BATHING) for domain breakdown." />}
        {adlChange.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">ADL Score Movement</h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={adlChange} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="quarter" tick={axisTickStyle} stroke={CHART_AXIS} />
                <YAxis tick={axisTickStyle} stroke={CHART_AXIS} label={{ value: "Residents", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: CHART_AXIS } }} />
                <Tooltip {...tooltipStyle} />
                {Object.entries(ADL_CHANGE_COLORS).map(([key, color]) => (<Bar key={key} dataKey={key} stackId="adl" fill={color} name={key} />))}
                <Legend wrapperStyle={legendStyle} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── QI 7: Incontinence Care ── */}
      <div id="panel-qi-ic" className="cd-surface p-6">
        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)", border: "1px solid var(--sage)" }}>QI 7</span><h3 className="text-base font-semibold text-gray-900">Incontinence Care, IAD Severity Distribution</h3></div>
        <p className="text-sm text-gray-500 mb-4">Is IAD severity shifting toward Cat 2 (worse) even if overall rate is stable?</p>
        {icData.iadSeverity.length > 0 ? (<>
          {(() => { const last = icData.iadSeverity[icData.iadSeverity.length-1]; const severe = (last["Cat 2A"] || 0) + (last["Cat 2B"] || 0); const iadAny = last._iadAny || 0; return (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <StatCard label="IAD rate" value={getInd("incontinence")?.currentRate != null ? `${getInd("incontinence").currentRate}%` : "—"} />
              <StatCard label="Severe (2A+2B)" value={severe} sub="latest quarter" />
              <StatCard label="Severe %" value={iadAny > 0 ? `${Number((severe / iadAny * 100).toFixed(1))}%` : "—"} danger={iadAny > 0 && severe / iadAny > 0.3} />
            </div>
          ); })()}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Severity Distribution</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={icData.iadSeverity} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="quarter" tick={axisTickStyle} stroke={CHART_AXIS} />
                <YAxis tick={axisTickStyle} stroke={CHART_AXIS} label={{ value: "Residents", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: CHART_AXIS } }} />
                <Tooltip {...tooltipStyle} />
                {Object.entries(IAD_COLORS).map(([key, color]) => (<Bar key={key} dataKey={key} stackId="iad" fill={color} name={key} />))}
                <Legend wrapperStyle={legendStyle} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>) : <GpmsPlaceholder />}
      </div>

      {/* ── QI 8: Hospitalisation ── */}
      <div id="panel-qi-hosp" className="cd-surface p-6">
        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)", border: "1px solid var(--sage)" }}>QI 8</span><h3 className="text-base font-semibold text-gray-900">Hospitalisation, ED vs All Admissions</h3></div>
        <p className="text-sm text-gray-500 mb-4">What fraction of hospitalisations are ED presentations? Is this diverging?</p>
        {hospData.dualTrend.length > 0 ? (<>
          {(() => { const last = hospData.dualTrend[hospData.dualTrend.length-1]; const edPct = last["All hosp"] > 0 ? Number((last["ED presentations"] / last["All hosp"] * 100).toFixed(1)) : 0; return (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <StatCard label="All hosp rate" value={getInd("hosp")?.currentRate != null ? `${getInd("hosp").currentRate}%` : "—"} />
              <StatCard label="ED rate" value={`${last["ED presentations"]}%`} />
              <StatCard label="ED / All hosp" value={`${edPct}%`} sub="proportion via ED" />
            </div>
          ); })()}
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hospData.dualTrend} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="quarter" tick={axisTickStyle} stroke={CHART_AXIS} />
              <YAxis tick={axisTickStyle} stroke={CHART_AXIS} unit="%" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="All hosp" stroke={CHART_PALETTE[1]} strokeWidth={2} dot={{ r: 3, fill: CHART_PALETTE[1] }} />
              <Line type="monotone" dataKey="ED presentations" stroke={STATUS.bad} strokeWidth={2} dot={{ r: 3, fill: STATUS.bad }} />
              <Legend wrapperStyle={legendStyle} />
            </LineChart>
          </ResponsiveContainer>
        </>) : <GpmsPlaceholder />}
      </div>

      {/* ── QI 9: Workforce ── */}
      <div id="panel-qi-wf" className="cd-surface p-6">
        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)", border: "1px solid var(--sage)" }}>QI 9</span><h3 className="text-base font-semibold text-gray-900">Workforce Adequacy</h3></div>
        <p className="text-sm text-gray-500 mb-4">Are we meeting workforce adequacy targets?</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="WF adequacy" value={wfPanel.current != null ? `${wfPanel.current}%` : "—"} />
          <StatCard label="Target" value="90%" />
          <StatCard label="Gap to target" value={wfPanel.gap != null ? `${wfPanel.gap > 0 ? wfPanel.gap : 0}pp` : "—"} danger={wfPanel.gap > 0} />
          <StatCard label="Trend" value={(() => { const ts = effectiveTrendSeries.find(t => t.id === "wf"); if (!ts || ts.data.length < 2) return "Stable"; const d = ts.data[ts.data.length-1].value - ts.data[0].value; return Math.abs(d) < 0.5 ? "Stable" : (ts.lob ? d < 0 : d > 0) ? "▲ Improving" : "▼ Declining"; })()} />
        </div>
        {wfPanel.data.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Workforce Adequacy, Trend</p>
            <SingleTrendChart panelData={wfPanel} />
          </div>
        )}
      </div>

      {/* ── QI 10: Consumer Experience ── */}
      <div id="panel-qi-cx" className="cd-surface p-6">
        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)", border: "1px solid var(--sage)" }}>QI 10</span><h3 className="text-base font-semibold text-gray-900">Consumer Experience, Score Distributions</h3></div>
        <p className="text-sm text-gray-500 mb-4">Is satisfaction broadly improving, or concentrated in a few high-scorers?</p>
        {cxData.bands.length > 0 ? (<>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Avg CE score" value={getInd("consumer_exp")?.currentRate != null ? `${getInd("consumer_exp").currentRate}/24` : "—"} />
            <StatCard label="Positive sentiment" value={cxData.positivePct != null ? `${cxData.positivePct}%` : "—"} sub="Excellent + Good" />
            <StatCard label="Trend" value={getInd("consumer_exp")?.trendArrow === "down" ? "▲ Improving" : getInd("consumer_exp")?.trendArrow === "up" ? "▼ Declining" : "Stable"} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Score Band Distribution</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cxData.bands} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="quarter" tick={axisTickStyle} stroke={CHART_AXIS} />
                <YAxis tick={axisTickStyle} stroke={CHART_AXIS} />
                <Tooltip {...tooltipStyle} />
                {Object.entries(CX_QOL_COLORS).map(([key, color]) => (<Bar key={key} dataKey={key} fill={color} name={key} />))}
                <Legend wrapperStyle={legendStyle} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>) : <GpmsPlaceholder />}
      </div>

      {/* ── QI 11: Quality of Life ── */}
      <div id="panel-qi-qol" className="cd-surface p-6">
        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)", border: "1px solid var(--sage)" }}>QI 11</span><h3 className="text-base font-semibold text-gray-900">Quality of Life, Score Distributions</h3></div>
        <p className="text-sm text-gray-500 mb-4">Is QoL improving across the board or just for some residents?</p>
        {qolData.bands.length > 0 ? (<>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Avg QoL score" value={getInd("qol")?.currentRate != null ? `${getInd("qol").currentRate}/24` : "—"} />
            <StatCard label="Positive sentiment" value={qolData.positivePct != null ? `${qolData.positivePct}%` : "—"} sub="Excellent + Good" />
            <StatCard label="Trend" value={getInd("qol")?.trendArrow === "down" ? "▲ Improving" : getInd("qol")?.trendArrow === "up" ? "▼ Declining" : "Stable"} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Score Band Distribution</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={qolData.bands} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="quarter" tick={axisTickStyle} stroke={CHART_AXIS} />
                <YAxis tick={axisTickStyle} stroke={CHART_AXIS} />
                <Tooltip {...tooltipStyle} />
                {Object.entries(CX_QOL_COLORS).map(([key, color]) => (<Bar key={key} dataKey={key} fill={color} name={key} />))}
                <Legend wrapperStyle={legendStyle} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>) : <GpmsPlaceholder />}
      </div>

      {/* ── QI 12: Enrolled Nursing ── */}
      <div id="panel-qi-en" className="cd-surface p-6">
        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)", border: "1px solid var(--sage)" }}>QI 12</span><h3 className="text-base font-semibold text-gray-900">Enrolled Nursing, Direct Care</h3></div>
        <p className="text-sm text-gray-500 mb-4">Is enrolled nursing direct care meeting the target?</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="EN direct care" value={enPanel.current != null ? `${enPanel.current}%` : "—"} />
          <StatCard label="Target" value="90%" />
          <StatCard label="Gap to target" value={enPanel.gap != null ? `${enPanel.gap > 0 ? enPanel.gap : 0}pp` : "—"} danger={enPanel.gap > 0} />
          <StatCard label="Trend" value={(() => { const ts = effectiveTrendSeries.find(t => t.id === "en"); if (!ts || ts.data.length < 2) return "Stable"; const d = ts.data[ts.data.length-1].value - ts.data[0].value; return Math.abs(d) < 0.5 ? "Stable" : (ts.lob ? d < 0 : d > 0) ? "▲ Improving" : "▼ Declining"; })()} />
        </div>
        {enPanel.data.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Enrolled Nursing Direct Care, Trend</p>
            <SingleTrendChart panelData={enPanel} />
          </div>
        )}
      </div>

      {/* ── QI 13: Allied Health ── */}
      <div id="panel-qi-ah" className="cd-surface p-6">
        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)", border: "1px solid var(--sage)" }}>QI 13</span><h3 className="text-base font-semibold text-gray-900">Allied Health, Discipline Gap Analysis</h3></div>
        <p className="text-sm text-gray-500 mb-4">Which disciplines are under-served, and is the gap closing over time?</p>
        {ahData.disciplines.length > 0 && ahData.disciplines.some(d => d.received > 0) ? (<>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="AH gap rate" value={ahData.gapRate != null ? `${ahData.gapRate.toFixed(1)}%` : "—"} />
            <StatCard label="Total assessed" value={ahData.total || "—"} sub="latest quarter" />
            <StatCard label="Most under-served" value={(() => { const sorted = [...ahData.disciplines].sort((a, b) => a.received - b.received); return sorted[0]?.received === 0 ? sorted[0]?.name : sorted[0]?.name; })()} sub={`${[...ahData.disciplines].sort((a, b) => a.received - b.received)[0]?.received || 0} received`} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">{ahData.gapData ? "Recommended vs Received (Latest)" : "Discipline Breakdown (Latest)"}</h4>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={ahData.gapData || ahData.disciplines} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis type="number" tick={axisTickStyle} stroke={CHART_AXIS} />
                  <YAxis type="category" dataKey="name" tick={axisTickStyle} stroke={CHART_AXIS} width={95} />
                  <Tooltip {...tooltipStyle} />
                  {ahData.gapData ? (<>
                    <Bar dataKey="Recommended" fill={CHART_PALETTE[5]} name="Recommended" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Received" fill={CHART_PALETTE[1]} name="Received" radius={[0, 4, 4, 0]} />
                    <Legend wrapperStyle={legendStyle} />
                  </>) : (
                    <Bar dataKey="received" fill={CHART_PALETTE[1]} radius={[0, 4, 4, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {ahData.timeSeries.length > 1 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Disciplines Over Time</h4>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={ahData.timeSeries} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="quarter" tick={axisTickStyle} stroke={CHART_AXIS} />
                    <YAxis tick={axisTickStyle} stroke={CHART_AXIS} />
                    <Tooltip {...tooltipStyle} />
                    {["Physiotherapy","Occupational Therapy","Speech Pathology","Podiatry"].map((d, i) => (
                      <Bar key={d} dataKey={d} fill={CHART_PALETTE[i]} name={d} />
                    ))}
                    <Legend wrapperStyle={legendStyle} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>) : <GpmsPlaceholder />}
      </div>

      {/* ── QI 14: Lifestyle Officer ── */}
      <div id="panel-qi-ls" className="cd-surface p-6">
        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)", border: "1px solid var(--sage)" }}>QI 14</span><h3 className="text-base font-semibold text-gray-900">Lifestyle Officer, Sessions</h3></div>
        <p className="text-sm text-gray-500 mb-4">Are lifestyle sessions on track?</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Avg sessions" value={lsPanel.current != null ? lsPanel.current : "—"} />
          <StatCard label="Target" value="2.0 sessions/resident/qtr" />
          <StatCard label="Gap to target" value={lsPanel.current != null ? `${Math.max(0, 2.0 - lsPanel.current).toFixed(1)}` : "—"} danger={lsPanel.current != null && lsPanel.current < 2.0} />
          <StatCard label="Trend" value={(() => { const ts = effectiveTrendSeries.find(t => t.id === "ls"); if (!ts || ts.data.length < 2) return "Stable"; const d = ts.data[ts.data.length-1].value - ts.data[0].value; return Math.abs(d) < 0.5 ? "Stable" : (ts.lob ? d < 0 : d > 0) ? "▲ Improving" : "▼ Declining"; })()} />
        </div>
        {lsPanel.data.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Lifestyle Sessions, Trend</p>
            <SingleTrendChart panelData={{...lsPanel, target: 2.0}} />
          </div>
        )}
      </div>
    </div>
  );

  // ─── Trend Analysis tab ─────────────────────────────────────────────────────

  const trendsTab = effectiveTrendSeries.length > 0 ? (
    <div className="flex-1 min-w-0">
      <div className="mb-6">
        <span className="cd-chip">Quarter-over-quarter</span>
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(28px, 3.6vw, 36px)",
            letterSpacing: "-0.02em",
            color: "var(--ink-900)",
            marginTop: 8,
          }}
        >
          Trend analysis
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--ink-500)" }}>Comprehensive QI trend analysis across {quarters.length} assessment dates</p>
      </div>

      {/* All Quality Indicators, AIHW-style multi-line trend chart */}
      <div className="cd-surface p-6 mb-6">
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--ink-900)" }}>All quality indicators, trend over time</h3>
        <p className="text-sm mb-4" style={{ color: "var(--ink-500)" }}>Prevalence rates across {quarters.length} assessment periods for all 14 QI categories</p>
        <ResponsiveContainer width="100%" height={960}>
          <LineChart data={allIndicatorsTrendData} margin={{ top: 20, right: 64, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
            <XAxis dataKey="date" tick={axisTickStyle} stroke={CHART_GRID} tickLine={false} axisLine={{ stroke: CHART_GRID }} dy={8} />
            <YAxis
              scale="sqrt"
              tick={axisTickStyle}
              stroke={CHART_GRID}
              tickLine={false}
              axisLine={false}
              unit="%"
              domain={[0, (dataMax) => Math.ceil(dataMax / 10) * 10]}
              ticks={[0, 2, 5, 10, 15, 20, 30, 50, 75, 100]}
            />
            <Tooltip
              formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
              contentStyle={{ ...tooltipStyle.contentStyle, maxHeight: 360, overflowY: "auto" }}
              itemSorter={(item) => -(item.value || 0)}
            />
            {effectiveTrendSeries.map((ts, i) => {
              const color = TREND_COLORS[i % TREND_COLORS.length];
              const first = ts.data[0]?.value;
              const last = ts.data[ts.data.length - 1]?.value;
              const delta = last != null && first != null ? last - first : null;
              const improving = delta != null && (ts.lob ? delta < 0 : delta > 0);
              const arrowChar = delta == null ? "–" : Math.abs(delta) < 0.5 ? "–" : improving ? "▼" : "▲";
              const arrowColor = delta == null || Math.abs(delta) < 0.5 ? "#6B7570" : improving ? "oklch(0.42 0.06 150)" : "oklch(0.44 0.06 70)";
              return (
                <Line
                  key={ts.id}
                  type="monotone"
                  dataKey={ts.name}
                  stroke={color}
                  strokeWidth={2}
                  dot={(dotProps) => {
                    const { cx, cy, index, value } = dotProps;
                    const isLast = index === allIndicatorsTrendData.length - 1;
                    return (
                      <g key={`dot-${ts.id}-${index}`}>
                        <circle cx={cx} cy={cy} r={isLast ? 5.5 : 2.5} fill={color} stroke="#fff" strokeWidth={isLast ? 2 : 1} />
                        {isLast && value != null && (
                          <text x={cx + 16} y={cy} fontSize={16} dominantBaseline="middle" fontWeight="700" fill={arrowColor}>
                            {arrowChar}
                          </text>
                        )}
                      </g>
                    );
                  }}
                  activeDot={{ r: 5, fill: color, stroke: "#fff", strokeWidth: 2 }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
        {/* Legend, structured grid */}
        <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--line-soft)" }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-3 gap-x-2">
            {effectiveTrendSeries.map((ts, i) => {
              const color = TREND_COLORS[i % TREND_COLORS.length];
              const first = ts.data[0]?.value;
              const last = ts.data[ts.data.length - 1]?.value;
              const delta = last != null && first != null ? last - first : null;
              const improving = delta != null && (ts.lob ? delta < 0 : delta > 0);
              const stable = delta == null || Math.abs(delta) < 0.5;
              const deltaColor = stable ? "var(--ink-500)" : improving ? "var(--sage-ink)" : "var(--clay-ink)";
              return (
                <div key={ts.id} className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-[3px] rounded-full shrink-0" style={{ background: color }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate" style={{ color: "var(--ink-900)" }}>{ts.name}</div>
                    <div className="text-[10px] font-semibold" style={{ color: deltaColor }}>
                      {last != null ? `${Number(last).toFixed(1)}%` : "—"}
                      {!stable && <> {improving ? "↓" : "↑"} {Math.abs(delta).toFixed(1)}pp</>}
                      {stable && delta != null && <>,stable</>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary table */}
      <div className="cd-surface p-6 mb-6">
        <h3 className="text-base font-semibold mb-4" style={{ color: "var(--ink-900)" }}>Quarterly change summary</h3>
        <div className="overflow-x-auto">
          <table className="cd-table w-full text-sm">
            <thead>
              <tr>
                <th>Indicator</th>
                <th className="text-right">First</th>
                <th className="text-right">Latest</th>
                <th className="text-right">Change</th>
                <th className="text-right">% Change</th>
                <th className="text-center">Direction</th>
                <th className="text-center">Volatility</th>
              </tr>
            </thead>
            <tbody>
              {effectiveTrendSeries.map(ts => {
                const first = ts.data[0]?.value;
                const last = ts.data[ts.data.length - 1]?.value;
                const delta = last - first;
                const pctChange = first !== 0 ? ((delta / first) * 100).toFixed(1) : "N/A";
                const improving = ts.lob ? delta < 0 : delta > 0;
                const vals = ts.data.map(d => d.value);
                const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                const volatility = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length).toFixed(2);
                const dirColor = improving ? "var(--sage-ink)" : "var(--clay-ink)";
                const dirBg = improving ? "var(--bg-sage-tint)" : "var(--bg-clay-tint)";
                return (
                  <tr key={ts.id}>
                    <td style={{ fontWeight: 500 }}>{ts.name}</td>
                    <td className="text-right" style={{ color: "var(--ink-700)" }}>{first}{ts.unit}</td>
                    <td className="text-right" style={{ color: "var(--ink-700)" }}>{last}{ts.unit}</td>
                    <td className="text-right" style={{ color: dirColor, fontWeight: 500 }}>{delta > 0 ? "+" : ""}{delta.toFixed(2)}</td>
                    <td className="text-right" style={{ color: dirColor, fontWeight: 500 }}>{pctChange !== "N/A" ? (delta > 0 ? "+" : "") + pctChange + "%" : "N/A"}</td>
                    <td className="text-center"><span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: dirBg, color: dirColor }}>{improving ? "↓ Improving" : "↑ Worsening"}</span></td>
                    <td className="text-center" style={{ color: "var(--ink-500)" }}>{volatility}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* All trends grid */}
      <h3 className="text-base font-semibold mb-3" style={{ color: "var(--ink-900)" }}>Individual indicator trends</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {effectiveTrendSeries.map(ts => {
          const first = ts.data[0]?.value;
          const last = ts.data[ts.data.length - 1]?.value;
          const delta = last != null && first != null ? last - first : null;
          const improving = ts.lob ? delta < 0 : delta > 0;
          const trendColor = delta === null ? "var(--ink-500)" : improving ? "var(--sage-ink)" : "var(--clay-ink)";
          const trendSymbol = delta === null ? "—" : improving ? "↓ Improving" : "↑ Worsening";
          const lineStroke = improving ? STATUS.good : STATUS.warn;
          const vals = ts.data.map(d => d.value);
          const min = Math.min(...vals); const max = Math.max(...vals);
          return (
            <div key={ts.id} className="cd-surface p-4">
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-sm font-semibold" style={{ color: "var(--ink-900)" }}>{ts.name}</h3>
                <span className="text-xs font-medium" style={{ color: trendColor }}>{trendSymbol}</span>
              </div>
              <p className="text-xs mb-1" style={{ color: "var(--ink-500)" }}>{ts.lob ? "Lower is better" : "Higher is better"} · Unit: {ts.unit}</p>
              <div className="flex gap-3 text-xs mb-2" style={{ color: "var(--ink-500)" }}>
                <span>Range: {min}–{max}</span>
                <span>Δ: {delta != null ? (delta > 0 ? "+" : "") + delta.toFixed(2) : "—"}</span>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={ts.data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="date" tick={axisTickStyle} stroke={CHART_GRID} />
                  <YAxis tick={axisTickStyle} stroke={CHART_GRID} width={32} />
                  <Tooltip {...tooltipStyle} />
                  <Line type="monotone" dataKey="value" stroke={lineStroke} strokeWidth={2} dot={{ r: 3, fill: lineStroke }} name={ts.unit} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  ) : (
    <div className="flex-1 min-w-0 text-center py-12">
      <p style={{ color: "var(--ink-500)" }}>No trend data available. Upload QI data to see trend analysis.</p>
      <Link to="/upload-csv" className="font-medium text-sm hover:underline mt-2 inline-block" style={{ color: "var(--sage-ink)" }}>Go to Data entry →</Link>
    </div>
  );

  // ─── Risk Overview tab ──────────────────────────────────────────────────────

  const riskTab = (
    <div className="flex-1 min-w-0">
      <div className="mb-6">
        <span className="cd-chip">Cross-indicator</span>
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(28px, 3.6vw, 36px)",
            letterSpacing: "-0.02em",
            color: "var(--ink-900)",
            marginTop: 8,
          }}
        >
          Risk overview
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--ink-500)" }}>Residents flagged across multiple QI categories</p>
      </div>
      {hasData && dashboardData?.residentsAtRisk?.count > 0 ? (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="cd-kpi">
              <div className="uppercase mb-1.5" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--ink-500)", fontWeight: 600 }}>At-risk residents</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: "var(--clay-ink)", lineHeight: 1.1 }}>{dashboardData.residentsAtRisk.count}</div>
            </div>
            <div className="cd-kpi">
              <div className="uppercase mb-1.5" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--ink-500)", fontWeight: 600 }}>Total residents</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: "var(--ink-900)", lineHeight: 1.1 }}>{dashboardData.summaryStrip?.totalResidents ?? "—"}</div>
            </div>
            <div className="cd-kpi">
              <div className="uppercase mb-1.5" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--ink-500)", fontWeight: 600 }}>At-risk rate</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: "var(--clay-ink)", lineHeight: 1.1 }}>
                {dashboardData.summaryStrip?.totalResidents ? ((dashboardData.residentsAtRisk.count / dashboardData.summaryStrip.totalResidents) * 100).toFixed(1) : "—"}%
              </div>
            </div>
          </div>
          <div className="cd-surface p-6">
            <h3 className="text-base font-semibold mb-4" style={{ color: "var(--ink-900)" }}>Residents flagged across 2+ categories</h3>
            <div className="flex flex-wrap gap-2">
              {(dashboardData.residentsAtRisk.residentIds || []).map(id => (
                <span
                  key={id}
                  className="text-sm font-medium px-3 py-1.5 rounded-lg"
                  style={{ background: "var(--bg-clay-tint)", color: "var(--clay-ink)", border: "1px solid var(--line-soft)" }}
                >
                  {id}
                </span>
              ))}
            </div>
            <p className="text-xs mt-4" style={{ color: "var(--ink-500)" }}>View detailed per-indicator breakdown in <Link to="/reports" className="font-medium hover:underline" style={{ color: "var(--sage-ink)" }}>QI Reports</Link>.</p>
          </div>
        </div>
      ) : (
        <div className="cd-surface p-8 text-center">
          <p className="text-sm" style={{ color: "var(--ink-500)" }}>{hasData ? "No residents currently flagged across multiple categories." : "No risk data available. Upload QI data to see the resident risk overview."}</p>
          {!hasData && <Link to="/upload-csv" className="font-medium text-sm hover:underline mt-2 inline-block" style={{ color: "var(--sage-ink)" }}>Go to Data entry →</Link>}
        </div>
      )}
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-cream)" }}>
      <Navbar />
      <main className={`${PAGE_MAIN_ROW} max-w-[1440px]`}>
        <MobileSidebarPanel menuLabel="Facility view">{sidebar}</MobileSidebarPanel>
        <div className="flex-1 min-w-0 w-full">
          {activePage === "overview" && overviewTab}
          {activePage === "visualization" && visualizationTab}
          {activePage === "trends" && trendsTab}
          {activePage === "risk" && riskTab}
        </div>
      </main>
      <Footer />
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .qi-shimmer::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);animation:qi-shimmer 1.6s infinite}
        @keyframes qi-shimmer{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
      `}</style>
    </div>
  );
}
