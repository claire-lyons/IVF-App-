// Utility functions for working with fertility cycle data

import stagesData from '@/data/stages.json';
import milestonesData from '@/data/milestones.json';

export interface Milestone {
  name: string;
  day: number;
  dayEnd?: number | null;
  dayLabel?: string;
  medicalDetails: string;
  monitoringProcedures?: string;
  patientInsights: string;
  tips: string[];
  summary?: string; // Milestone summary from Excel data
}

interface CycleType {
  name: string;
  description: string;
  duration: number;
  milestones: Milestone[];
}

interface CycleData {
  [key: string]: CycleType;
}

let cycleData: CycleData | null = null;

// Cycle type metadata for display and progress calculations
const cycleTypeMeta: Record<string, { long: string; short: string; duration: number }> = {
  ivf_fresh: { long: "IVF Cycle", short: "IVF cycle", duration: 28 },
  "ivf-fresh": { long: "IVF Cycle", short: "IVF cycle", duration: 28 },
  ivf_frozen: { long: "FET", short: "FET", duration: 21 },
  "ivf-frozen": { long: "FET", short: "FET", duration: 21 },
  fet: { long: "FET", short: "FET", duration: 21 },
  iui: { long: "IUI Cycle", short: "IUI cycle", duration: 14 },
  monitoring: { long: "Monitoring Cycle", short: "Monitoring cycle", duration: 14 },
  natural: { long: "Natural Cycle", short: "Natural cycle", duration: 28 },
  egg_freezing: { long: "Egg Freezing Cycle", short: "Egg freezing", duration: 21 },
  "egg-freezing": { long: "Egg Freezing Cycle", short: "Egg freezing", duration: 21 },
};

const MS_IN_DAY = 1000 * 60 * 60 * 24;

const normalizeCycleType = (cycleType?: string) =>
  cycleType?.toLowerCase().replace(/-/g, '_') ?? "";

// Load cycle data from API endpoint
async function loadCycleData(): Promise<CycleData> {
  try {
    const response = await fetch('/api/cycles/templates', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to fetch cycle data');
    }
    cycleData = await response.json();
    return cycleData!;
  } catch (error) {
    console.error('Error loading cycle data:', error);
    return {};
  }
}

// Define the expected order of milestones for each cycle type
const MILESTONE_ORDER: Record<string, string[]> = {
  'ivf': [
    'Cycle day 1',
    'Baseline blood test',
    'Stimulation injections start',
    'Monitoring blood test',
    'Monitoring ultrasound',
    'Antagonist injections start',
    'Trigger injection',
    'Egg retrieval',
    'Embryo transfer',
    'Embryos frozen',
    'Pregnancy blood test'
  ],
  'iui': [
    'Cycle day 1',
    'Baseline blood test',
    'Monitoring blood test',
    'Monitoring ultrasound',
    'Trigger injection',
    'Insemination (IUI)',
    'Medication starts',
    'Pregnancy blood test'
  ],
  'fet': [
    'Cycle day 1',
    'Monitoring blood test',
    'Monitoring ultrasound',
    'Ovulation detected',
    'Medication starts',
    'Embryo transfer',
    'Pregnancy blood test'
  ],
  'egg_freezing': [
    'Cycle day 1',
    'Baseline blood test',
    'Stimulation injections start',
    'Monitoring blood test',
    'Monitoring ultrasound',
    'Antagonist injections start',
    'Trigger injection',
    'Egg retrieval',
    'Eggs frozen'
  ]
};

// Sort milestones according to their expected order
function sortMilestones(milestones: Milestone[], cycleType: string): Milestone[] {
  const normalizedType = normalizeCycleType(cycleType);
  const expectedOrder = MILESTONE_ORDER[normalizedType] || [];
  
  if (expectedOrder.length === 0) {
    // If no predefined order, sort by day number
    return milestones.sort((a, b) => a.day - b.day);
  }

  // Sort by the predefined order, then by day number for any not in the list
  return milestones.sort((a, b) => {
    const aIndex = expectedOrder.indexOf(a.name);
    const bIndex = expectedOrder.indexOf(b.name);
    
    // If both are in the expected order, sort by their position
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    
    // If only one is in the expected order, prioritize it
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    
    // If neither is in the expected order, sort by day number
    return a.day - b.day;
  });
}

// Get milestones for a specific cycle type
export async function getMilestonesForCycle(cycleType: string): Promise<Milestone[]> {
  const data = await loadCycleData();

  // Normalize cycle type (handle different formats)
  const normalizedType = normalizeCycleType(cycleType);

  if (data[normalizedType]) {
    // Sort milestones to ensure consistent ordering
    return sortMilestones(data[normalizedType].milestones, cycleType);
  }

  // Return empty array if cycle type not found
  return [];
}

// Get cycle information
export async function getCycleInfo(cycleType: string): Promise<CycleType | null> {
  const data = await loadCycleData();
  const normalizedType = normalizeCycleType(cycleType);

  return data[normalizedType] || null;
}

// Get next upcoming milestone based on current day
export async function getNextMilestone(cycleType: string, currentDay: number, completedMilestones: string[] = []): Promise<Milestone | null> {
  const milestones = await getMilestonesForCycle(cycleType);

  // Find the next milestone that hasn't been completed and is either today or in the future
  const nextMilestone = milestones.find(milestone =>
    milestone.day >= currentDay && !completedMilestones.includes(milestone.name)
  );

  return nextMilestone || null;
}

export async function getMilestoneForDay(
  cycleType: string,
  currentDay: number,
  providedMilestones?: Milestone[]
): Promise<Milestone | null> {
  if (!cycleType) return null;
  const milestones = providedMilestones ?? (await getMilestonesForCycle(cycleType));
  if (!milestones.length) return null;

  let current: Milestone | null = null;
  for (const milestone of milestones) {
    const startDay = milestone.day ?? 1;
    const endDay = milestone.dayEnd ?? milestone.day ?? startDay;
    if (currentDay >= startDay && currentDay <= endDay) {
      current = milestone;
      break;
    }
    if (currentDay >= startDay) {
      current = milestone;
    }
  }

  return current ?? milestones[0];
}

// Calculate expected date for a milestone
export function calculateMilestoneDate(startDate: string, milestoneDay: number): Date {
  const cycleStart = new Date(startDate);
  const milestoneDate = new Date(cycleStart);
  milestoneDate.setDate(milestoneDate.getDate() + milestoneDay - 1);
  return milestoneDate;
}

export function calculateCycleDay(startDate?: string | Date, referenceDate: Date = new Date()): number {
  if (!startDate) return 0;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 0;

  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const refUTC = Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const diffDays = Math.floor((refUTC - startUTC) / MS_IN_DAY);

  return Math.max(diffDays + 1, 0);
}

export function getCycleTypeLabel(cycleType?: string, variant: "long" | "short" = "long"): string {
  if (!cycleType) return variant === "long" ? "Fertility Cycle" : "cycle";
  const normalized = normalizeCycleType(cycleType);
  const meta = cycleTypeMeta[normalized] ?? cycleTypeMeta[cycleType];
  if (!meta) {
    const formatted = cycleType
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
    return variant === "long" ? formatted : formatted.split(" ")[0]?.toLowerCase() || "cycle";
  }
  return variant === "long" ? meta.long : meta.short;
}

export function getEstimatedCycleLength(cycleType?: string): number {
  if (!cycleType) return 28;
  const normalized = normalizeCycleType(cycleType);
  return cycleTypeMeta[normalized]?.duration ?? 28;
}

// Map internal milestone types to readable names for existing UI
export function mapMilestoneType(milestoneName: string): string {
  const mapping: { [key: string]: string } = {
    'Stimulation Start': 'stimulation-start',
    'Egg Collection': 'egg-collection',
    'Fresh Embryo Transfer': 'embryo-transfer',
    'Frozen Embryo Transfer': 'frozen-transfer',
    'Pregnancy Blood Test (BETA)': 'beta-test',
    'Pregnancy Test': 'beta-test',
    'Insemination': 'iui-procedure',
    'Lining Scan': 'monitoring'
  };

  return mapping[milestoneName] || milestoneName.toLowerCase().replace(/\s+/g, '-');
}

// Get milestone by name from cycle data
export async function getMilestoneByName(cycleType: string, milestoneName: string): Promise<Milestone | null> {
  const milestones = await getMilestonesForCycle(cycleType);
  return milestones.find(m => m.name === milestoneName) || null;
}

// Get milestone by type - searches by type or title
export async function getMilestoneByType(
  cycleType: string,
  milestoneType: string,
  milestoneTitle?: string
): Promise<Milestone | null> {
  const milestones = await getMilestonesForCycle(cycleType);
  
  // First try to match by name
  let milestone = milestones.find(m => m.name === milestoneType);
  
  // If not found and title provided, try to match by title
  if (!milestone && milestoneTitle) {
    milestone = milestones.find(m => m.name === milestoneTitle);
  }
  
  return milestone || null;
}

// Phase detection types
export interface CyclePhase {
  name: string;
  description: string;
  color: string; // Tailwind color class
  icon: string; // Emoji or icon identifier
  tips: string[];
}

interface UserMilestone {
  title: string;
  status: string;
  startDate?: string;
  endDate?: string;
  date: string;
  type: string;
}

// Get the latest milestone that is 'in-progress' or 'completed'
export function getLatestActiveMilestone(userMilestones: UserMilestone[]): UserMilestone | null {
  if (!userMilestones || userMilestones.length === 0) return null;

  // Filter milestones that are in-progress or completed
  const activeMilestones = userMilestones.filter(m =>
    m.status === 'in-progress' || m.status === 'completed'
  );

  console.log('[getLatestActiveMilestone] Total milestones:', userMilestones.length);
  console.log('[getLatestActiveMilestone] Active milestones:', activeMilestones.length);
  console.log('[getLatestActiveMilestone] All statuses:', userMilestones.map(m => m.status));

  if (activeMilestones.length === 0) return null;

  // Separate in-progress and completed milestones
  const inProgress = activeMilestones.filter(m => m.status === 'in-progress');
  const completed = activeMilestones.filter(m => m.status === 'completed');

  // Prioritize in-progress milestones - if any exist, return the most recent one
  if (inProgress.length > 0) {
    const sortedInProgress = inProgress.sort((a, b) => {
      const dateA = new Date(a.startDate || a.date || '').getTime();
      const dateB = new Date(b.startDate || b.date || '').getTime();
      return dateB - dateA; // Most recent first
    });
    return sortedInProgress[0];
  }

  // If no in-progress milestones, return the most recent completed one
  if (completed.length > 0) {
    const sortedCompleted = completed.sort((a, b) => {
      const dateA = new Date(a.startDate || a.date || '').getTime();
      const dateB = new Date(b.startDate || b.date || '').getTime();
      return dateB - dateA; // Most recent first
    });
    return sortedCompleted[0];
  }

  return null;
}

// Get milestone summary/details by milestone ID, type, or title
export function getMilestoneSummary(
  cycleType: string,
  milestoneType?: string,
  milestoneTitle?: string,
  milestoneId?: string
): string | null {
  const normalizedCycleType = cycleType.toUpperCase().replace(/-/g, '_');

  // Map cycle type
  let cycleTemplateId = normalizedCycleType;
  if (normalizedCycleType === 'IVF_FRESH' || normalizedCycleType === 'IVF') {
    cycleTemplateId = 'IVF';
  } else if (normalizedCycleType === 'IVF_FROZEN' || normalizedCycleType === 'FET') {
    cycleTemplateId = 'FET';
  } else if (normalizedCycleType === 'EGG_FREEZING' || normalizedCycleType === 'EGG_FREEZ') {
    cycleTemplateId = 'EGG_FREEZ';
  } else if (normalizedCycleType === 'IUI') {
    cycleTemplateId = 'IUI';
  }

  // Try to find by milestone ID first (most reliable)
  if (milestoneId) {
    const normalizedId = milestoneId.toUpperCase().replace(/-/g, '_');
    const match = milestonesData.find(
      (m: any) => m.milestone_id === normalizedId && m.cycle_template_id === cycleTemplateId
    );
    if (match) return match.milestone_details;
  }

  // Try to find by milestone name/title
  if (milestoneTitle) {
    const normalize = (str: string) => str.toLowerCase().replace(/[-\s_]/g, '').trim();
    const normalizedTitle = normalize(milestoneTitle);

    const match = milestonesData.find((m: any) => {
      if (m.cycle_template_id !== cycleTemplateId) return false;
      const normalizedName = normalize(m.milestone_name);
      return normalizedName === normalizedTitle ||
        normalizedName.includes(normalizedTitle) ||
        normalizedTitle.includes(normalizedName);
    });
    if (match) return match.milestone_details;
  }

  return null;
}

// Stage detection types
interface StageInfo {
  name: string;
  details: string;
}

export interface StageDetectionResult {
  stage: StageInfo;
  source: string;
  confidence: string;
}

// Legacy types for compatibility
export interface StageReferenceData {
  stageId: string;
  cycleTemplateId: string;
  stageName: string;
  startMilestoneId: string;
  expectedDate: number | null;
  endMilestoneId: string;
  expectedDate2: number | null;
  uiPriority: number | null;
  details: string;
}

// Optimized stage lookup using Map for O(1) performance
const stageMap = new Map(
  stagesData.map((s: any) => [s.milestone_id, s])
);

// Optimized milestone lookup using Map for O(1) performance  
const milestoneMap = new Map(
  milestonesData.map((m: any) => [
    `${m.cycle_template_id}:${m.milestone_name.toLowerCase().replace(/[-\s_]/g, '').trim()}`, 
    m
  ])
);

// SYNCHRONOUS stage info lookup by milestone ID - O(1) performance
export function getStageInfoByMilestoneId(milestoneId: string): StageInfo | null {
  const stageEntry = stageMap.get(milestoneId);
  
  if (!stageEntry) {
    throw new Error(`No stage found for milestone ID: ${milestoneId}`);
  }

  return {
    name: stageEntry.stage_name,
    details: stageEntry.stage_details
  };
}

// SYNCHRONOUS milestone ID lookup by name - O(1) performance
export function getMilestoneIdByName(
  cycleType: string,
  milestoneTitle: string
): string | null {
  // Normalize cycle type to match the data format
  const normalizedCycleType = cycleType.toUpperCase().replace(/-/g, '_');
  let cycleTemplateId = normalizedCycleType;
  
  if (normalizedCycleType === 'IVF_FRESH' || normalizedCycleType === 'IVF') {
    cycleTemplateId = 'IVF';
  } else if (normalizedCycleType === 'IVF_FROZEN' || normalizedCycleType === 'FET') {
    cycleTemplateId = 'FET';
  } else if (normalizedCycleType === 'EGG_FREEZING' || normalizedCycleType === 'EGG_FREEZ') {
    cycleTemplateId = 'EGG_FREEZ';
  } else if (normalizedCycleType === 'IUI') {
    cycleTemplateId = 'IUI';
  }

  const normalize = (str: string) => str.toLowerCase().replace(/[-\s_]/g, '').trim();
  const normalizedTitle = normalize(milestoneTitle);
  const lookupKey = `${cycleTemplateId}:${normalizedTitle}`;
  console.log(normalize,"==============lookupKey")
  const match = milestoneMap.get(lookupKey);
  
  if (!match) {
    throw new Error(`No milestone ID found for title: ${milestoneTitle} in cycle: ${cycleType}`);
  }

  return match.milestone_id;
}

// Get the first milestone for a cycle type (for new cycles with no completed milestones)
function getFirstMilestoneForCycleType(cycleType: string): any | null {
  // Normalize cycle type to match the data format
  const normalizedCycleType = cycleType.toUpperCase().replace(/-/g, '_');
  let cycleTemplateId = normalizedCycleType;
  
  if (normalizedCycleType === 'IVF_FRESH' || normalizedCycleType === 'IVF') {
    cycleTemplateId = 'IVF';
  } else if (normalizedCycleType === 'IVF_FROZEN' || normalizedCycleType === 'FET') {
    cycleTemplateId = 'FET';
  } else if (normalizedCycleType === 'EGG_FREEZING' || normalizedCycleType === 'EGG_FREEZ') {
    cycleTemplateId = 'EGG_FREEZ';
  } else if (normalizedCycleType === 'IUI') {
    cycleTemplateId = 'IUI';
  }

  // Find the first milestone for this cycle type
  // Look for milestones that typically come first (like "Cycle day 1" or "Baseline blood test")
  const firstMilestoneNames = [
    'Cycle day 1',
    'Baseline blood test', 
    'Stimulation injections start',
    'Monitoring blood test'
  ];

  for (const milestoneName of firstMilestoneNames) {
    const milestone = milestonesData.find((m: any) => 
      m.cycle_template_id === cycleTemplateId && 
      m.milestone_name === milestoneName
    );
    if (milestone) {
      return milestone;
    }
  }

  // If no specific first milestone found, return the first milestone for this cycle type
  return milestonesData.find((m: any) => m.cycle_template_id === cycleTemplateId) || null;
}

// SYNCHRONOUS deterministic stage detection - NO async, NO fallbacks, NO guessing
export function getStageInfoWithJsonFallback(
  stageReferenceData: any[], // Unused - kept for compatibility
  activeCycle: any,
  milestones: any[],
  currentDay: number
): StageDetectionResult {
  if (!activeCycle) {
    throw new Error('No active cycle provided - stage detection requires active cycle');
  }

  // Get the latest active milestone
  const latestActiveMilestone = getLatestActiveMilestone(milestones);

  // If no active milestone found (new cycle), use the first milestone for this cycle type
  if (!latestActiveMilestone) {
    console.log('[Stage Detection] No active milestone found - using first milestone for new cycle');
    
    // Get the first milestone for this cycle type
    const firstMilestone = getFirstMilestoneForCycleType(activeCycle.type);
    
    if (!firstMilestone) {
      throw new Error(`No milestones found for cycle type: ${activeCycle.type}`);
    }

    const stageInfo = getStageInfoByMilestoneId(firstMilestone.milestone_id);
    
    console.log('[Stage Detection] Using first milestone stage:', stageInfo.name);

    return {
      stage: {
        name: stageInfo.name,
        description: stageInfo.details,
        details: stageInfo.details
      },
      source: 'first_milestone',
      confidence: 'high'
    };
  }

  // Get milestone ID by exact title match - SYNCHRONOUS
  const milestoneId = getMilestoneIdByName(
    activeCycle.type,
    latestActiveMilestone.title
  );
  console.log("===============ml of id========",milestoneId)
  console.log('[Stage Detection] Milestone ID found:', milestoneId);

  // Get stage info by milestone ID - SYNCHRONOUS
  const stageInfo = getStageInfoByMilestoneId(milestoneId);
console.log(stageInfo,"===============stageInfo of id========",milestoneId)
  console.log('[Stage Detection] Stage found:', stageInfo.name);

  return {
    stage: {
      name: stageInfo.name,
      description: stageInfo.details,
      details: stageInfo.details
    },
    source: 'current_milestone',
    confidence: 'high'
  };
}

// Legacy stub functions for compatibility - these should not be used in the new system
export function getStageInfoFromData(): { name: string; details: string } | null {
  console.warn('getStageInfoFromData is deprecated - use getStageInfoWithJsonFallback instead');
  return null;
}

export function getStageInfoFromMilestones(): { name: string; details: string } | null {
  console.warn('getStageInfoFromMilestones is deprecated - use getStageInfoWithJsonFallback instead');
  return null;
}