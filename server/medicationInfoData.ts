import type { InsertMedicationInfo } from "@shared/schema";

export const MEDICATION_INFO_SEED: InsertMedicationInfo[] = [
  {
    id: "gonal_f",
    name: "Gonal-F",
    generic: "Follitropin alfa",
    class: "Recombinant FSH",
    purpose: "Stimulate follicle growth",
    route: "Subcutaneous injection (pen)",
    timing: "Daily doses (e.g., 75–300 IU) from stimulation start; individualised",
    commonSideEffects: [
      "Bloating",
      "Breast tenderness",
      "Injection site bruising",
      "Mood changes"
    ],
    seriousSideEffects: [
      "OHSS (abdominal pain, rapid weight gain, breathlessness)",
      "Allergic reaction"
    ],
    monitoringNotes: "Regular transvaginal ultrasounds and estradiol blood tests to titrate dose",
    patientNotes: "Rotate injection sites; follow clinic dosage instructions precisely",
    reference: "TGA product info / clinic leaflets",
    videoLink: "https://www.youtube.com/watch?v=example-gonal-f"
  },
  {
    id: "puregon",
    name: "Puregon",
    generic: "Follitropin beta",
    class: "Recombinant FSH",
    purpose: "Stimulate follicles",
    route: "Subcutaneous injection",
    timing: "Similar to Gonal-F; dose per clinic protocol",
    commonSideEffects: [
      "Bloating",
      "Injection site reactions",
      "Mood changes"
    ],
    seriousSideEffects: [
      "OHSS risk"
    ],
    monitoringNotes: "Regular scans & estradiol",
    patientNotes: "Pre-fill pens or cartridges; keep refrigerated",
    reference: "TGA / clinic materials",
    videoLink: "https://www.youtube.com/watch?v=example-puregon"
  },
  {
    id: "menopur",
    name: "Menopur",
    generic: "Human Menopausal Gonadotropin (hMG)",
    class: "hMG (FSH + LH activity)",
    purpose: "Stimulation in some protocols",
    route: "Subcutaneous injection",
    timing: "Dosing variable; clinic-specific",
    commonSideEffects: [
      "Injection site pain",
      "Bloating",
      "Headache"
    ],
    seriousSideEffects: [
      "OHSS",
      "Rare thromboembolic events in extreme OHSS"
    ],
    monitoringNotes: "Monitor via scans & E2; hMG may be chosen in certain responders",
    patientNotes: "Follow mixing instructions if using vial",
    reference: "TGA / clinic guidance",
    videoLink: "https://www.youtube.com/watch?v=example-menopur"
  },
  {
    id: "orgalutran",
    name: "Orgalutran",
    generic: "Ganirelix",
    class: "GnRH antagonist",
    purpose: "Prevent premature LH surge",
    route: "Subcutaneous injection",
    timing: "Often started ~Day 5–6 of stimulation until trigger",
    commonSideEffects: [
      "Injection site irritation",
      "Headache",
      "Nausea"
    ],
    seriousSideEffects: [
      "Allergic reaction (rare)"
    ],
    monitoringNotes: "Clinic monitors LH/E2 and follicle size; antagonist used to time ovulation prevention",
    patientNotes: "Administer at same time daily",
    reference: "TGA / clinic leaflet",
    videoLink: "https://www.youtube.com/watch?v=example-orgalutran"
  },
  {
    id: "cetrotide",
    name: "Cetrotide",
    generic: "Cetrorelix",
    class: "GnRH antagonist",
    purpose: "Prevent premature ovulation",
    route: "Subcutaneous injection",
    timing: "As per antagonist protocols (day 5–6 onward)",
    commonSideEffects: [
      "Injection site reactions",
      "Nausea"
    ],
    seriousSideEffects: [
      "Rare allergic reactions"
    ],
    monitoringNotes: "Monitoring as above",
    patientNotes: "Follow clinic instructions",
    reference: "TGA/clinic resources",
    videoLink: "https://www.youtube.com/watch?v=example-cetrotide"
  },
  {
    id: "lucrin",
    name: "Lucrin",
    generic: "Leuprorelin or Triptorelin",
    class: "GnRH agonist",
    purpose: "Long-protocol downregulation or trigger alternative",
    route: "Subcutaneous or IM injection",
    timing: "Used for downregulation (weeks) or as agonist trigger in some cycles",
    commonSideEffects: [
      "Menopausal-type symptoms (hot flushes)",
      "Injection site pain"
    ],
    seriousSideEffects: [
      "Rare severe adverse effects"
    ],
    monitoringNotes: "Monitoring depends on use (downregulation vs trigger)",
    patientNotes: "If used long-term, expect initial flare then suppression",
    reference: "Clinic protocol / TGA",
    videoLink: ""
  },
  {
    id: "ovidrel",
    name: "Ovidrel",
    generic: "Choriogonadotropin alfa (recombinant hCG)",
    class: "hCG (trigger)",
    purpose: "Final oocyte maturation (trigger)",
    route: "Subcutaneous injection",
    timing: "Single dose ~36 hours before retrieval (timing critical)",
    commonSideEffects: [
      "Nausea",
      "Breast tenderness",
      "Injection site discomfort"
    ],
    seriousSideEffects: [
      "OHSS (esp. if many follicles)"
    ],
    monitoringNotes: "Very strict timing; clinic gives exact time",
    patientNotes: "Set multiple alarms; confirm time with clinic",
    reference: "TGA / clinic protocols",
    videoLink: "https://www.youtube.com/watch?v=example-ovidrel"
  },
  {
    id: "pregnyl",
    name: "Pregnyl",
    generic: "hCG (urinary hCG)",
    class: "hCG",
    purpose: "Same as above",
    route: "IM or SC injection",
    timing: "~36 hours before retrieval",
    commonSideEffects: [
      "Similar to Ovidrel"
    ],
    seriousSideEffects: [
      "OHSS risk"
    ],
    monitoringNotes: "Timing per clinic",
    patientNotes: "Follow clinic instruction for route",
    reference: "TGA product info",
    videoLink: ""
  },
  {
    id: "lucrin_trigger",
    name: "Lucrin",
    generic: "GnRH-agonist trigger (e.g., Triptorelin)",
    class: "GnRH-agonist (trigger)",
    purpose: "Trigger final maturation in antagonist cycles to reduce OHSS risk",
    route: "Subcutaneous injection",
    timing: "Single dose per clinic timing",
    commonSideEffects: [
      "Local injection reactions",
      "Temporary discomfort"
    ],
    seriousSideEffects: [
      "Can cause luteal phase insufficiency — requires modified luteal support"
    ],
    monitoringNotes: "Clinic will advise luteal support adjustments",
    patientNotes: "May be used if OHSS risk high",
    reference: "Clinic protocols",
    videoLink: ""
  },
  {
    id: "crinone",
    name: "Crinone",
    generic: "Vaginal progesterone gel",
    class: "Progesterone (vaginal)",
    purpose: "Luteal support after retrieval/transfer",
    route: "Vaginal gel/pessary",
    timing: "Often started day of retrieval or day of transfer and continued until pregnancy test/clinic direction",
    commonSideEffects: [
      "Vaginal irritation",
      "Discharge",
      "Drowsiness"
    ],
    seriousSideEffects: [
      "Rare allergic reaction"
    ],
    monitoringNotes: "Clinic advises duration based on protocol",
    patientNotes: "Use as directed; avoid intercourse/insert until advised",
    reference: "TGA / product leaflet",
    videoLink: "https://www.youtube.com/watch?v=example-crinone"
  },
  {
    id: "utrogestan",
    name: "Utrogestan",
    generic: "Micronised progesterone",
    class: "Progesterone (oral or vaginal)",
    purpose: "Luteal support",
    route: "Oral capsules or vaginal pessary",
    timing: "Start per clinic instruction",
    commonSideEffects: [
      "Drowsiness",
      "Dizziness",
      "Breast tenderness"
    ],
    seriousSideEffects: [
      "Rare allergic reactions"
    ],
    monitoringNotes: "Monitor symptoms; confirm dosing schedule with clinic",
    patientNotes: "If drowsy, avoid driving after oral dose",
    reference: "Product leaflet / clinic guidance",
    videoLink: ""
  },
  {
    id: "progesterone_im",
    name: "Progesterone IM injection",
    generic: "Various formulations",
    class: "Progesterone (IM)",
    purpose: "Luteal support (clinic-administered in some centres)",
    route: "Intramuscular injection (oil)",
    timing: "Per clinic schedule",
    commonSideEffects: [
      "Injection site pain",
      "Muscle soreness"
    ],
    seriousSideEffects: [
      "Injection site abscess (rare)"
    ],
    monitoringNotes: "Clinic-administered injections; monitor for local reaction",
    patientNotes: "IM injections are painful — arrange help",
    reference: "Clinic protocol",
    videoLink: ""
  }
];


