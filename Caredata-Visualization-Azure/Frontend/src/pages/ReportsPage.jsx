import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { getQIAggregates, getQIResidents } from "../services/api";

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const SIDEBAR_ITEMS = [
  { id:"pi",    label:"Pressure injuries",          dot:"#F9C0AF" },
  { id:"falls", label:"Falls & major injury",       dot:"#F2D894" },
  { id:"uwl",   label:"Unplanned weight loss",      dot:"#D3EADA" },
  { id:"meds",  label:"Medications",                dot:"#D2C7E5" },
  { id:"adl",   label:"Activities of daily living", dot:"#D3EADA" },
  { id:"ic",    label:"Incontinence care",          dot:"#FFDDD8" },
  { id:"rp",    label:"Restrictive practices",      dot:"#F9C0AF" },
  { id:"hosp",  label:"Hospitalisation",            dot:"#F2D894" },
  { id:"ah",    label:"Allied health",              dot:"#D3EADA" },
  { id:"cx",    label:"Consumer experience",        dot:"#D2C7E5" },
  { id:"qol",   label:"Quality of life",            dot:"#FFDDD8" },
  { id:"wf",    label:"Workforce",                  dot:"#D3EADA" },
  { id:"en",    label:"Enrolled nursing",           dot:"#F2D894" },
  { id:"ls",    label:"Lifestyle officer",          dot:"#D2C7E5" },
];

// ─── Section templates (metadata only — rows computed dynamically) ───────────

const SECTION_TEMPLATES = [
  {
    id:"pi",
    title:"Pressure injuries",
    subtitle:"QI 01 — PI_01, PI_S1–S4, PI_US, PI_DTI",
    description:"Prevalence of new or worsening pressure injuries sustained within the facility during the reporting period. Staged using NPUAP/EPUAP classification.",
    columns:["Assessment date","Residents assessed","Any PI (PI_01)","Prevalence %","Stage 1","Stage 2","Stage 3","Stage 4","Unstageable","DTI"],
    highlight:["Prevalence %"],
    lowerIsBetter: true,
    rawCols:["PI_01","PI_S1","PI_S2","PI_S3","PI_S4","PI_US","PI_DTI"],
  },
  {
    id:"falls",
    title:"Falls & major injury",
    subtitle:"QI 04 — FALL_01, FALL_MAJ",
    description:"Unplanned falls occurring in the facility, including those resulting in major injury. Major injury includes fractures, head injuries requiring imaging, or any injury requiring hospital admission.",
    columns:["Assessment date","Residents assessed","Any fall (FALL_01)","Fall rate %","Major injury (FALL_MAJ)","Major injury rate %"],
    highlight:["Fall rate %","Major injury rate %"],
    lowerIsBetter: true,
    rawCols:["FALL_01","FALL_MAJ"],
  },
  {
    id:"uwl",
    title:"Unplanned weight loss",
    subtitle:"QI 03 — UWL_SIG, UWL_CON",
    description:"Residents experiencing significant unplanned weight loss (≥5% over 3 months or ≥10% over 6 months) or consecutive weight loss across reporting periods.",
    columns:["Assessment date","Residents assessed","Significant loss (UWL_SIG)","Significant rate %","Consecutive loss (UWL_CON)","Consecutive rate %"],
    highlight:["Significant rate %"],
    lowerIsBetter: true,
    rawCols:["UWL_SIG","UWL_CON"],
  },
  {
    id:"meds",
    title:"Medications",
    subtitle:"QI 05 — MED_POLY (polypharmacy ≥9), MED_AP (0=none, 1=with dx, 2=without dx)",
    description:"Polypharmacy is defined as 9 or more regular medications. Antipsychotic use is split into three categories: no antipsychotic, prescribed with a psychosis diagnosis, and prescribed without a recorded diagnosis (MED_AP=2). The third category is the primary focus of ACQSC regulatory audits.",
    columns:["Assessment date","Residents assessed","Polypharmacy (MED_POLY)","Polypharmacy %","AP: none","AP: with dx","AP: without dx","AP without dx %"],
    highlight:["AP without dx %","Polypharmacy %"],
    lowerIsBetter: true,
    rawCols:["MED_POLY","MED_AP"],
  },
  {
    id:"adl",
    title:"Activities of daily living",
    subtitle:"QI 06 — ADL_01 (decline flag), ADL Barthel 10-domain sub-scores (0–3 each)",
    description:"Significant functional decline in activities of daily living (ADL), assessed via the Barthel Index. Sub-scores are summed across 10 domains (Bowels, Bladder, Grooming, Toilet, Feeding, Transfer, Mobility, Dressing, Stairs, Bathing), each scored 0–3.",
    columns:["Assessment date","Residents assessed","Decline flag (ADL_01)","Decline rate %","Avg Barthel total","Avg Bowels","Avg Bladder","Avg Mobility","Avg Transfer","Avg Bathing"],
    highlight:["Decline rate %","Avg Barthel total"],
    lowerIsBetter: true,
    rawCols:["ADL_01","ADL_BOWEL","ADL_BLADDER","ADL_GROOM","ADL_TOILET","ADL_FEED","ADL_TRANS","ADL_MOB","ADL_DRESS","ADL_STAIRS","ADL_BATH"],
  },
  {
    id:"ic",
    title:"Incontinence care",
    subtitle:"QI 07 — IC_IAD, IC_IAD_1A, IC_IAD_1B, IC_IAD_2A, IC_IAD_2B",
    description:"Incontinence-associated dermatitis (IAD) prevalence, categorised by severity: Category 1A (persistent redness, intact skin), 1B (skin breakdown with maceration), 2A (skin loss with wound), 2B (skin loss with infection).",
    columns:["Assessment date","Residents assessed","Any IAD (IC_IAD)","IAD rate %","Cat 1A","Cat 1B","Cat 2A","Cat 2B"],
    highlight:["IAD rate %"],
    lowerIsBetter: true,
    rawCols:["IC_IAD","IC_IAD_1A","IC_IAD_1B","IC_IAD_2A","IC_IAD_2B"],
  },
  {
    id:"rp",
    title:"Restrictive practices",
    subtitle:"QI 02 — RP_01, RP_MECH, RP_PHYS, RP_ENV, RP_SEC",
    description:"Use of restrictive practices including mechanical restraint (RP_MECH), physical restraint (RP_PHYS), environmental restraint (RP_ENV), and seclusion (RP_SEC). All restrictive practices must be approved, documented, and reviewed regularly.",
    columns:["Assessment date","Residents assessed","Any restraint (RP_01)","Restraint rate %","Mechanical","Physical","Environmental","Seclusion"],
    highlight:["Restraint rate %"],
    lowerIsBetter: true,
    rawCols:["RP_01","RP_MECH","RP_PHYS","RP_ENV","RP_SEC"],
  },
  {
    id:"hosp",
    title:"Hospitalisation",
    subtitle:"QI 08 — HOSP_ED (unplanned ED), HOSP_ALL (unplanned admission)",
    description:"Unplanned hospitalisation events, including emergency department presentations (HOSP_ED) and all unplanned hospital admissions (HOSP_ALL). Planned admissions and day procedures are excluded.",
    columns:["Assessment date","Residents assessed","ED presentations","ED rate %","All admissions","Admission rate %"],
    highlight:["ED rate %","Admission rate %"],
    lowerIsBetter: true,
    rawCols:["HOSP_ED","HOSP_ALL"],
  },
  {
    id:"ah",
    title:"Allied health",
    subtitle:"QI 13 — AH_REC_RECOMMENDED, AH_REC_RECEIVED, AH_RCVD_PHYSIO/OT/SPEECH/POD/DIET/OTHER",
    description:"Allied health services recommended vs received. The 'gap' metric (AH gap %) represents residents who were assessed as needing allied health but did not receive it. Disciplines tracked: Physiotherapy, Occupational Therapy, Speech Pathology, Podiatry, Dietetics, and other.",
    columns:["Assessment date","Residents assessed","Recommended","Received","Gap (unmet)","Gap %","Avg minutes (AH_MIN)","Physio","OT","Speech"],
    highlight:["Gap %","Avg minutes (AH_MIN)"],
    lowerIsBetter: true,
    rawCols:["AH_REC_RECOMMENDED","AH_REC_RECEIVED","AH_RCVD_PHYSIO","AH_RCVD_OT","AH_RCVD_SPEECH","AH_RCVD_POD","AH_RCVD_DIET","AH_RCVD_OTHER","AH_MIN"],
  },
  {
    id:"cx",
    title:"Consumer experience",
    subtitle:"QI 10 — CE_01 (composite score 0–24, higher = better)",
    description:"Consumer experience is measured via the ACQSC Consumer Experience Report survey. CE_01 is a composite score from 0 to 24 derived from resident and family feedback. Higher scores indicate better experience.",
    columns:["Assessment date","Responses","Avg CE score (/24)","Score as %","Scores ≥18","Scores 12–17","Scores <12"],
    highlight:["Avg CE score (/24)","Score as %"],
    lowerIsBetter: false,
    rawCols:["CE_01"],
  },
  {
    id:"qol",
    title:"Quality of life",
    subtitle:"QI 11 — QOL_01 (composite score 0–24, higher = better)",
    description:"Quality of life is measured using the ACQSC Quality of Life survey. QOL_01 is a composite score from 0 to 24. Higher scores indicate better quality of life. Scores below 12 represent residents with significantly impaired quality of life.",
    columns:["Assessment date","Responses","Avg QoL score (/24)","Score as %","Scores ≥18","Scores 12–17","Scores <12"],
    highlight:["Avg QoL score (/24)","Scores <12"],
    lowerIsBetter: false,
    rawCols:["QOL_01"],
  },
  {
    id:"wf",
    title:"Workforce",
    subtitle:"QI 09 — WF_HOURS_PPD (care hours per resident per day), WF_ADEQUATE (staffing threshold met)",
    description:"Workforce adequacy is assessed at the facility level. WF_HOURS_PPD measures total direct care hours per resident per day, including registered nurses, enrolled nurses, and personal care workers. The minimum threshold is 4.0 hours per resident per day under Australian aged care funding.",
    columns:["Assessment date","Residents","Hours/resident/day","Threshold met","WF adequate flag count"],
    highlight:["Hours/resident/day","Threshold met"],
    lowerIsBetter: false,
    rawCols:["WF_HOURS_PPD","WF_ADEQUATE"],
  },
  {
    id:"en",
    title:"Enrolled nursing",
    subtitle:"QI 12 — EN_DIRECT_PCT (% time in direct care activities)",
    description:"The proportion of enrolled nursing time spent on direct resident care activities (as opposed to administrative, documentation, and other indirect tasks). A higher percentage indicates more time at bedside.",
    columns:["Assessment date","Residents","Direct care %","Admin & other %"],
    highlight:["Direct care %"],
    lowerIsBetter: false,
    rawCols:["EN_DIRECT_PCT"],
  },
  {
    id:"ls",
    title:"Lifestyle officer",
    subtitle:"QI 14 — LS_SESSIONS_QTR (lifestyle sessions per resident per quarter)",
    description:"Number of structured lifestyle, recreational, and social activity sessions attended by each resident during the reporting quarter. A minimum of 2 sessions per quarter is generally expected. Residents with zero sessions are a quality concern.",
    columns:["Assessment date","Residents assessed","Avg sessions","Total sessions","0 sessions","1–2 sessions","3–4 sessions","5+ sessions"],
    highlight:["Avg sessions","0 sessions"],
    lowerIsBetter: false,
    rawCols:["LS_SESSIONS_QTR"],
  },
];

// ─── Compute helpers ──────────────────────────────────────────────────────────

const _cb = (res, col) => res.filter(r => r[col] === 1).length;
const _avg = (res, col) => {
  const vals = res.map(r => r[col]).filter(v => v != null && v !== undefined);
  return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : null;
};
const _pct = (count, total) => total > 0 ? `${(100*count/total).toFixed(1)}%` : "0.0%";

function _bandCount(res, col, lo, hi) {
  return res.filter(r => {
    const v = r[col];
    return v != null && v >= lo && v <= hi;
  }).length;
}

function computeRow(sectionId, label, res) {
  const n = res.length;
  if (!n) return null;

  switch (sectionId) {
    case "pi": {
      const pi01 = _cb(res, "PI_01");
      return [label, String(n), String(pi01), _pct(pi01, n),
        String(_cb(res, "PI_S1")), String(_cb(res, "PI_S2")),
        String(_cb(res, "PI_S3")), String(_cb(res, "PI_S4")),
        String(_cb(res, "PI_US")), String(_cb(res, "PI_DTI"))];
    }
    case "falls": {
      const f01 = _cb(res, "FALL_01");
      const fmaj = _cb(res, "FALL_MAJ");
      return [label, String(n), String(f01), _pct(f01, n), String(fmaj), _pct(fmaj, n)];
    }
    case "uwl": {
      const sig = _cb(res, "UWL_SIG");
      const con = _cb(res, "UWL_CON");
      return [label, String(n), String(sig), _pct(sig, n), String(con), _pct(con, n)];
    }
    case "meds": {
      const poly = _cb(res, "MED_POLY");
      const apNone = res.filter(r => (r.MED_AP ?? 0) === 0).length;
      const apDx = res.filter(r => r.MED_AP === 1).length;
      const apNo = res.filter(r => r.MED_AP === 2).length;
      return [label, String(n), String(poly), _pct(poly, n),
        String(apNone), String(apDx), String(apNo), _pct(apNo, n)];
    }
    case "adl": {
      const adl01 = _cb(res, "ADL_01");
      const barthel = ["ADL_BOWEL","ADL_BLADDER","ADL_GROOM","ADL_TOILET","ADL_FEED",
        "ADL_TRANS","ADL_MOB","ADL_DRESS","ADL_STAIRS","ADL_BATH"]
        .map(c => _avg(res, c) || 0).reduce((a,b) => a+b, 0);
      return [label, String(n), String(adl01), _pct(adl01, n),
        barthel.toFixed(1),
        (_avg(res, "ADL_BOWEL") || 0).toFixed(2),
        (_avg(res, "ADL_BLADDER") || 0).toFixed(2),
        (_avg(res, "ADL_MOB") || 0).toFixed(2),
        (_avg(res, "ADL_TRANS") || 0).toFixed(2),
        (_avg(res, "ADL_BATH") || 0).toFixed(2)];
    }
    case "ic": {
      const iad = _cb(res, "IC_IAD");
      return [label, String(n), String(iad), _pct(iad, n),
        String(_cb(res, "IC_IAD_1A")), String(_cb(res, "IC_IAD_1B")),
        String(_cb(res, "IC_IAD_2A")), String(_cb(res, "IC_IAD_2B"))];
    }
    case "rp": {
      const rp01 = _cb(res, "RP_01");
      return [label, String(n), String(rp01), _pct(rp01, n),
        String(_cb(res, "RP_MECH")), String(_cb(res, "RP_PHYS")),
        String(_cb(res, "RP_ENV")), String(_cb(res, "RP_SEC"))];
    }
    case "hosp": {
      const ed = _cb(res, "HOSP_ED");
      const all = _cb(res, "HOSP_ALL");
      return [label, String(n), String(ed), _pct(ed, n), String(all), _pct(all, n)];
    }
    case "ah": {
      const rec = _cb(res, "AH_REC_RECOMMENDED");
      const rcvd = _cb(res, "AH_REC_RECEIVED");
      const gap = Math.max(0, rec - rcvd);
      const avgMin = (_avg(res, "AH_MIN") || 0).toFixed(0);
      return [label, String(n), String(rec), String(rcvd), String(gap),
        rec > 0 ? _pct(gap, rec) : "0.0%", avgMin,
        String(_cb(res, "AH_RCVD_PHYSIO")), String(_cb(res, "AH_RCVD_OT")),
        String(_cb(res, "AH_RCVD_SPEECH"))];
    }
    case "cx": {
      const avg = _avg(res, "CE_01");
      const avgStr = avg != null ? avg.toFixed(1) : "—";
      const pctStr = avg != null ? `${(avg / 24 * 100).toFixed(1)}%` : "—";
      return [label, String(n), avgStr, pctStr,
        String(_bandCount(res, "CE_01", 18, 24)),
        String(_bandCount(res, "CE_01", 12, 17.99)),
        String(_bandCount(res, "CE_01", 0, 11.99))];
    }
    case "qol": {
      const avg = _avg(res, "QOL_01");
      const avgStr = avg != null ? avg.toFixed(1) : "—";
      const pctStr = avg != null ? `${(avg / 24 * 100).toFixed(1)}%` : "—";
      return [label, String(n), avgStr, pctStr,
        String(_bandCount(res, "QOL_01", 18, 24)),
        String(_bandCount(res, "QOL_01", 12, 17.99)),
        String(_bandCount(res, "QOL_01", 0, 11.99))];
    }
    case "wf": {
      const avgHrs = _avg(res, "WF_HOURS_PPD");
      const hrsStr = avgHrs != null ? avgHrs.toFixed(2) : "—";
      const met = avgHrs != null && avgHrs >= 4.0 ? "Yes" : "No";
      const adequate = _cb(res, "WF_ADEQUATE");
      return [label, String(n), hrsStr, met, String(adequate)];
    }
    case "en": {
      const avgPct = _avg(res, "EN_DIRECT_PCT");
      const pctStr = avgPct != null ? `${avgPct.toFixed(1)}%` : "—";
      const adminStr = avgPct != null ? `${(100 - avgPct).toFixed(1)}%` : "—";
      return [label, String(n), pctStr, adminStr];
    }
    case "ls": {
      const avgSess = _avg(res, "LS_SESSIONS_QTR");
      const avgStr = avgSess != null ? avgSess.toFixed(1) : "—";
      const totalSess = res.reduce((s, r) => s + (r.LS_SESSIONS_QTR || 0), 0);
      const zero = res.filter(r => (r.LS_SESSIONS_QTR || 0) === 0).length;
      const oneTwo = res.filter(r => { const v = r.LS_SESSIONS_QTR || 0; return v >= 1 && v <= 2; }).length;
      const threeFour = res.filter(r => { const v = r.LS_SESSIONS_QTR || 0; return v >= 3 && v <= 4; }).length;
      const fivePlus = res.filter(r => (r.LS_SESSIONS_QTR || 0) >= 5).length;
      return [label, String(n), avgStr, String(totalSess),
        String(zero), String(oneTwo), String(threeFour), String(fivePlus)];
    }
    default:
      return null;
  }
}

function generateNotes(rows, template) {
  if (!rows || rows.length < 2) return "Upload QI data to see trend analysis across quarters.";
  const hi = (template.highlight || []).find(c => c !== "Assessment date");
  if (!hi) return "";
  const idx = template.columns.indexOf(hi);
  if (idx < 0) return "";
  const first = rows[0][idx];
  const last = rows[rows.length - 1][idx];
  const firstNum = parseFloat(first);
  const lastNum = parseFloat(last);
  if (isNaN(firstNum) || isNaN(lastNum)) return `${hi}: ${first} to ${last} over ${rows.length} quarters.`;
  const diff = lastNum - firstNum;
  const dir = template.lowerIsBetter
    ? (diff < -0.1 ? "improving" : diff > 0.1 ? "worsening" : "stable")
    : (diff > 0.1 ? "improving" : diff < -0.1 ? "worsening" : "stable");
  return `${hi}: ${first} → ${last} over ${rows.length} quarters (${dir}, ${diff > 0 ? "+" : ""}${diff.toFixed(1)}).`;
}

function generateMedsAlert(rows) {
  if (!rows || !rows.length) return null;
  const lastRow = rows[rows.length - 1];
  // Column index 6 = "AP: without dx"
  const apNoDx = parseInt(lastRow[6]) || 0;
  const label = lastRow[0];
  if (apNoDx > 0) {
    return `AP without recorded psychosis diagnosis: ${apNoDx} residents as of ${label}. These residents require clinical review — this metric is the primary focus of ACQSC audits.`;
  }
  return null;
}

function buildDynamicSections(aggregates, residentsByDate) {
  if (!aggregates?.length) return null;

  const dates = aggregates.map(a => ({
    date: a.assessmentDate,
    label: a.quarterLabel,
  }));

  // Get latest indicator statuses
  const latestAgg = aggregates[aggregates.length - 1];
  const statusMap = {};
  (latestAgg.indicators || []).forEach(ind => { statusMap[ind.id] = ind.status; });

  const badgeFor = (id) => {
    const s = statusMap[id] || "grey";
    if (s === "red") return { badge: "red", badgeLabel: "Above threshold" };
    if (s === "amber") return { badge: "amber", badgeLabel: "Monitor" };
    if (s === "green") return { badge: "green", badgeLabel: "On track" };
    return { badge: "green", badgeLabel: "No data" };
  };

  return SECTION_TEMPLATES.map(template => {
    const rows = dates
      .map(d => computeRow(template.id, d.label, residentsByDate[d.date] || []))
      .filter(Boolean);

    const { badge, badgeLabel } = badgeFor(template.id);
    const notes = generateNotes(rows, template);
    const alert = template.id === "meds" ? generateMedsAlert(rows) : undefined;

    return { ...template, badge, badgeLabel, rows, notes, alert };
  });
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const VALID_SECTION_IDS = new Set(SIDEBAR_ITEMS.map(i => i.id));

function getInitialId(searchParams) {
  const id = (searchParams.get("section") || "").toLowerCase().trim();
  return id && VALID_SECTION_IDS.has(id) ? id : "pi";
}

function badgeCls(badge) {
  if (badge === "red") return "bg-red-100 text-red-800";
  if (badge === "amber") return "bg-amber-100 text-amber-800";
  return "bg-green-100 text-green-800";
}

function valueCls(col, val, highlights) {
  if (!highlights.includes(col)) return "text-gray-700";
  if (typeof val === "string" && val.toLowerCase() === "no") return "text-red-600 font-semibold";
  if (typeof val === "string" && val.toLowerCase() === "yes") return "text-green-700 font-semibold";
  return "text-gray-900 font-medium";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [searchParams] = useSearchParams();
  const sectionParam = searchParams.get("section") || "";
  const [activeId, setActiveId] = useState(() => getInitialId(searchParams));
  const [showRaw, setShowRaw] = useState(false);
  const [dynamicSections, setDynamicSections] = useState(null);
  const [residentsByDate, setResidentsByDate] = useState({});
  const [apiAggregates, setApiAggregates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = sectionParam.toLowerCase().trim();
    if (id && VALID_SECTION_IDS.has(id) && id !== activeId) setActiveId(id);
  }, [sectionParam]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const aggResp = await getQIAggregates();
        const aggregates = aggResp?.aggregates || [];
        if (!aggregates.length || cancelled) { setLoading(false); return; }
        setApiAggregates(aggregates);

        // Fetch residents for each date in parallel
        const resByDate = {};
        await Promise.all(aggregates.map(async (agg) => {
          try {
            const resp = await getQIResidents(agg.assessmentDate);
            resByDate[agg.assessmentDate] = resp?.residents || [];
          } catch { resByDate[agg.assessmentDate] = []; }
        }));
        if (cancelled) return;
        setResidentsByDate(resByDate);

        const sections = buildDynamicSections(aggregates, resByDate);
        if (sections) setDynamicSections(sections);
      } catch (err) {
        console.warn("Reports: failed to load QI data, using defaults", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const effectiveSections = dynamicSections || SECTION_TEMPLATES;
  const section = effectiveSections.find(s => s.id === activeId) || effectiveSections[0];
  const hasData = !!dynamicSections && section.rows?.length > 0;

  // Latest date residents for raw data tab
  const latestDate = apiAggregates.length ? apiAggregates[apiAggregates.length - 1].assessmentDate : null;
  const latestLabel = apiAggregates.length ? apiAggregates[apiAggregates.length - 1].quarterLabel : null;
  const latestResidents = latestDate ? (residentsByDate[latestDate] || []) : [];
  const rawCols = section.rawCols || [];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto gap-6 w-full">
        {/* Sidebar */}
        <aside className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 overflow-y-auto w-56 md:w-60 lg:w-64 max-h-[85vh] shrink-0">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">All 14 indicators</h2>
          <ul className="space-y-0.5">
            {SIDEBAR_ITEMS.map(item => (
              <li
                key={item.id}
                onClick={() => { setActiveId(item.id); setShowRaw(false); }}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition ${
                  activeId === item.id ? "bg-primary text-white shadow-sm" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: activeId === item.id ? "currentColor" : item.dot }} />
                <span className="flex-1 min-w-0 truncate">{item.label}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow p-8 border border-gray-200">

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900"><strong>{section.title}</strong></h1>
              <p className="text-sm text-gray-500 mt-1">{section.subtitle}</p>
            </div>
            {hasData && section.badge && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badgeCls(section.badge)}`}>{section.badgeLabel}</span>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 mb-6 leading-relaxed border-l-4 border-primary/30 pl-4 bg-primary-light/40 py-3 pr-3 rounded-r-lg">{section.description}</p>

          {/* Alert callout (meds only) */}
          {section.alert && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 mb-6">
              <span className="text-red-500 shrink-0 mt-0.5">!</span>
              <span>{section.alert}</span>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="text-center py-12 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
              <p className="text-sm">Loading QI data...</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !hasData && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-2">No QI data available for this indicator.</p>
              <p className="text-sm text-gray-400">Upload a CSV with QI assessment data to populate reports.</p>
            </div>
          )}

          {/* Data view */}
          {!loading && hasData && (
            <>
              {/* Tab toggle */}
              <div className="flex items-center gap-2 mb-5">
                <button
                  type="button"
                  onClick={() => setShowRaw(false)}
                  className={`text-sm font-medium px-4 py-1.5 rounded-full border transition ${!showRaw ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"}`}
                >
                  Aggregated data
                </button>
                <button
                  type="button"
                  onClick={() => setShowRaw(true)}
                  className={`text-sm font-medium px-4 py-1.5 rounded-full border transition ${showRaw ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"}`}
                >
                  Resident-level data
                </button>
              </div>

              {!showRaw && (
                <>
                  {/* Aggregated table */}
                  <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm mb-6">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {section.columns.map(col => (
                            <th key={col} className={`px-4 py-3 font-semibold whitespace-nowrap ${(section.highlight || []).includes(col) ? "text-gray-900" : "text-gray-500"}`}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row, ri) => (
                          <tr key={ri} className={`border-b border-gray-100 ${ri % 2 === 0 ? "bg-white" : "bg-gray-50/60"} hover:bg-primary-light/30 transition`}>
                            {row.map((cell, ci) => (
                              <td key={ci} className={`px-4 py-3 ${ci === 0 ? "font-semibold text-gray-800" : valueCls(section.columns[ci], cell, section.highlight || [])}`}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary notes */}
                  {section.notes && (
                    <div className="flex items-start gap-2.5 p-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5 text-gray-400">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{section.notes}</span>
                    </div>
                  )}

                  {/* Quarter-over-quarter change strip */}
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {section.rows.map((row, ri) => {
                      const dateLabel = row[0];
                      const highlightIdx = section.columns.findIndex(c => (section.highlight || []).includes(c) && c !== "Assessment date");
                      const val = highlightIdx >= 0 ? row[highlightIdx] : "—";
                      const prev = ri > 0 ? section.rows[ri - 1][highlightIdx > 0 ? highlightIdx : 1] : null;
                      const isFirst = ri === 0;
                      return (
                        <div key={ri} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="text-xs font-medium text-gray-500 mb-1">{dateLabel}</div>
                          <div className="text-xl font-semibold text-gray-900">{val}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {isFirst ? "Baseline" : prev ? `vs ${prev}` : "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {showRaw && (
                <div>
                  {latestResidents.length > 0 ? (
                    <>
                      <p className="text-sm text-gray-500 mb-4">
                        Showing {Math.min(latestResidents.length, 20)} of {latestResidents.length} resident records from <strong>{latestLabel} ({latestDate})</strong>.
                      </p>
                      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-3 py-2.5 font-semibold text-gray-700">Resident_ID</th>
                              <th className="px-3 py-2.5 font-semibold text-gray-700">Assessment_Date</th>
                              {rawCols.map(col => (
                                <th key={col} className="px-3 py-2.5 font-semibold text-gray-700 whitespace-nowrap">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {latestResidents.slice(0, 20).map((r, i) => (
                              <tr key={r.resident_id} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}>
                                <td className="px-3 py-2 font-medium text-gray-800">{r.resident_id}</td>
                                <td className="px-3 py-2 text-gray-600">{r.assessment_date}</td>
                                {rawCols.map(col => (
                                  <td key={col} className="px-3 py-2 text-gray-600">{r[col] ?? "—"}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {latestResidents.length > 20 && (
                        <p className="text-xs text-gray-400 mt-3">Showing first 20 of {latestResidents.length} residents.</p>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">No resident-level data available.</p>
                      <p className="text-xs text-gray-400 mt-1">Upload a CSV to populate resident-level records.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
