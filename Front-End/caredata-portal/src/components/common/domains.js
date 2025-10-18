// Centralized domain information for reuse across the system

// --- Short domain titles (for Sidebar, MyDataPage) ---
export const DOMAINS = [
  "Domain 1: Pressure Injuries",
  "Domain 2: Restrictive Practices",
  "Domain 3: Unplanned Weight Loss - Significant",
  "Domain 4: Unplanned Weight Loss - Consecutive",
  "Domain 5: Falls and Major Injury",
  "Domain 6: Medication - Polypharmacy",
  "Domain 7: Medication - Antipsychotics",
  "Domain 8: Activities of Daily Living (ADLs)",
  "Domain 9: Incontinence Care (IAD)",
  "Domain 10: Hospitalisation",
  "Domain 11: Workforce",
  "Domain 12: Consumer Experience (QCE-ACC)",
  "Domain 13: Quality of Life (QOL-ACC)",
  "Domain 14: Allied Health Interventions",
];

// --- Extended details (used by QuestionnaireForm) ---
export const DOMAIN_DETAILS = [
  {
    id: 1,
    title: DOMAINS[0],
    description: "Assessment of pressure injury incidents and prevention measures",
    fields: [
      { label: "Number of residents with new or worsened pressure injuries", type: "number", required: true },
      { label: "Assessment period end date", type: "date", required: true },
      { label: "Total number of residents", type: "number", required: true },
      { label: "Describe current pressure injury prevention measures", type: "textarea", required: false },
    ],
  },
  {
    id: 2,
    title: DOMAINS[1],
    description: "Monitoring of restrictive practice usage and alternatives",
    fields: [
      { label: "Number of restrictive practice incidents", type: "number", required: true },
      { label: "Assessment period end date", type: "date", required: true },
      { label: "Number of physical restraint uses", type: "number", required: true },
      { label: "Number of chemical restraint uses", type: "number", required: true },
      { label: "Describe alternative strategies being used", type: "textarea", required: false },
    ],
  },
  {
    id: 3,
    title: DOMAINS[2],
    description: "Tracking significant unplanned weight loss (≥5% in 30 days or ≥10% in 180 days)",
    fields: [
      { label: "Number of residents with significant unplanned weight loss", type: "number", required: true },
      { label: "Assessment period end date", type: "date", required: true },
      { label: "Weight monitoring frequency (days)", type: "number", required: true },
      { label: "Describe nutritional interventions in place", type: "textarea", required: false },
    ],
  },
  {
    id: 4,
    title: DOMAINS[3],
    description: "Tracking consecutive unplanned weight loss over multiple periods",
    fields: [
      { label: "Number of residents with consecutive weight loss", type: "number", required: true },
      { label: "Assessment period end date", type: "date", required: true },
      { label: "Number of consecutive periods tracked", type: "number", required: true },
      { label: "Assessment of intervention effectiveness", type: "textarea", required: false },
    ],
  },
  {
    id: 5,
    title: DOMAINS[4],
    description: "Monitoring falls incidents and resulting major injuries",
    fields: [
      { label: "Total number of falls", type: "number", required: true },
      { label: "Number of falls resulting in major injury", type: "number", required: true },
      { label: "Assessment period end date", type: "date", required: true },
      { label: "Describe fall prevention program", type: "textarea", required: false },
    ],
  },
  {
    id: 6,
    title: DOMAINS[5],
    description: "Assessment of residents receiving multiple medications",
    fields: [
      { label: "Number of residents with polypharmacy (≥9 medications)", type: "number", required: true },
      { label: "Assessment period end date", type: "date", required: true },
      { label: "Medication review frequency (days)", type: "number", required: true },
      { label: "Describe deprescribing initiatives", type: "textarea", required: false },
    ],
  },
  {
    id: 7,
    title: DOMAINS[6],
    description: "Monitoring antipsychotic medication usage",
    fields: [
      { label: "Number of residents receiving antipsychotics", type: "number", required: true },
      { label: "Assessment period end date", type: "date", required: true },
      { label: "Number receiving behavioral interventions first", type: "number", required: true },
      { label: "Describe gradual dose reduction attempts", type: "textarea", required: false },
    ],
  },
  {
    id: 8,
    title: DOMAINS[7],
    description: "Assessment of ADL performance and support needs",
    fields: [
      { label: "Number of residents with ADL decline", type: "number", required: true },
      { label: "Assessment period end date", type: "date", required: true },
      { label: "Number receiving rehabilitation services", type: "number", required: true },
      { label: "Describe ADL support strategies", type: "textarea", required: false },
    ],
  },
  {
    id: 9,
    title: DOMAINS[8],
    description: "Management of incontinence-associated dermatitis",
    fields: [
      { label: "Number of residents with incontinence-associated dermatitis", type: "number", required: true },
      { label: "Assessment period end date", type: "date", required: true },
      { label: "Number in continence management program", type: "number", required: true },
      { label: "Describe skin care protocols", type: "textarea", required: false },
    ],
  },
  {
    id: 10,
    title: DOMAINS[9],
    description: "Tracking hospitalization rates and causes",
    fields: [
      { label: "Number of hospitalizations", type: "number", required: true },
      { label: "Assessment period end date", type: "date", required: true },
      { label: "Number of potentially preventable hospitalizations", type: "number", required: true },
      { label: "Describe hospitalization reduction strategies", type: "textarea", required: false },
    ],
  },
  {
    id: 11,
    title: DOMAINS[10],
    description: "Staff turnover and workforce stability measures",
    fields: [
      { label: "Staff turnover rate (%)", type: "number", required: true },
      { label: "Assessment period end date", type: "date", required: true },
      { label: "Number of staff retention initiatives", type: "number", required: true },
      { label: "Describe workforce development programs", type: "textarea", required: false },
    ],
  },
  {
    id: 12,
    title: DOMAINS[11],
    description: "Consumer experience assessment scores",
    fields: [
      { label: "Overall consumer satisfaction score (0-100)", type: "number", required: true },
      { label: "Assessment period end date", type: "date", required: true },
      { label: "Survey response rate (%)", type: "number", required: true },
      { label: "Describe actions taken based on consumer feedback", type: "textarea", required: false },
    ],
  },
  {
    id: 13,
    title: DOMAINS[12],
    description: "Quality of life assessment and measures",
    fields: [
      { label: "Overall quality of life score (0-100)", type: "number", required: true },
      { label: "Assessment period end date", type: "date", required: true },
      { label: "Number of lifestyle and wellness programs", type: "number", required: true },
      { label: "Describe quality of life improvement initiatives", type: "textarea", required: false },
    ],
  },
  {
    id: 14,
    title: DOMAINS[13],
    description: "Tracking allied health service usage and outcomes",
    fields: [
      { label: "Number of allied health interventions", type: "number", required: true },
      { label: "Assessment period end date", type: "date", required: true },
      { label: "Overall quality of allied health services", type: "number", required: true },
      { label: "Describe allied health impact", type: "textarea", required: false },
    ],
  },
];
