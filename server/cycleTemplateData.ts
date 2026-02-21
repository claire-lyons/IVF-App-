import type { InsertCycleStageTemplate } from "@shared/schema";

export interface CycleTemplateMeta {
  key: string;
  name: string;
  description: string;
  duration: number;
}

export const CYCLE_TEMPLATE_META: Record<string, CycleTemplateMeta> = {
  ivf_fresh: {
    key: "ivf_fresh",
    name: "IVF Cycle",
    description: "Stimulated IVF cycle with fresh embryo transfer",
    duration: 35,
  },
  ivf_frozen: {
    key: "ivf_frozen",
    name: "Frozen Embryo Transfer",
    description: "Transfer of previously frozen embryo aligned with ovulation",
    duration: 28,
  },
  fet: {
    key: "fet",
    name: "Frozen Embryo Transfer",
    description: "Transfer of previously frozen embryo aligned with ovulation",
    duration: 28,
  },
  egg_freezing: {
    key: "egg_freezing",
    name: "Egg Freezing",
    description: "Oocyte cryopreservation preparation and retrieval",
    duration: 21,
  },
  iui: {
    key: "iui",
    name: "Intrauterine Insemination",
    description: "Stimulated or natural cycle leading to insemination",
    duration: 28,
  },
};

export interface CycleStageTemplateSeed extends InsertCycleStageTemplate {
  dayEnd?: number | null;
}

const IVF_FRESH_TEMPLATE: CycleStageTemplateSeed[] = [
  {
    cycleType: "ivf_fresh",
    stage: "Cycle day 1",
    dayLabel: "Day 1",
    dayStart: 1,
    dayEnd: 1,
    medicalDetails:
      "Progesterone and estrogen levels drop, triggering the uterine lining to shed. By around day 5, FSH and estrogen begin to rise, promoting follicle growth in the ovaries and rebuilding the endometrium",
    monitoringProcedures: "Day 1 period marks the start of a new cycle.",
    patientInsights: "During early follicular days 1-5, low hormones often bring fatigue, cramps, bloating, and low or irritable moods, though energy may start lifting by day 5 as estrogen rises.",
  },
  {
    cycleType: "ivf_fresh",
    stage: "Baseline blood test",
    dayLabel: "Day 2",
    dayStart: 2,
    dayEnd: 2,
    medicalDetails:
      "Baseline IVF blood test measures FSH, estradiol, LH, and progesterone to confirm cycle start before launching stimulation injections.",
    monitoringProcedures: "Blood test to check baseline hormones to prepare for stims.",
    patientInsights:
      "You may feel typical early period symptoms like cramps or fatigue, plus brief arm soreness from the blood draw, with no major shifts yet.",
  },
  {
    cycleType: "ivf_fresh",
    stage: "Stimulation injections start",
    dayLabel: "Day 3",
    dayStart: 3,
    dayEnd: 3,
    medicalDetails:
      "Daily FSH/LH injections work to recruit multiple ovarian follicles to grow mature eggs for IVF retrieval.",
    monitoringProcedures: "Start stimulation medication",
    patientInsights:
      "You may feel bloating, mild ovarian tenderness, or fatigue as follicles enlarge, with energy still low from early cycle but mood lifting soon.",
  },
  {
    cycleType: "ivf_fresh",
    stage: "Monitoring blood test",
    dayLabel: "Day 6",
    dayStart: 6,
    dayEnd: 6,
    medicalDetails:
      "Multiple follicles grow under FSH stimulation, ovaries enlarge slightly, and estrogen surges to prepare eggs and thicken the uterine lining",
    monitoringProcedures: "Blood test checks hormone levels to track stim medication and rising estradiol and LH.",
    patientInsights:
      "You may feel increasing bloating, ovarian fullness or tenderness, mood swings from high estrogen, and fatigue, with possible headaches or breast sensitivity.",
  },
  {
    cycleType: "ivf_fresh",
    stage: "Monitoring ultrasound",
    dayLabel: "Day 6",
    dayStart: 6,
    dayEnd: 6,
    medicalDetails:
      "Follicles grow under FSH meds, ovaries enlarge slightly, and rising estrogen prepares multiple eggs while thickening the uterine lining",
    monitoringProcedures: "A transvaginal probe is used to measure follicle sizes, count developing eggs, and check endometrial thickness for optimal timing.",
    patientInsights:
      "You may feel increasing bloating, ovarian fullness or tenderness, mood swings from high estrogen, and fatigue, with possible headaches or breast sensitivity.",
  },
  {
    cycleType: "ivf_fresh",
    stage: "Antagonist injections start",
    dayLabel: "Day 7",
    dayStart: 7,
    dayEnd: 7,
    medicalDetails:
      "Follicles continue growing under FSH stimulation while the antagonist suppresses LH to prevent premature ovulation.",
    monitoringProcedures: "Antagonist injections are introduced to block premature LH surges, preventing early ovulation while follicles continue maturing.",
    patientInsights:
      "You may notice slightly more bloating or injection site reactions alongside ongoing ovarian fullness and rising estrogen effects like mood swings or breast tenderness.",
  },
  {
    cycleType: "ivf_fresh",
    stage: "Trigger injection",
    dayLabel: "Day 11",
    dayStart: 11,
    dayEnd: 11,
    medicalDetails:
      "Trigger shot mimics the natural LH surge, prompting the ovaries to finalise egg maturation and detach the egg from the follicle wall about 36 hours later.",
    monitoringProcedures: "Trigger injection ensures ovulation occurs at the right time.",
    patientInsights:
      "You may notice slightly more bloating or injection site reactions alongside ongoing ovarian fullness and rising estrogen effects like mood swings or breast tenderness.",
  },
  {
    cycleType: "ivf_fresh",
    stage: "Egg retrieval",
    dayLabel: "Day 13",
    dayStart: 13,
    dayEnd: 13,
    medicalDetails:
      "Ovaries are at peak size with eggs collected for lab fertilization, while the body begins corpus luteum formation and rising progesterone.",
    monitoringProcedures: "Egg retrieval uses a needle guided by ultrasound to aspirate mature eggs from ovarian follicles under light sedation.",
    patientInsights:
      "You may feel groggy post-sedation, bloated or crampy from ovarian fullness, with possible spotting, nausea, or fatigue from OHSS risk",
  },
  {
    cycleType: "ivf_fresh",
    stage: "Embryo transfer",
    dayLabel: "Day 19",
    dayStart: 19,
    dayEnd: 19,
    medicalDetails:
      "Once implanted the embryo will attempt to burrow or attach to the lining. If attached, hCG will start to rise from day 9-10 post transfer.",
    monitoringProcedures: "Embryo is placed into your uterus.",
    patientInsights:
      "You may feel bloated, crampy, or fatigued from meds and the procedure, with possible light spotting, breast tenderness, or mild anxiety,",
  },
  {
    cycleType: "ivf_fresh",
    stage: "Embryos frozen",
    dayLabel: "Day 20",
    dayStart: 20,
    dayEnd: 20,
    medicalDetails:
      "In the lab, quality embryos are selected, water removed from cells, and they're rapidly cooled for long-term storage while your body recovers post-retrieval with dropping estrogen.",
    monitoringProcedures: "Embryos are frozen using vitrification (flash-freezing with cryoprotectants) preserving them for future transfer.",
    patientInsights: "You may still feel bloated, crampy, or fatigued from meds and the procedure.",
  },
  {
    cycleType: "ivf_fresh",
    stage: "Pregnancy blood test",
    dayLabel: "Day 28",
    dayStart: 28,
    dayEnd: 28,
    medicalDetails: "If attached, hCG will start to rise from day 9-10, signaling the body to sustain the pregnancy.",
    monitoringProcedures: "Checks hCG levels to see if the embryo implanted successfully.",
    patientInsights:
      "You may feel bloated, crampy, or fatigued from meds and the procedure, with possible light spotting, breast tenderness, or mild anxiety,",
  },
];

const IVF_FROZEN_TEMPLATE: CycleStageTemplateSeed[] = [
  {
    cycleType: "ivf_frozen",
    stage: "Cycle day 1",
    dayLabel: "Day 1",
    dayStart: 1,
    dayEnd: 1,
    medicalDetails:
      "Progesterone and estrogen levels drop, triggering the uterine lining to shed. By around day 5, FSH and estrogen begin to rise, promoting follicle growth in the ovaries and rebuilding the endometrium",
    monitoringProcedures: "Day 1 period marks the start of a new cycle.",
    patientInsights:
      "During early follicular days 1-5, low hormones often bring fatigue, cramps, bloating, and low or irritable moods, though energy may start lifting by day 5 as estrogen rises.",
  },
  {
    cycleType: "ivf_frozen",
    stage: "Monitoring blood test",
    dayLabel: "Day 8",
    dayStart: 8,
    dayEnd: 8,
    medicalDetails: "Estrogen starts to surge as the dominant follicle matures and prepares to release an egg.",
    monitoringProcedures: "Blood test checks hormone levels.",
    patientInsights:
      "You may feel energized and optimistic, with libido often at its highest, clearer skin, and peak stamina, though some notice ovulation twinges or mild bloating.",
  },
  {
    cycleType: "ivf_frozen",
    stage: "Monitoring ultrasound",
    dayLabel: "Day 10",
    dayStart: 10,
    dayEnd: 10,
    medicalDetails: "Estrogen starts to surge as the dominant follicle matures and prepares to release an egg.",
    monitoringProcedures: "Ultrasound checks lining and follicle growth.",
    patientInsights:
      "You may feel energized and optimistic, with libido often at its highest, clearer skin, and peak stamina, though some notice ovulation twinges or mild bloating.",
  },
  {
    cycleType: "ivf_frozen",
    stage: "Ovulation detected",
    dayLabel: "Day 14",
    dayStart: 14,
    dayEnd: 14,
    medicalDetails:
      "Your egg is releasing (or ready with trigger) as the mature follicle ruptures, while LH surges and progesterone begins rising to support the new corpus luteum.",
    monitoringProcedures: "Ovulation is detected and egg is released or triggered.",
    patientInsights:
      "You may feel a mild one-sided twinges from the follicle release or some brief spotting or bloating.",
  },
  {
    cycleType: "ivf_frozen",
    stage: "Medication starts",
    dayLabel: "Day 14",
    dayStart: 14,
    dayEnd: 14,
    medicalDetails:
      "Progesterone support starts as the corpus luteum forms post-ovulation (or trigger), supplementing natural progesterone to maintain and thicken the endometrium for potential implantation",
    monitoringProcedures: "Progesterone supports the uterine lining.",
    patientInsights:
      "You may feel calmer or more fatigued with possible bloating, breast tenderness, or mild mood shifts from rising progesterone,",
  },
  {
    cycleType: "ivf_frozen",
    stage: "Embryo transfer",
    dayLabel: "Day 19",
    dayStart: 19,
    dayEnd: 19,
    medicalDetails:
      "Once implanted the embryo will attempt to burrow or attach to the lining. If attached, hCG will start to rise from day 9-10 post transfer.",
    monitoringProcedures: "Thawed embryo is placed into your uterus.",
    patientInsights:
      "You may feel bloated, crampy, or fatigued from meds and the procedure, with possible light spotting, breast tenderness, or mild anxiety,",
  },
  {
    cycleType: "ivf_frozen",
    stage: "Pregnancy blood test",
    dayLabel: "Day 29",
    dayStart: 29,
    dayEnd: 29,
    medicalDetails: "If attached, hCG will start to rise from day 9-10, signaling the body to sustain the pregnancy.",
    monitoringProcedures: "Checks hCG levels to see if the embryo implanted successfully.",
    patientInsights:
      "You may feel bloated, crampy, or fatigued from meds and the procedure, with possible light spotting, breast tenderness, or mild anxiety,",
  },
];

export const CYCLE_STAGE_TEMPLATE_SEED: CycleStageTemplateSeed[] = [
  ...IVF_FRESH_TEMPLATE,
  ...IVF_FROZEN_TEMPLATE,

  // Egg Freezing - Updated from CSV
  {
    cycleType: "egg_freezing",
    stage: "Cycle day 1",
    dayLabel: "Day 1",
    dayStart: 1,
    dayEnd: 1,
    medicalDetails:
      "Progesterone and estrogen levels drop, triggering the uterine lining to shed. By around day 5, FSH and estrogen begin to rise, promoting follicle growth in the ovaries and rebuilding the endometrium",
    monitoringProcedures: "Day 1 period marks the start of a new cycle.",
    patientInsights:
      "During early follicular days 1-5, low hormones often bring fatigue, cramps, bloating, and low or irritable moods, though energy may start lifting by day 5 as estrogen rises.",
  },
  {
    cycleType: "egg_freezing",
    stage: "Baseline blood test",
    dayLabel: "Day 2",
    dayStart: 2,
    dayEnd: 2,
    medicalDetails:
      "Baseline IVF blood test measures FSH, estradiol, LH, and progesterone to confirm cycle start before launching stimulation injections.",
    monitoringProcedures: "Blood test to check baseline hormones to prepare for stims.",
    patientInsights:
      "You may feel typical early period symptoms like cramps or fatigue, plus brief arm soreness from the blood draw, with no major shifts yet.",
  },
  {
    cycleType: "egg_freezing",
    stage: "Stimulation injections start",
    dayLabel: "Day 2",
    dayStart: 2,
    dayEnd: 2,
    medicalDetails:
      "Daily FSH/LH injections work to recruit multiple ovarian follicles to grow mature eggs for IVF retrieval.",
    monitoringProcedures: "Start stimulation medication",
    patientInsights:
      "You may feel bloating, mild ovarian tenderness, or fatigue as follicles enlarge, with energy still low from early cycle but mood lifting soon.",
  },
  {
    cycleType: "egg_freezing",
    stage: "Monitoring blood test",
    dayLabel: "Day 6",
    dayStart: 6,
    dayEnd: 6,
    medicalDetails: "Estrogen starts to surge as the dominant follicle matures and prepares to release an egg.",
    monitoringProcedures: "Blood test checks hormone levels.",
    patientInsights:
      "You may feel energized and optimistic, with libido often at its highest, clearer skin, and peak stamina, though some notice ovulation twinges or mild bloating.",
  },
  {
    cycleType: "egg_freezing",
    stage: "Monitoring ultrasound",
    dayLabel: "Day 6",
    dayStart: 6,
    dayEnd: 6,
    medicalDetails:
      "Follicles grow under FSH meds, ovaries enlarge slightly, and rising estrogen prepares multiple eggs while thickening the uterine lining",
    monitoringProcedures:
      "A transvaginal probe is used to measure follicle sizes, count developing eggs, and check endometrial thickness for optimal timing.",
    patientInsights:
      "You may feel increasing bloating, ovarian fullness or tenderness, mood swings from high estrogen, and fatigue, with possible headaches or breast sensitivity.",
  },
  {
    cycleType: "egg_freezing",
    stage: "Antagonist injections start",
    dayLabel: "Day 7",
    dayStart: 7,
    dayEnd: 7,
    medicalDetails:
      "Follicles continue growing under FSH stimulation while the antagonist suppresses LH to prevent premature ovulation.",
    monitoringProcedures:
      "Antagonist injections are introduced to block premature LH surges, preventing early ovulation while follicles continue maturing.",
    patientInsights:
      "You may notice slightly more bloating or injection site reactions alongside ongoing ovarian fullness and rising estrogen effects like mood swings or breast tenderness.",
  },
  {
    cycleType: "egg_freezing",
    stage: "Trigger injection",
    dayLabel: "Day 11",
    dayStart: 11,
    dayEnd: 11,
    medicalDetails:
      "Trigger shot mimics the natural LH surge, prompting the ovaries to finalise egg maturation and detach the egg from the follicle wall about 36 hours later.",
    monitoringProcedures: "Trigger injection ensures ovulation occurs at the right time.",
    patientInsights:
      "You may feel a mild one-sided twinges from the follicle release or some brief spotting or bloating.",
  },
  {
    cycleType: "egg_freezing",
    stage: "Egg retrieval",
    dayLabel: "Day 13",
    dayStart: 13,
    dayEnd: 13,
    medicalDetails:
      "Ovaries are at peak size with eggs collected for lab fertilization, while the body begins corpus luteum formation and rising progesterone.",
    monitoringProcedures:
      "Egg retrieval uses a needle guided by ultrasound to aspirate mature eggs from ovarian follicles under light sedation.",
    patientInsights:
      "You may feel groggy post-sedation, bloated or crampy from ovarian fullness, with possible spotting, nausea, or fatigue from OHSS risk",
  },
  {
    cycleType: "egg_freezing",
    stage: "Eggs frozen",
    dayLabel: "Day 13",
    dayStart: 13,
    dayEnd: 13,
    medicalDetails:
      "In the lab, quality eggs are selected, water removed from cells, and they're rapidly cooled for long-term storage while your body recovers post-retrieval with dropping estrogen.",
    monitoringProcedures:
      "Eggs are safely frozen using vitrification (flash-freezing with cryoprotectants) preserving them for future use.",
    patientInsights: "You may still feel bloated, crampy, or fatigued from meds and the procedure.",
  },

  // IUI Cycle - Updated from CSV
  {
    cycleType: "iui",
    stage: "Cycle day 1",
    dayLabel: "Day 1",
    dayStart: 1,
    dayEnd: 1,
    medicalDetails:
      "Progesterone and estrogen levels drop, triggering the uterine lining to shed. By around day 5, FSH and estrogen begin to rise, promoting follicle growth in the ovaries and rebuilding the endometrium",
    monitoringProcedures: "Day 1 period marks the start of a new cycle.",
    patientInsights: "During early follicular days 1-5, low hormones often bring fatigue, cramps, bloating, and low or irritable moods, though energy may start lifting by day 5 as estrogen rises.",
  },
  {
    cycleType: "iui",
    stage: "Baseline blood test",
    dayLabel: "Day 2",
    dayStart: 2,
    dayEnd: 2,
    medicalDetails: "Baseline blood test on day 2-3 checks FSH, estradiol, LH and progesterone.",
    monitoringProcedures: "Blood checks hormone levels for timed insemination.",
    patientInsights: "You may feel typical early period symptoms like cramps or fatigue, plus mild ultrasound discomfort, with no major changes yet from the pending meds.",
  },
  {
    cycleType: "iui",
    stage: "Monitoring blood test",
    dayLabel: "Day 7",
    dayStart: 7,
    dayEnd: 7,
    medicalDetails: "Estrogen starts to surge as the dominant follicle matures and prepares to release an egg.",
    monitoringProcedures: "Blood test checks hormone levels.",
    patientInsights:
      "You may feel energized and optimistic, with libido often at its highest, clearer skin, and peak stamina, though some notice ovulation twinges or mild bloating.",
  },
  {
    cycleType: "iui",
    stage: "Monitoring ultrasound",
    dayLabel: "Day 7",
    dayStart: 7,
    dayEnd: 7,
    medicalDetails: "Estrogen starts to surge as the dominant follicle matures and prepares to release an egg.",
    monitoringProcedures: "Ultrasound checks lining and follicle growth.",
    patientInsights:
      "You may feel energized and optimistic, with libido often at its highest, clearer skin, and peak stamina, though some notice ovulation twinges or mild bloating.",
  },
  {
    cycleType: "iui",
    stage: "Trigger injection",
    dayLabel: "Day 11",
    dayStart: 11,
    dayEnd: 11,
    medicalDetails:
      "Trigger shot mimics the natural LH surge, prompting the ovaries to finalise egg maturation and detach the egg from the follicle wall about 36 hours later.",
    monitoringProcedures: "Trigger injection ensures ovulation occurs at the right time.",
    patientInsights: "You may feel a mild one-sided twinges from the follicle release or some brief spotting or bloating.",
  },
  {
    cycleType: "iui",
    stage: "Insemination (IUI)",
    dayLabel: "Day 13",
    dayStart: 13,
    dayEnd: 13,
    medicalDetails:
      "Prepared sperm directly into the uterus around ovulation, giving them a head start to reach and fertilize the egg in the fallopian tube",
    monitoringProcedures: "Prepared sperm is placed into uterus to meet egg.",
    patientInsights: "You may feel mild cramping or spotting from the catheter, some notice bloating or procedure-related tenderness.",
  },
  {
    cycleType: "iui",
    stage: "Medication starts",
    dayLabel: "Day 14",
    dayStart: 14,
    dayEnd: 14,
    medicalDetails:
      "Progesterone support starts as the corpus luteum forms post-ovulation (or trigger), supplementing natural progesterone to maintain and thicken the endometrium for potential implantation",
    monitoringProcedures: "Progesterone supports the uterine lining.",
    patientInsights:
      "You may feel calmer or more fatigued with possible bloating, breast tenderness, or mild mood shifts from rising progesterone,",
  },
  {
    cycleType: "iui",
    stage: "Pregnancy blood test",
    dayLabel: "Day 27",
    dayStart: 27,
    dayEnd: 27,
    medicalDetails: "If attached, hCG will start to rise from day 9-10, signaling the body to sustain the pregnancy.",
    monitoringProcedures: "Checks hCG levels to see if the embryo implanted successfully.",
    patientInsights:
      "You may feel bloated, crampy, or fatigued from meds and the procedure, with possible light spotting, breast tenderness, or mild anxiety,",
  },

  // Donor Conception Milestones (overlay for any cycle type)
  {
    cycleType: "donor_conception",
    stage: "Counselling Session",
    dayLabel: "Pre-cycle",
    dayStart: -30,
    dayEnd: -14,
    medicalDetails: "Mandatory counselling session covers legal, emotional, and practical aspects of donor conception.",
    monitoringProcedures: "Clinic arranges session with qualified counsellor; both partners typically attend.",
    patientInsights: "Important time to discuss expectations, legal rights, and emotional preparation for donor conception journey.",
  },
  {
    cycleType: "donor_conception",
    stage: "Donor Screening & Legal Checks",
    dayLabel: "Pre-cycle",
    dayStart: -21,
    dayEnd: -7,
    medicalDetails: "Donor undergoes medical screening, genetic testing, and legal consent documentation.",
    monitoringProcedures: "Clinic coordinates screening timeline and ensures all legal requirements are met before cycle start.",
    patientInsights: "Waiting period can feel long but ensures donor safety and legal compliance. Stay in touch with clinic for updates.",
  },
  {
    cycleType: "donor_conception",
    stage: "Waiting Period",
    dayLabel: "Pre-cycle",
    dayStart: -14,
    dayEnd: -1,
    medicalDetails: "Mandatory waiting period between counselling and cycle start (typically 2–4 weeks) for reflection and preparation.",
    monitoringProcedures: "Clinic confirms cycle start date once waiting period and all checks are complete.",
    patientInsights: "Use this time to prepare emotionally, organise support, and ask any remaining questions before treatment begins.",
  },
];

