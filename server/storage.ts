import {
  users,
  cycles,
  medications,
  medicationLogs,
  medicationInfo,
  symptoms,
  testResults,
  appointments,
  milestones,
  doctors,
  doctorReviews,
  reviewHelpfulnessVotes,
  forumPosts,
  forumComments,
  forumPostReactions,
  chatMessages,
  directMessages,
  events,
  communityArticles,
  educationalArticles,
  treatmentTypes,
  clinics,
  cycleTypes,
  eventTypes,
  milestoneTypes,
  contentBlocks,
  type User,
  type UpsertUser,
  type Cycle,
  type InsertCycle,
  type Medication,
  type InsertMedication,
  type MedicationLog,
  type InsertMedicationLog,
  type MedicationInfo,
  type InsertMedicationInfo,
  type Symptom,
  type InsertSymptom,
  type TestResult,
  type InsertTestResult,
  type CommunityArticle,
  type InsertCommunityArticle,
  type Appointment,
  type InsertAppointment,
  type Milestone,
  type InsertMilestone,
  type Doctor,
  type InsertDoctor,
  type DoctorReview,
  type InsertDoctorReview,
  type ReviewHelpfulnessVote,
  type InsertReviewHelpfulnessVote,
  type ForumPost,
  type InsertForumPost,
  type ForumComment,
  type TreatmentType,
  type Clinic,
  type CycleType,
  type EventType,
  type MilestoneType,
  type ContentBlock,
  type InsertContentBlock,
  type InsertForumComment,
  type ForumPostReaction,
  type InsertForumPostReaction,
  type ChatMessage,
  type InsertChatMessage,
  type DirectMessage,
  type InsertDirectMessage,
  type Event,
  type InsertEvent,
  type CycleStageTemplate,
  type EducationalArticle,
  type InsertEducationalArticle,
} from "@shared/schema";
import { cycleStageTemplates } from "@shared/schema";
import { db, ensureDbInitialized } from "./db";
import { eq, desc, asc, and, avg, count, sql, like, ilike, or, inArray } from "drizzle-orm";
import { innerJoin } from "drizzle-orm";
import { CYCLE_STAGE_TEMPLATE_SEED, CYCLE_TEMPLATE_META } from "./cycleTemplateData";
import { MEDICATION_INFO_SEED } from "./medicationInfoData";
import { EDUCATIONAL_CONTENT_SEED } from "./educationalContentData";
import fs from "node:fs/promises";
import path from "node:path";
import { DOCTOR_DATA_SEED } from "./doctorData";

export interface CycleTemplateMilestone {
  name: string;
  day: number;
  dayEnd?: number | null;
  dayLabel: string;
  medicalDetails: string;
  monitoringProcedures: string;
  patientInsights: string;
  tips: string[];
}

export interface CycleTemplateDefinition {
  key: string;
  name: string;
  description: string;
  duration: number;
  milestones: CycleTemplateMilestone[];
}

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

const normalizeCsvValue = (value?: string | null) => (value ?? "").trim();

const parseCsvRows = (input: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === "\"") {
        const next = input[i + 1];
        if (next === "\"") {
          field += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
};

export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Profile operations
  updateUserProfile(id: string, data: Partial<User>): Promise<User>;
  completeOnboarding(id: string, data: { age: number; location: string; treatmentType: string; clinicName?: string }): Promise<User>;

  // Cycle operations
  getUserCycles(userId: string): Promise<Cycle[]>;
  getActiveCycle(userId: string): Promise<Cycle | undefined>;
  getCycleById(id: string): Promise<Cycle | undefined>;
  createCycle(cycle: InsertCycle): Promise<Cycle>;
  updateCycle(id: string, data: Partial<Cycle>): Promise<Cycle>;
  endCycle(id: string, result: string, notes?: string): Promise<Cycle>;
  deleteCycle(id: string, userId: string): Promise<void>;
  ensureCycleStageTemplatesSeeded(): Promise<void>;
  getCycleTemplateMap(): Promise<Record<string, CycleTemplateDefinition>>;

  // Medication operations
  getCycleMedications(cycleId: string): Promise<Medication[]>;
  createMedication(medication: InsertMedication): Promise<Medication>;
  updateMedication(id: string, data: Partial<Medication>): Promise<Medication>;
  deleteMedication(id: string): Promise<void>;

  // Medication logging
  logMedication(log: InsertMedicationLog): Promise<MedicationLog>;
  getMedicationLogs(medicationId: string, date?: string): Promise<MedicationLog[]>;

  // Medication information (reference data)
  getAllMedicationInfo(): Promise<MedicationInfo[]>;
  getMedicationInfoById(id: string): Promise<MedicationInfo | undefined>;
  getMedicationInfoByName(name: string): Promise<MedicationInfo | undefined>;
  createMedicationInfo(info: InsertMedicationInfo): Promise<MedicationInfo>;
  ensureMedicationInfoSeeded(): Promise<void>;

  // Reference data operations
  getTreatmentTypes(): Promise<TreatmentType[]>;
  getClinics(): Promise<Clinic[]>;
  getCycleTypes(): Promise<CycleType[]>;
  getEventTypes(): Promise<EventType[]>;
  getMilestoneTypes(cycleType?: string): Promise<MilestoneType[]>;
  ensureReferenceDataSeeded(): Promise<void>;

  // Content blocks (personalized insights)
  getContentBlocks(cycleTemplateId?: string): Promise<ContentBlock[]>;
  getContentBlockByMilestone(cycleTemplateId: string, milestoneName: string): Promise<ContentBlock | undefined>;
  ensureContentBlocksSeeded(): Promise<void>;

  // Symptom operations
  getCycleSymptoms(cycleId: string): Promise<Symptom[]>;
  createSymptom(symptom: InsertSymptom): Promise<Symptom>;
  updateSymptom(id: string, data: Partial<Symptom>): Promise<Symptom>;
  deleteSymptom(id: string): Promise<void>;
  getSymptomsByDate(cycleId: string, date: string): Promise<Symptom | undefined>;
  getSymptomById(id: string): Promise<Symptom | undefined>;

  // Test results
  getCycleTestResults(cycleId: string): Promise<TestResult[]>;
  getTestResultById(id: string): Promise<TestResult | undefined>;
  createTestResult(result: InsertTestResult): Promise<TestResult>;
  updateTestResult(id: string, data: Partial<TestResult>): Promise<TestResult>;
  deleteTestResult(id: string): Promise<void>;

  // Appointments
  getCycleAppointments(cycleId: string): Promise<Appointment[]>;
  getUserUpcomingAppointments(userId: string): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment>;
  deleteAppointment(id: string): Promise<void>;
  getAppointmentById(id: string): Promise<Appointment | undefined>;

  // Milestone operations
  getCycleMilestones(cycleId: string): Promise<Milestone[]>;
  getMilestoneById(id: string): Promise<Milestone | undefined>;
  createMilestone(milestone: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: string, data: Partial<Milestone>): Promise<Milestone>;
  deleteMilestone(id: string): Promise<void>;

  // Doctor operations
  searchDoctors(query?: string, location?: string, specialty?: string, bulkBilling?: boolean, sortBy?: "rating" | "name" | "reviews" | "distance", telehealth?: boolean, weekendHours?: boolean, experience?: string, distance?: string): Promise<Doctor[]>;
  getDoctor(id: string): Promise<Doctor | undefined>;
  createDoctor(doctor: InsertDoctor): Promise<Doctor>;
  updateDoctor(id: string, data: Partial<Doctor>): Promise<Doctor>;
  deleteDoctor(id: string): Promise<void>;
  getDoctorReviews(doctorId: string): Promise<DoctorReview[]>;
  createDoctorReview(review: InsertDoctorReview): Promise<DoctorReview>;
  updateDoctorReview(id: string, data: Partial<DoctorReview>): Promise<DoctorReview>;
  deleteDoctorReview(id: string): Promise<void>;

  // Forum operations
  getForumPosts(category?: string, limit?: number, userId?: string): Promise<(ForumPost & { user: User; commentCount: number; reactions?: Record<string, number>; userReaction?: string })[]>;
  getForumPost(id: string): Promise<(ForumPost & { user: User }) | undefined>;
  createForumPost(post: InsertForumPost): Promise<ForumPost>;
  deleteForumPost(id: string, userId: string): Promise<void>;
  getForumComments(postId: string): Promise<(ForumComment & { user: User })[]>;
  createForumComment(comment: InsertForumComment): Promise<ForumComment>;
  likeForumPost(postId: string): Promise<void>;
  reactToForumPost(postId: string, userId: string, reaction: string): Promise<void>;

  // Direct messaging operations
  sendDirectMessage(message: InsertDirectMessage): Promise<DirectMessage>;
  getConversations(userId: string): Promise<Array<{ otherUser: User; lastMessage: DirectMessage; unreadCount: number }>>;
  getMessages(userId: string, otherUserId: string): Promise<(DirectMessage & { sender: User; receiver: User })[]>;
  markMessagesAsRead(userId: string, senderId: string): Promise<void>;
  getUnreadMessageCount(userId: string): Promise<number>;

  // Chat operations
  getUserChatMessages(userId: string, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Event logging operations
  getUserEvents(userId: string): Promise<Event[]>;
  getCycleEvents(cycleId: string): Promise<Event[]>;
  getEventById(id: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, data: Partial<Event>): Promise<Event>;
  deleteEvent(id: string): Promise<void>;

  // Cycle summary operations
  getCycleSummary(cycleId: string): Promise<{
    cycle: Cycle;
    medications: Medication[];
    symptoms: Symptom[];
    testResults: TestResult[];
    milestones: Milestone[];
    appointments: Appointment[];
    events: Event[];
  }>;

  // User data export
  exportUserData(userId: string): Promise<{
    user: User;
    cycles: Cycle[];
    medications: Medication[];
    medicationLogs: MedicationLog[];
    symptoms: Symptom[];
    testResults: TestResult[];
    appointments: Appointment[];
    milestones: Milestone[];
    events: Event[];
    forumPosts: ForumPost[];
    forumComments: ForumComment[];
    chatMessages: ChatMessage[];
    doctorReviews: DoctorReview[];
  }>;

  // User deletion
  deleteUserData(userId: string): Promise<void>;

  // Community articles operations
  getCommunityArticles(): Promise<CommunityArticle[]>;
  ensureCommunityArticlesSeeded(): Promise<void>;
  ensureEducationalArticlesSeeded(): Promise<void>;
  deleteAllDoctors(): Promise<void>;
  ensureDoctorsSeeded(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private cycleTemplateCache: Record<string, CycleTemplateDefinition> | null = null;
  private cycleTemplatesSeeded = false;
  private stageReferenceCache: StageReferenceData[] | null = null;

  async ensureCycleStageTemplatesSeeded(forceRefresh = false): Promise<void> {
    if (this.cycleTemplatesSeeded && !forceRefresh) {
      return;
    }

    await ensureDbInitialized();

    const [existing] =
      (await db
        .select({ count: count() })
        .from(cycleStageTemplates)
        .limit(1)) || [];

    const existingCount = existing ? Number(existing.count) : 0;
    const expectedCount = CYCLE_STAGE_TEMPLATE_SEED.length;

    const sentinelStages = [
      { stage: "Cycle day 1", cycleType: "ivf_fresh" },
      { stage: "Pregnancy blood test", cycleType: "ivf_fresh" },
      { stage: "Embryo transfer", cycleType: "ivf_frozen" },
      { stage: "Eggs frozen", cycleType: "egg_freezing" },
    ];

    let needsRefresh = forceRefresh || existingCount !== expectedCount;

    if (!needsRefresh) {
      for (const sentinel of sentinelStages) {
        const [match] =
          (await db
            .select({ count: count() })
            .from(cycleStageTemplates)
            .where(
              and(
                eq(cycleStageTemplates.cycleType, sentinel.cycleType),
                eq(cycleStageTemplates.stage, sentinel.stage),
              ),
            )
            .limit(1)) || [];

        if (!match || Number(match.count) === 0) {
          needsRefresh = true;
          break;
        }
      }
    }

    if (needsRefresh) {
      await db.delete(cycleStageTemplates);
      await db.insert(cycleStageTemplates).values(CYCLE_STAGE_TEMPLATE_SEED);
      this.cycleTemplateCache = null;
    }

    this.cycleTemplatesSeeded = true;
  }

  async getCycleTemplateMap(): Promise<Record<string, CycleTemplateDefinition>> {
    await this.ensureCycleStageTemplatesSeeded();

    if (this.cycleTemplateCache) {
      return this.cycleTemplateCache;
    }

    const templates: CycleStageTemplate[] = await db
      .select()
      .from(cycleStageTemplates)
      .orderBy(
        asc(cycleStageTemplates.cycleType),
        asc(cycleStageTemplates.dayStart),
        asc(cycleStageTemplates.stage),
      );

    const grouped: Record<string, CycleTemplateDefinition> = {};

    for (const template of templates) {
      const key = template.cycleType;
      const baseMeta = CYCLE_TEMPLATE_META[key];

      if (!grouped[key]) {
        grouped[key] = {
          key,
          name: baseMeta ? baseMeta.name : this.toTitleCase(key.replace(/_/g, " ")),
          description: baseMeta ? baseMeta.description : "Treatment cycle template",
          duration: baseMeta ? baseMeta.duration : template.dayEnd ?? template.dayStart ?? 1,
          milestones: [],
        };
      }

      const milestone: CycleTemplateMilestone = {
        name: template.stage,
        day: template.dayStart,
        dayEnd: template.dayEnd,
        dayLabel: template.dayLabel,
        medicalDetails: template.medicalDetails || "",
        monitoringProcedures: template.monitoringProcedures || "",
        patientInsights: template.patientInsights || "",
        tips: this.buildTipsFromTemplate(template),
      };

      grouped[key].milestones.push(milestone);

      const candidateDuration = template.dayEnd ?? template.dayStart ?? grouped[key].duration;
      grouped[key].duration = Math.max(grouped[key].duration, candidateDuration);
    }

    Object.values(grouped).forEach((template) => {
      template.milestones.sort((a, b) => a.day - b.day);
    });

    if (grouped.ivf_frozen && !grouped.fet) {
      grouped.fet = grouped.ivf_frozen;
    }

    this.cycleTemplateCache = grouped;
    return grouped;
  }

  // User operations - mandatory for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      const [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            ...userData,
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    } catch (error: any) {
      if (error?.code === '23505' && error?.constraint === 'users_email_unique') {
        const [existingUser] = await db.select().from(users).where(sql`${users.email} = ${userData.email}`);
        if (existingUser) {
          const [updated] = await db
            .update(users)
            .set({
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              updatedAt: new Date(),
            })
            .where(sql`${users.email} = ${userData.email}`)
            .returning();
          return updated;
        }
      }
      throw error;
    }
  }

  // Profile operations
  async updateUserProfile(id: string, data: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async completeOnboarding(id: string, data: { age: number; location: string; treatmentType: string; clinicName?: string }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        age: data.age,
        location: data.location,
        treatmentType: data.treatmentType,
        clinicName: data.clinicName,
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Cycle operations
  async getUserCycles(userId: string): Promise<Cycle[]> {
    return await db
      .select()
      .from(cycles)
      .where(eq(cycles.userId, userId))
      .orderBy(desc(cycles.createdAt));
  }

  async getActiveCycle(userId: string): Promise<Cycle | undefined> {
    const [cycle] = await db
      .select()
      .from(cycles)
      .where(and(eq(cycles.userId, userId), eq(cycles.status, "active")))
      .orderBy(desc(cycles.createdAt))
      .limit(1);
    return cycle;
  }

  async getCycleById(id: string): Promise<Cycle | undefined> {
    const [cycle] = await db
      .select()
      .from(cycles)
      .where(eq(cycles.id, id))
      .limit(1);
    return cycle;
  }

  async createCycle(cycle: InsertCycle & { userId: string }): Promise<Cycle> {
    const [newCycle] = await db.insert(cycles).values(cycle).returning();

    try {
      await this.ensureCycleStageTemplatesSeeded();
      await this.createTemplateMilestonesForCycle(newCycle);
    } catch (error) {
      console.error(
        `[Storage] Failed to auto-create milestones for cycle ${newCycle.id}:`,
        error,
      );
    }

    return newCycle;
  }

  async updateCycle(id: string, data: Partial<Cycle>): Promise<Cycle> {
    const [cycle] = await db
      .update(cycles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cycles.id, id))
      .returning();
    return cycle;
  }

  async getOrCreateShareToken(cycleId: string): Promise<string> {
    const cycle = await this.getCycleById(cycleId);
    if (!cycle) {
      throw new Error("Cycle not found");
    }

    // If share token exists, return it
    if (cycle.shareToken) {
      return cycle.shareToken;
    }

    // Generate a new share token
    const { randomUUID } = await import("crypto");
    const shareToken = randomUUID();
    
    await db
      .update(cycles)
      .set({ shareToken, updatedAt: new Date() })
      .where(eq(cycles.id, cycleId));

    return shareToken;
  }

  async getCycleByShareToken(shareToken: string): Promise<Cycle | undefined> {
    const [cycle] = await db
      .select()
      .from(cycles)
      .where(eq(cycles.shareToken, shareToken))
      .limit(1);
    return cycle;
  }

  async endCycle(id: string, result: string, notes?: string): Promise<Cycle> {
    const [cycle] = await db
      .update(cycles)
      .set({
        status: "completed",
        result,
        notes,
        endDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date(),
      })
      .where(eq(cycles.id, id))
      .returning();
    return cycle;
  }

  async deleteCycle(id: string, userId: string): Promise<void> {
    // Verify cycle exists and belongs to user
    const cycle = await this.getCycleById(id);
    if (!cycle) {
      throw new Error("Cycle not found");
    }
    if (cycle.userId !== userId) {
      throw new Error("Unauthorized: Cycle does not belong to you");
    }
    // Delete cycle (cascade will handle related data: medications, symptoms, testResults, appointments, milestones, events)
    await db.delete(cycles).where(eq(cycles.id, id));
  }

  // Milestone operations
  async getCycleMilestones(cycleId: string): Promise<Milestone[]> {
    return await db
      .select()
      .from(milestones)
      .where(eq(milestones.cycleId, cycleId))
      .orderBy(milestones.date);
  }

  async getMilestoneById(id: string): Promise<Milestone | undefined> {
    const [milestone] = await db
      .select()
      .from(milestones)
      .where(eq(milestones.id, id))
      .limit(1);
    return milestone;
  }

  async createMilestone(milestone: InsertMilestone): Promise<Milestone> {
    const [newMilestone] = await db.insert(milestones).values(milestone).returning();
    return newMilestone;
  }

  async updateMilestone(id: string, data: Partial<Milestone>): Promise<Milestone> {
    const [milestone] = await db
      .update(milestones)
      .set(data)
      .where(eq(milestones.id, id))
      .returning();
    return milestone;
  }

  async deleteMilestone(id: string): Promise<void> {
    await db.delete(milestones).where(eq(milestones.id, id));
  }

  // Medication operations
  async getCycleMedications(cycleId: string): Promise<Medication[]> {
    return await db
      .select()
      .from(medications)
      .where(eq(medications.cycleId, cycleId))
      .orderBy(medications.name);
  }

  async createMedication(medication: InsertMedication): Promise<Medication> {
    const [newMedication] = await db.insert(medications).values(medication).returning();
    return newMedication;
  }

  async updateMedication(id: string, data: Partial<Medication>): Promise<Medication> {
    const [medication] = await db
      .update(medications)
      .set(data)
      .where(eq(medications.id, id))
      .returning();
    return medication;
  }

  async getMedicationById(id: string): Promise<Medication | undefined> {
    const [medication] = await db
      .select()
      .from(medications)
      .where(eq(medications.id, id))
      .limit(1);
    return medication;
  }

  async deleteMedication(id: string): Promise<void> {
    await db.delete(medications).where(eq(medications.id, id));
  }

  // Medication logging
  async logMedication(log: InsertMedicationLog): Promise<MedicationLog> {
    const [newLog] = await db.insert(medicationLogs).values(log).returning();
    return newLog;
  }

  async getMedicationLogs(medicationId: string, date?: string): Promise<MedicationLog[]> {
    const conditions = [eq(medicationLogs.medicationId, medicationId)];
    if (date) {
      conditions.push(eq(medicationLogs.date, date));
    }
    return await db
      .select()
      .from(medicationLogs)
      .where(and(...conditions))
      .orderBy(desc(medicationLogs.createdAt));
  }

  async getCycleMedicationLogs(cycleId: string): Promise<MedicationLog[]> {
    const medications = await this.getCycleMedications(cycleId);
    const medicationIds = medications.map(m => m.id);
    
    if (medicationIds.length === 0) {
      return [];
    }

    return await db
      .select()
      .from(medicationLogs)
      .where(inArray(medicationLogs.medicationId, medicationIds))
      .orderBy(asc(medicationLogs.date), desc(medicationLogs.createdAt));
  }

  // Medication information operations
  async getAllMedicationInfo(): Promise<MedicationInfo[]> {
    return await db
      .select()
      .from(medicationInfo)
      .orderBy(asc(medicationInfo.name));
  }

  async getMedicationInfoById(id: string): Promise<MedicationInfo | undefined> {
    const [info] = await db
      .select()
      .from(medicationInfo)
      .where(eq(medicationInfo.id, id))
      .limit(1);
    return info;
  }

  async getMedicationInfoByName(name: string): Promise<MedicationInfo | undefined> {
    // Case-insensitive search - get all and filter in memory for simplicity
    // This is fine since there are only 12 medications
    const allMedications = await db
      .select()
      .from(medicationInfo);
    
    const found = allMedications.find(
      (med: MedicationInfo) => med.name.toLowerCase() === name.toLowerCase()
    );
    
    return found;
  }

  async createMedicationInfo(info: InsertMedicationInfo): Promise<MedicationInfo> {
    const [newInfo] = await db
      .insert(medicationInfo)
      .values(info)
      .returning();
    return newInfo;
  }

  async ensureMedicationInfoSeeded(): Promise<void> {
    // Ensure database is initialized before using it
    const database = await ensureDbInitialized();
    
    const [existing] = await database
      .select({ count: count() })
      .from(medicationInfo)
      .limit(1);

    const existingCount = existing ? Number(existing.count) : 0;
    const isFirstSeed = existingCount === 0;

    console.log("[Storage] Seeding/updating medication info...");
    console.log(`[Storage] Attempting to process ${MEDICATION_INFO_SEED.length} medication records`);
    try {
      // Insert or update medications one by one to handle any errors gracefully
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      for (const med of MEDICATION_INFO_SEED) {
        try {
          // Check if exists first
          const [existing] = await database
            .select()
            .from(medicationInfo)
            .where(eq(medicationInfo.id, med.id))
            .limit(1);
          
          if (existing) {
            // Update if videoLink is empty or missing and seed data has a videoLink
            if ((!existing.videoLink || existing.videoLink.trim() === "") && med.videoLink && med.videoLink.trim() !== "") {
              await database
                .update(medicationInfo)
                .set({ videoLink: med.videoLink, updatedAt: sql`now()` })
                .where(eq(medicationInfo.id, med.id));
              updated++;
              console.log(`[Storage] Updated video link for ${med.name}`);
            } else {
              skipped++;
            }
            continue;
          }
          
          await database.insert(medicationInfo).values(med);
          inserted++;
        } catch (err: any) {
          if (err?.code === '23505') {
            // Duplicate, skip
            skipped++;
            console.log(`[Storage] Medication ${med.name} already exists, skipping`);
          } else {
            console.error(`[Storage] Error processing ${med.name}:`, err);
          }
        }
      }
      console.log(`[Storage] Seeding/update complete: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${MEDICATION_INFO_SEED.length} total`);
    } catch (error: any) {
      console.error("[Storage] Error seeding medication info:", error);
      console.error("[Storage] Error details:", JSON.stringify(error, null, 2));
      // Don't throw - allow server to continue even if seeding fails
    }
  }

  // Symptom operations
  async getCycleSymptoms(cycleId: string): Promise<Symptom[]> {
    return await db
      .select()
      .from(symptoms)
      .where(eq(symptoms.cycleId, cycleId))
      .orderBy(desc(symptoms.date));
  }

  async createSymptom(symptom: InsertSymptom): Promise<Symptom> {
    const [newSymptom] = await db.insert(symptoms).values(symptom).returning();
    return newSymptom;
  }

  async updateSymptom(id: string, data: Partial<Symptom>): Promise<Symptom> {
    // Get existing symptom to merge data
    const existing = await this.getSymptomById(id);
    if (!existing) {
      throw new Error("Symptom not found");
    }

    console.log("[Storage] Updating symptom:", id);
    console.log("[Storage] Existing symptom:", {
      bloating: existing.bloating,
      fatigue: existing.fatigue,
      nausea: existing.nausea,
      headache: existing.headache,
      moodSwings: existing.moodSwings,
      notes: existing.notes?.substring(0, 100)
    });
    console.log("[Storage] New data:", {
      bloating: data.bloating,
      fatigue: data.fatigue,
      nausea: data.nausea,
      headache: data.headache,
      moodSwings: data.moodSwings,
      notes: data.notes?.substring(0, 100)
    });

    // Build update object - replace fields with new values
    const updateFields: Partial<Symptom> = {
      // Update symptom fields - if null/undefined is provided, set to null to clear the field
      bloating: data.bloating !== undefined ? data.bloating : existing.bloating,
      fatigue: data.fatigue !== undefined ? data.fatigue : existing.fatigue,
      nausea: data.nausea !== undefined ? data.nausea : existing.nausea,
      headache: data.headache !== undefined ? data.headache : existing.headache,
      moodSwings: data.moodSwings !== undefined ? data.moodSwings : existing.moodSwings,
      mood: data.mood !== undefined ? data.mood : existing.mood,
      // Replace notes instead of merging
      notes: data.notes !== undefined ? data.notes : existing.notes,
      // Update date if provided
      date: data.date !== undefined ? data.date : existing.date,
      // Preserve cycleId
      cycleId: existing.cycleId,
    };

    console.log("[Storage] Merged update fields:", {
      bloating: updateFields.bloating,
      fatigue: updateFields.fatigue,
      nausea: updateFields.nausea,
      headache: updateFields.headache,
      moodSwings: updateFields.moodSwings,
      notes: updateFields.notes?.substring(0, 100)
    });

    const [symptom] = await db
      .update(symptoms)
      .set(updateFields)
      .where(eq(symptoms.id, id))
      .returning();
    
    console.log("[Storage] Updated symptom result:", {
      bloating: symptom.bloating,
      fatigue: symptom.fatigue,
      nausea: symptom.nausea,
      headache: symptom.headache,
      moodSwings: symptom.moodSwings,
      notes: symptom.notes?.substring(0, 100)
    });
    
    return symptom;
  }

  async getSymptomById(id: string): Promise<Symptom | undefined> {
    const [symptom] = await db
      .select()
      .from(symptoms)
      .where(eq(symptoms.id, id))
      .limit(1);
    return symptom;
  }

  async deleteSymptom(id: string): Promise<void> {
    const symptom = await this.getSymptomById(id);
    if (!symptom) {
      throw new Error("Symptom not found");
    }
    await db.delete(symptoms).where(eq(symptoms.id, id));
  }

  async getSymptomsByDate(cycleId: string, date: string): Promise<Symptom | undefined> {
    const [symptom] = await db
      .select()
      .from(symptoms)
      .where(and(eq(symptoms.cycleId, cycleId), eq(symptoms.date, date)))
      .limit(1);
    return symptom;
  }

  // Test results
  async getCycleTestResults(cycleId: string): Promise<TestResult[]> {
    return await db
      .select()
      .from(testResults)
      .where(eq(testResults.cycleId, cycleId))
      .orderBy(desc(testResults.date));
  }

  async createTestResult(result: InsertTestResult): Promise<TestResult> {
    const [newResult] = await db.insert(testResults).values(result).returning();
    return newResult;
  }

  async getTestResultById(id: string): Promise<TestResult | undefined> {
    const [result] = await db
      .select()
      .from(testResults)
      .where(eq(testResults.id, id))
      .limit(1);
    return result;
  }

  async updateTestResult(id: string, data: Partial<TestResult>): Promise<TestResult> {
    const [result] = await db
      .update(testResults)
      .set(data)
      .where(eq(testResults.id, id))
      .returning();
    return result;
  }

  async deleteTestResult(id: string): Promise<void> {
    const [deleted] = await db.delete(testResults).where(eq(testResults.id, id)).returning();
    if (!deleted) {
      throw new Error("Test result not found");
    }
  }

  // Appointments
  async getCycleAppointments(cycleId: string): Promise<Appointment[]> {
    return await db
      .select()
      .from(appointments)
      .where(eq(appointments.cycleId, cycleId))
      .orderBy(appointments.date);
  }

  async getUserUpcomingAppointments(userId: string): Promise<Appointment[]> {
    // Use JOIN to ensure appointments only belong to user's cycles (security)
    // This prevents any possibility of returning appointments from other users' cycles
    const regularAppointments = await db
      .select({
        id: appointments.id,
        cycleId: appointments.cycleId,
        type: appointments.type,
        title: appointments.title,
        date: appointments.date,
        location: appointments.location,
        doctorName: appointments.doctorName,
        notes: appointments.notes,
        completed: appointments.completed,
        createdAt: appointments.createdAt,
      })
      .from(appointments)
      .innerJoin(cycles, eq(appointments.cycleId, cycles.id))
      .where(
        and(
          eq(cycles.userId, userId), // CRITICAL: Ensure cycle belongs to user
          eq(cycles.status, "active"), // Only show appointments from active cycles
          sql`${appointments.date} >= NOW()`,
          eq(appointments.completed, false)
        )
      )
      .orderBy(appointments.date);

    // NOTE: doctor_visit events created through the UI also create appointments
    // in the appointments table automatically, so we don't need to convert events to appointments.
    // This prevents duplicates. If there are legacy events without appointments, they will
    // still appear in the events list but not in appointments (which is correct behavior).

    // Deduplicate appointments by title, date, time, and location (in case duplicates exist in DB)
    // Use a more robust key that includes location to catch exact duplicates
    const seenAppointments = new Map<string, Appointment>();
    const appointmentIds = new Set<string>(); // Also track by ID to catch exact duplicates
    
    for (const apt of regularAppointments) {
      // First check by ID (exact duplicate)
      if (appointmentIds.has(apt.id)) {
        console.log(`[getUserUpcomingAppointments] Found duplicate appointment by ID: ${apt.id}`);
        continue;
      }
      appointmentIds.add(apt.id);
      
      const aptDate = apt.date instanceof Date ? apt.date : new Date(apt.date);
      // Normalize to local date string (YYYY-MM-DD) - use UTC methods to avoid timezone issues
      const year = aptDate.getUTCFullYear();
      const month = `${aptDate.getUTCMonth() + 1}`.padStart(2, '0');
      const day = `${aptDate.getUTCDate()}`.padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // Normalize time to HH:MM format - use UTC to avoid timezone issues
      const hours = aptDate.getUTCHours().toString().padStart(2, '0');
      const minutes = aptDate.getUTCMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;
      
      // Include location in key for more precise matching
      const locationStr = apt.location || '';
      const key = `${apt.title}|${dateStr}|${timeStr}|${locationStr}`;
      
      // Keep the first occurrence
      if (!seenAppointments.has(key)) {
        seenAppointments.set(key, apt);
      } else {
        console.log(`[getUserUpcomingAppointments] Found duplicate appointment by key: ${key}`);
      }
      }
      
    // Return deduplicated appointments
    const allAppointments = Array.from(seenAppointments.values())
      .sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 5);

    console.log(`[getUserUpcomingAppointments] Returning ${allAppointments.length} appointments (${regularAppointments.length} from DB, ${regularAppointments.length - allAppointments.length} duplicates removed)`);

    return allAppointments;
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    await ensureDbInitialized();
    
    // Normalize the date - convert to Date object and use UTC for consistent comparison
    const appointmentDate = appointment.date instanceof Date 
      ? appointment.date 
      : new Date(appointment.date);
    
    // Check for duplicate - get ALL appointments for this cycle and compare
    const allAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.cycleId, appointment.cycleId),
          eq(appointments.completed, false)
        )
      );
    
    const targetTitle = appointment.title.trim();
    const targetLocation = (appointment.location || '').trim().toLowerCase();
    
    // Use UTC methods for consistent comparison regardless of timezone
    const targetYear = appointmentDate.getUTCFullYear();
    const targetMonth = appointmentDate.getUTCMonth();
    const targetDay = appointmentDate.getUTCDate();
    const targetHours = appointmentDate.getUTCHours();
    const targetMinutes = appointmentDate.getUTCMinutes();
    
    // Find exact duplicate by comparing UTC date/time
    const duplicate = allAppointments.find(apt => {
      const aptDate = apt.date instanceof Date ? apt.date : new Date(apt.date);
      const aptTitle = apt.title.trim();
      const aptLocation = (apt.location || '').trim().toLowerCase();
      
      return (
        aptTitle === targetTitle &&
        aptDate.getUTCFullYear() === targetYear &&
        aptDate.getUTCMonth() === targetMonth &&
        aptDate.getUTCDate() === targetDay &&
        aptDate.getUTCHours() === targetHours &&
        aptDate.getUTCMinutes() === targetMinutes &&
        aptLocation === targetLocation
      );
    });
    
    if (duplicate) {
      console.log(`[Storage] DUPLICATE FOUND - Returning existing appointment ${duplicate.id} (title: "${targetTitle}", date: ${appointmentDate.toISOString()})`);
      return duplicate;
    }
    
    // No duplicate found, create new appointment
    const [newAppointment] = await db.insert(appointments).values(appointment).returning();
    console.log(`[Storage] Created new appointment ${newAppointment.id} (title: "${targetTitle}", date: ${appointmentDate.toISOString()})`);
    return newAppointment;
  }

  async updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment> {
    const [appointment] = await db
      .update(appointments)
      .set(data)
      .where(eq(appointments.id, id))
      .returning();
    return appointment;
  }

  async getAppointmentById(id: string): Promise<Appointment | undefined> {
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);
    return appointment;
  }

  async deleteAppointment(id: string): Promise<void> {
    const appointment = await this.getAppointmentById(id);
    if (!appointment) {
      throw new Error("Appointment not found");
    }
    await db.delete(appointments).where(eq(appointments.id, id));
  }

  // Doctor operations
  async searchDoctors(query?: string, location?: string, specialty?: string, bulkBilling?: boolean, sortBy?: "rating" | "name" | "reviews" | "distance", telehealth?: boolean, weekendHours?: boolean, experience?: string, distance?: string): Promise<Doctor[]> {
    const conditions = [];
    
    if (query && query.trim()) {
      const trimmedQuery = `%${query.trim().toLowerCase()}%`;
      // Use case-insensitive matching for all search fields using ILIKE (PostgreSQL case-insensitive LIKE)
      conditions.push(
        or(
          sql`LOWER(${doctors.name}::text) LIKE ${trimmedQuery}`,
          sql`LOWER(${doctors.clinic}::text) LIKE ${trimmedQuery}`,
          sql`LOWER(${doctors.specialty}::text) LIKE ${trimmedQuery}`,
          sql`LOWER(${doctors.address}::text) LIKE ${trimmedQuery}`,
          sql`LOWER(${doctors.location}::text) LIKE ${trimmedQuery}`
        )
      );
    }
    
    if (location && location.trim()) {
      // Use case-insensitive matching for location
      const trimmedLocation = `%${location.trim().toLowerCase()}%`;
      conditions.push(sql`LOWER(${doctors.location}::text) LIKE ${trimmedLocation}`);
    }
    
    if (specialty && specialty !== "all") {
      // Use case-insensitive matching for specialty
      const trimmedSpecialty = `%${specialty.toLowerCase()}%`;
      conditions.push(sql`LOWER(${doctors.specialty}::text) LIKE ${trimmedSpecialty}`);
    }
    
    if (bulkBilling !== undefined && bulkBilling !== null) {
      conditions.push(eq(doctors.bulkBilling, bulkBilling));
    }

    // Note: telehealth, weekendHours, experience filters are not yet in database schema
    // These are accepted but not applied as filters yet
    // Distance filter can be applied based on location matching
    
    if (distance && distance !== "all") {
      // For now, distance filter is handled by location matching
        // In a real implementation, you'd calculate actual distances
      // For now, we'll just log it
      console.log(`[searchDoctors] Distance filter requested: ${distance} (not yet implemented)`);
    }

    console.log(`[searchDoctors] Query params: query=${query}, location=${location}, specialty=${specialty}, bulkBilling=${bulkBilling}, telehealth=${telehealth}, weekendHours=${weekendHours}, experience=${experience}, distance=${distance}, sortBy=${sortBy}`);
    console.log(`[searchDoctors] Conditions count: ${conditions.length}`);
    console.log(`[searchDoctors] SortBy value: "${sortBy}" (type: ${typeof sortBy})`);

    let result = await db
      .select()
      .from(doctors)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    // Apply sorting - use in-memory sort for all cases to ensure consistency
    const actualSortBy = (sortBy || "rating").trim();
    console.log(`[searchDoctors] Applying sort: "${actualSortBy}" to ${result.length} doctors`);
    
    if (actualSortBy === "name") {
      // Sort by name alphabetically (A-Z)
      result.sort((a: Doctor, b: Doctor) => {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
    } else if (actualSortBy === "reviews") {
      // Sort by review count descending, then by rating
      result.sort((a: Doctor, b: Doctor) => {
        const reviewsA = a.reviewCount || 0;
        const reviewsB = b.reviewCount || 0;
        if (reviewsB !== reviewsA) {
          return reviewsB - reviewsA;
        }
        // If review counts are equal, sort by rating
        const ratingA = a.rating ? Number(a.rating) : 0;
        const ratingB = b.rating ? Number(b.rating) : 0;
        return ratingB - ratingA;
      });
    } else if (actualSortBy === "distance") {
      // Distance sorting is handled on the frontend with user location
      // For now, sort by location name as fallback
      result.sort((a: Doctor, b: Doctor) => {
        const locationA = (a.location || "").toLowerCase();
        const locationB = (b.location || "").toLowerCase();
        return locationA.localeCompare(locationB);
      });
    } else {
      // Default: sort by rating descending, then by review count
      result.sort((a: Doctor, b: Doctor) => {
        const ratingA = a.rating ? Number(a.rating) : 0;
        const ratingB = b.rating ? Number(b.rating) : 0;
        if (ratingB !== ratingA) {
          return ratingB - ratingA;
        }
        // If ratings are equal, sort by review count
        const reviewsA = a.reviewCount || 0;
        const reviewsB = b.reviewCount || 0;
        return reviewsB - reviewsA;
      });
    }
    
    console.log(`[searchDoctors] Returning ${result.length} doctors sorted by ${actualSortBy}`);
    if (result.length > 0) {
      console.log(`[searchDoctors] First 3 doctors after sorting:`, result.slice(0, 3).map((d: Doctor) => ({ 
        name: d.name, 
        rating: d.rating ? Number(d.rating).toFixed(1) : "N/A", 
        reviewCount: d.reviewCount || 0, 
        location: d.location 
      })));
    }
    return result;
  }

  async getDoctor(id: string): Promise<Doctor | undefined> {
    const [doctor] = await db.select().from(doctors).where(eq(doctors.id, id));
    return doctor;
  }

  async createDoctor(doctor: InsertDoctor): Promise<Doctor> {
    const [newDoctor] = await db.insert(doctors).values(doctor).returning();
    return newDoctor;
  }

  async updateDoctor(id: string, data: Partial<Doctor>): Promise<Doctor> {
    const [updated] = await db
      .update(doctors)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(doctors.id, id))
      .returning();
    if (!updated) {
      throw new Error("Doctor not found");
    }
    return updated;
  }

  async deleteDoctor(id: string): Promise<void> {
    // Check if doctor exists
    const doctor = await this.getDoctor(id);
    if (!doctor) {
      throw new Error("Doctor not found");
    }
    // Delete doctor (reviews will be cascade deleted due to foreign key)
    await db.delete(doctors).where(eq(doctors.id, id));
  }

  async deleteAllDoctors(): Promise<void> {
    await ensureDbInitialized();
    // Delete all doctors (reviews will be cascade deleted due to foreign key)
    await db.delete(doctors);
    console.log("[Storage] All doctors deleted successfully");
  }

  async ensureDoctorsSeeded(): Promise<void> {
    await ensureDbInitialized();

    const [existing] = await db
      .select({ count: count() })
      .from(doctors)
      .limit(1);

    const existingCount = existing ? Number(existing.count) : 0;
    
    if (existingCount > 0 && DOCTOR_DATA_SEED.length === 0) {
      console.log(`[Storage] Doctors already exist (${existingCount} found) but no seed data provided yet`);
      return;
    }

    if (DOCTOR_DATA_SEED.length === 0) {
      console.log("[Storage] No doctor seed data available - skipping seeding");
      return;
    }

    console.log(`[Storage] Attempting to seed ${DOCTOR_DATA_SEED.length} doctors`);
    try {
      let inserted = 0;
      let skipped = 0;
      
      for (const doctor of DOCTOR_DATA_SEED) {
        try {
          // Check if doctor exists by name and location (or use ID if provided)
          const [existing] = await db
            .select()
            .from(doctors)
            .where(
              and(
                eq(doctors.name, doctor.name),
                eq(doctors.location, doctor.location)
              )
            )
            .limit(1);
          
          if (existing) {
            skipped++;
            continue;
          }

          await db.insert(doctors).values(doctor);
          inserted++;
        } catch (error: any) {
          // If doctor already exists (race condition), that's fine
          if (error?.code === '23505') { // PostgreSQL unique violation
            skipped++;
          } else {
            console.error(`[Storage] Error inserting doctor ${doctor.name}:`, error);
            throw error;
          }
        }
      }

      console.log(`[Storage] Doctor seeding complete: ${inserted} inserted, ${skipped} skipped, ${DOCTOR_DATA_SEED.length} total`);
    } catch (error: any) {
      console.error("[Storage] Error seeding doctors:", error);
      // Don't throw - allow server to continue even if seeding fails
    }
  }

  async getDoctorReviews(doctorId: string, sortBy?: "recent" | "best" | "worst"): Promise<DoctorReview[]> {
    let query = db
      .select()
      .from(doctorReviews)
      .where(eq(doctorReviews.doctorId, doctorId));

    // Apply sorting
    if (sortBy === "best") {
      query = query.orderBy(desc(doctorReviews.rating), desc(doctorReviews.createdAt));
    } else if (sortBy === "worst") {
      query = query.orderBy(asc(doctorReviews.rating), desc(doctorReviews.createdAt));
    } else {
      // Default: most recent
      query = query.orderBy(desc(doctorReviews.createdAt));
    }

    return await query;
  }

  async createDoctorReview(review: InsertDoctorReview): Promise<DoctorReview> {
    // Calculate initial helpfulCount (0 for new reviews)
    const [newReview] = await db.insert(doctorReviews).values({
      ...review,
      helpfulCount: 0,
    }).returning();
    
    // Update doctor's average rating and review count
    await this.updateDoctorRating(review.doctorId);

    return newReview;
  }

  async updateDoctorReview(id: string, data: Partial<DoctorReview>): Promise<DoctorReview> {
    const [updated] = await db
      .update(doctorReviews)
      .set(data)
      .where(eq(doctorReviews.id, id))
      .returning();
    
    if (!updated) {
      throw new Error("Review not found");
    }

    // Update doctor's average rating and review count
    await this.updateDoctorRating(updated.doctorId);

    return updated;
  }

  async deleteDoctorReview(id: string): Promise<void> {
    // Get review to find doctorId before deletion
    const [review] = await db
      .select()
      .from(doctorReviews)
      .where(eq(doctorReviews.id, id));
    
    if (!review) {
      throw new Error("Review not found");
    }

    const doctorId = review.doctorId;

    // Delete review
    await db.delete(doctorReviews).where(eq(doctorReviews.id, id));

    // Update doctor's average rating and review count
    await this.updateDoctorRating(doctorId);
  }

  // Helper method to update doctor rating and review count
  private async updateDoctorRating(doctorId: string): Promise<void> {
    const avgRating = await db
      .select({ avg: avg(doctorReviews.rating) })
      .from(doctorReviews)
      .where(eq(doctorReviews.doctorId, doctorId));
    
    const reviewCount = await db
      .select({ count: count() })
      .from(doctorReviews)
      .where(eq(doctorReviews.doctorId, doctorId));

    await db
      .update(doctors)
      .set({
        rating: avgRating[0]?.avg ? avgRating[0].avg.toString() : null,
        reviewCount: reviewCount[0]?.count || 0,
        updatedAt: new Date(),
      })
      .where(eq(doctors.id, doctorId));
  }

  // Review helpfulness voting
  async toggleReviewHelpfulness(reviewId: string, userId: string, helpful: boolean): Promise<{ helpful: boolean; helpfulCount: number }> {
    // Check if user already voted
    const existingVote = await db
      .select()
      .from(reviewHelpfulnessVotes)
      .where(
        and(
          eq(reviewHelpfulnessVotes.reviewId, reviewId),
          eq(reviewHelpfulnessVotes.userId, userId)
        )
      )
      .limit(1);

    if (existingVote.length > 0) {
      const vote = existingVote[0];
      // If clicking the same vote, remove it (toggle off)
      if (vote.helpful === helpful) {
        await db
          .delete(reviewHelpfulnessVotes)
          .where(eq(reviewHelpfulnessVotes.id, vote.id));
      } else {
        // Update to opposite vote
        await db
          .update(reviewHelpfulnessVotes)
          .set({ helpful })
          .where(eq(reviewHelpfulnessVotes.id, vote.id));
      }
    } else {
      // Create new vote
      await db.insert(reviewHelpfulnessVotes).values({
        reviewId,
        userId,
        helpful,
      });
    }

    // Recalculate helpful count
    await this.updateReviewHelpfulCount(reviewId);

    // Get updated count
    const [review] = await db
      .select({ helpfulCount: doctorReviews.helpfulCount })
      .from(doctorReviews)
      .where(eq(doctorReviews.id, reviewId))
      .limit(1);

    return {
      helpful: existingVote.length > 0 && existingVote[0].helpful === helpful ? false : helpful,
      helpfulCount: review?.helpfulCount || 0,
    };
  }

  async getUserReviewVote(reviewId: string, userId: string): Promise<boolean | null> {
    const [vote] = await db
      .select()
      .from(reviewHelpfulnessVotes)
      .where(
        and(
          eq(reviewHelpfulnessVotes.reviewId, reviewId),
          eq(reviewHelpfulnessVotes.userId, userId)
        )
      )
      .limit(1);

    return vote ? vote.helpful : null;
  }

  private async updateReviewHelpfulCount(reviewId: string): Promise<void> {
    const helpfulCount = await db
      .select({ count: count() })
      .from(reviewHelpfulnessVotes)
      .where(
        and(
          eq(reviewHelpfulnessVotes.reviewId, reviewId),
          eq(reviewHelpfulnessVotes.helpful, true)
        )
      );

    await db
      .update(doctorReviews)
      .set({ helpfulCount: helpfulCount[0]?.count || 0 })
      .where(eq(doctorReviews.id, reviewId));
  }

  // Forum operations
  async getForumPosts(category?: string, limit = 20, userId?: string): Promise<(ForumPost & { user: User; commentCount: number; reactions?: Record<string, number>; userReaction?: string })[]> {
    const conditions = category ? [eq(forumPosts.category, category)] : [];
    
    const posts = await db
      .select({
        post: forumPosts,
        user: users,
        commentCount: sql<number>`CAST(COUNT(DISTINCT ${forumComments.id}) AS INTEGER)`,
      })
      .from(forumPosts)
      .leftJoin(users, eq(forumPosts.userId, users.id))
      .leftJoin(forumComments, eq(forumPosts.id, forumComments.postId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(forumPosts.id, users.id)
      .orderBy(desc(forumPosts.createdAt))
      .limit(limit);

    // Get reactions for all posts
    const postIds = posts.map((row: any) => row.post.id);
    const allReactions = postIds.length > 0 ? await db
      .select()
      .from(forumPostReactions)
      .where(inArray(forumPostReactions.postId, postIds)) : [];

    // Aggregate reactions by post and type
    const reactionsByPost = new Map<string, Record<string, number>>();
    const userReactionsByPost = new Map<string, string>();
    
    for (const reaction of allReactions) {
      // Aggregate counts
      if (!reactionsByPost.has(reaction.postId)) {
        reactionsByPost.set(reaction.postId, {});
      }
      const counts = reactionsByPost.get(reaction.postId)!;
      counts[reaction.reaction] = (counts[reaction.reaction] || 0) + 1;
      
      // Track user's reaction
      if (userId && reaction.userId === userId) {
        userReactionsByPost.set(reaction.postId, reaction.reaction);
      }
    }

    return posts.map((row: { post: ForumPost; user: User | null; commentCount: number }) => ({
      ...row.post,
      user: row.user!,
      commentCount: row.commentCount,
      reactions: reactionsByPost.get(row.post.id) || {},
      userReaction: userId ? userReactionsByPost.get(row.post.id) : undefined,
    }));
  }

  async getForumPost(id: string): Promise<(ForumPost & { user: User }) | undefined> {
    const [result] = await db
      .select({
        post: forumPosts,
        user: users,
      })
      .from(forumPosts)
      .leftJoin(users, eq(forumPosts.userId, users.id))
      .where(eq(forumPosts.id, id));

    if (!result) return undefined;

    return {
      ...result.post,
      user: result.user!,
    };
  }

  async createForumPost(post: InsertForumPost): Promise<ForumPost> {
    const [newPost] = await db.insert(forumPosts).values(post).returning();
    return newPost;
  }

  async deleteForumPost(id: string, userId: string): Promise<void> {
    // First verify the user owns the post
    const post = await db.select().from(forumPosts).where(eq(forumPosts.id, id)).limit(1);
    if (!post.length || post[0].userId !== userId) {
      throw new Error("Unauthorized: Cannot delete this post");
    }
    
    // Delete associated comments first
    await db.delete(forumComments).where(eq(forumComments.postId, id));
    
    // Then delete the post
    await db.delete(forumPosts).where(eq(forumPosts.id, id));
  }

  async getForumComments(postId: string): Promise<(ForumComment & { user: User })[]> {
    const comments = await db
      .select({
        comment: forumComments,
        user: users,
      })
      .from(forumComments)
      .leftJoin(users, eq(forumComments.userId, users.id))
      .where(eq(forumComments.postId, postId))
      .orderBy(forumComments.createdAt);

    return comments.map((commentRow: { comment: ForumComment; user: User | null }) => ({
      ...commentRow.comment,
      user: commentRow.user!,
    }));
  }

  async createForumComment(comment: InsertForumComment): Promise<ForumComment> {
    const [newComment] = await db.insert(forumComments).values(comment).returning();
    return newComment;
  }

  async likeForumPost(postId: string): Promise<void> {
    await db
      .update(forumPosts)
      .set({ likes: sql`${forumPosts.likes} + 1`, updatedAt: new Date() })
      .where(eq(forumPosts.id, postId));
  }

  async reactToForumPost(postId: string, userId: string, reaction: string): Promise<void> {
    // Check if user already has a reaction for this post
    const existingReaction = await db
      .select()
      .from(forumPostReactions)
      .where(and(eq(forumPostReactions.postId, postId), eq(forumPostReactions.userId, userId)))
      .limit(1);

    if (existingReaction.length > 0) {
      // Update existing reaction
      await db
        .update(forumPostReactions)
        .set({ reaction, updatedAt: new Date() })
        .where(and(eq(forumPostReactions.postId, postId), eq(forumPostReactions.userId, userId)));
    } else {
      // Insert new reaction
      await db.insert(forumPostReactions).values({
        postId,
        userId,
        reaction,
      });
    }
  }

  // Direct messaging operations
  async sendDirectMessage(message: InsertDirectMessage): Promise<DirectMessage> {
    const [newMessage] = await db.insert(directMessages).values(message).returning();
    return newMessage;
  }

  async getConversations(userId: string): Promise<Array<{ otherUser: User; lastMessage: DirectMessage; unreadCount: number }>> {
    // Get all conversations where user is either sender or receiver
    const sentMessages = await db
      .select({
        message: directMessages,
        otherUserId: directMessages.receiverId,
      })
      .from(directMessages)
      .where(eq(directMessages.senderId, userId));

    const receivedMessages = await db
      .select({
        message: directMessages,
        otherUserId: directMessages.senderId,
      })
      .from(directMessages)
      .where(eq(directMessages.receiverId, userId));

    // Combine and group by other user
    const allMessages = [
      ...sentMessages.map(m => ({ ...m.message, otherUserId: m.otherUserId, isSent: true })),
      ...receivedMessages.map(m => ({ ...m.message, otherUserId: m.otherUserId, isSent: false })),
    ];

    // Group by otherUserId and get the last message for each conversation
    const conversationsMap = new Map<string, { lastMessage: DirectMessage; unreadCount: number }>();
    
    for (const msg of allMessages) {
      const otherUserId = msg.otherUserId;
      const existing = conversationsMap.get(otherUserId);
      
      if (!existing || new Date(msg.createdAt || 0) > new Date(existing.lastMessage.createdAt || 0)) {
        conversationsMap.set(otherUserId, {
          lastMessage: msg as DirectMessage,
          unreadCount: 0,
        });
      }
    }

    // Count unread messages for each conversation
    for (const [otherUserId] of conversationsMap) {
      const unreadCount = await db
        .select({ count: count() })
        .from(directMessages)
        .where(
          and(
            eq(directMessages.senderId, otherUserId),
            eq(directMessages.receiverId, userId),
            eq(directMessages.read, false)
          )
        );
      
      const conv = conversationsMap.get(otherUserId);
      if (conv) {
        conv.unreadCount = Number(unreadCount[0]?.count || 0);
      }
    }

    // Get user details for each conversation
    const otherUserIds = Array.from(conversationsMap.keys());
    if (otherUserIds.length === 0) {
      return [];
    }

    const otherUsers = await db
      .select()
      .from(users)
      .where(inArray(users.id, otherUserIds));

    const userMap = new Map(otherUsers.map(u => [u.id, u]));

    // Build result array
    const conversations = Array.from(conversationsMap.entries())
      .map(([otherUserId, data]) => ({
        otherUser: userMap.get(otherUserId)!,
        lastMessage: data.lastMessage,
        unreadCount: data.unreadCount,
      }))
      .filter(conv => conv.otherUser) // Filter out any missing users
      .sort((a, b) => {
        const dateA = new Date(a.lastMessage.createdAt || 0).getTime();
        const dateB = new Date(b.lastMessage.createdAt || 0).getTime();
        return dateB - dateA; // Most recent first
      });

    return conversations;
  }

  async getMessages(userId: string, otherUserId: string): Promise<(DirectMessage & { sender: User; receiver: User })[]> {
    // Get all users involved (userId and otherUserId)
    const allUserIds = [userId, otherUserId];
    const allUsers = await db
      .select()
      .from(users)
      .where(inArray(users.id, allUserIds));
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    // Get messages
    const messages = await db
      .select()
      .from(directMessages)
      .where(
        or(
          and(eq(directMessages.senderId, userId), eq(directMessages.receiverId, otherUserId)),
          and(eq(directMessages.senderId, otherUserId), eq(directMessages.receiverId, userId))
        )
      )
      .orderBy(asc(directMessages.createdAt));

    // Map messages with sender and receiver
    return messages.map((message) => ({
      ...message,
      sender: userMap.get(message.senderId)!,
      receiver: userMap.get(message.receiverId)!,
    }));
  }

  async markMessagesAsRead(userId: string, senderId: string): Promise<void> {
    await db
      .update(directMessages)
      .set({ read: true })
      .where(
        and(
          eq(directMessages.senderId, senderId),
          eq(directMessages.receiverId, userId),
          eq(directMessages.read, false)
        )
      );
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(directMessages)
      .where(
        and(
          eq(directMessages.receiverId, userId),
          eq(directMessages.read, false)
        )
      );
    
    return Number(result[0]?.count || 0);
  }

  // Chat operations
  async getUserChatMessages(userId: string, limit = 50): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(chatMessages.createdAt)
      .limit(limit);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    return newMessage;
  }

  // Event logging operations
  async getUserEvents(userId: string): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .where(eq(events.userId, userId))
      .orderBy(desc(events.date), desc(events.createdAt));
  }

  async getCycleEvents(cycleId: string): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .where(eq(events.cycleId, cycleId))
      .orderBy(desc(events.date), desc(events.createdAt));
  }

  async getEventById(id: string): Promise<Event | undefined> {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, id));
    return event;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async updateEvent(id: string, data: Partial<Event>): Promise<Event> {
    const [updatedEvent] = await db
      .update(events)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return updatedEvent;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  // Cycle summary operations
  async getCycleSummary(cycleId: string): Promise<{
    cycle: Cycle;
    medications: Medication[];
    symptoms: Symptom[];
    testResults: TestResult[];
    milestones: Milestone[];
    appointments: Appointment[];
    events: Event[];
  }> {
    // Get cycle
    const cycle = await this.getCycleById(cycleId);
    if (!cycle) {
      throw new Error("Cycle not found");
    }

    // Get all related data
    const [medications, symptoms, testResults, milestones, appointments, cycleEvents] = await Promise.all([
      this.getCycleMedications(cycleId),
      this.getCycleSymptoms(cycleId),
      this.getCycleTestResults(cycleId),
      this.getCycleMilestones(cycleId),
      this.getCycleAppointments(cycleId),
      this.getCycleEvents(cycleId),
    ]);

    return {
      cycle,
      medications,
      symptoms,
      testResults,
      milestones,
      appointments,
      events: cycleEvents,
    };
  }

  async exportUserData(userId: string): Promise<{
    user: User;
    cycles: Cycle[];
    medications: Medication[];
    medicationLogs: MedicationLog[];
    symptoms: Symptom[];
    testResults: TestResult[];
    appointments: Appointment[];
    milestones: Milestone[];
    events: Event[];
    forumPosts: ForumPost[];
    forumComments: ForumComment[];
    chatMessages: ChatMessage[];
    doctorReviews: DoctorReview[];
  }> {
    // Get user - CRITICAL: Verify user exists before exporting
    const user = await this.getUser(userId);
    if (!user) {
      console.error(`[Storage] User ${userId} not found - cannot export data`);
      throw new Error("User not found - account may have been deleted");
    }

    // Get all cycles for user
    const userCycles = await this.getUserCycles(userId);
    const cycleIds = userCycles.map(c => c.id);

    // Get all related data
    const [
      allMedications,
      allSymptoms,
      allTestResults,
      allAppointments,
      allMilestones,
      allEvents,
      userForumPosts,
      userForumComments,
      userChatMessages,
      userDoctorReviews,
    ] = await Promise.all([
      // Get all medications for all cycles
      cycleIds.length > 0
        ? db
            .select()
            .from(medications)
            .where(inArray(medications.cycleId, cycleIds))
        : Promise.resolve([]),
      
      // Get all symptoms for all cycles
      cycleIds.length > 0
        ? db
            .select()
            .from(symptoms)
            .where(inArray(symptoms.cycleId, cycleIds))
        : Promise.resolve([]),
      
      // Get all test results for all cycles
      cycleIds.length > 0
        ? db
            .select()
            .from(testResults)
            .where(inArray(testResults.cycleId, cycleIds))
        : Promise.resolve([]),
      
      // Get all appointments for all cycles
      cycleIds.length > 0
        ? db
            .select()
            .from(appointments)
            .where(inArray(appointments.cycleId, cycleIds))
        : Promise.resolve([]),
      
      // Get all milestones for all cycles
      cycleIds.length > 0
        ? db
            .select()
            .from(milestones)
            .where(inArray(milestones.cycleId, cycleIds))
        : Promise.resolve([]),
      
      // Get all events for user
      this.getUserEvents(userId),
      
      // Get all forum posts by user
      db
        .select()
        .from(forumPosts)
        .where(eq(forumPosts.userId, userId)),
      
      // Get all forum comments by user
      db
        .select()
        .from(forumComments)
        .where(eq(forumComments.userId, userId)),
      
      // Get all chat messages by user
      this.getUserChatMessages(userId, 10000), // Get all messages
      
      // Get all doctor reviews by user
      db
        .select()
        .from(doctorReviews)
        .where(eq(doctorReviews.userId, userId)),
    ]);

    // Get medication logs properly (after we have medications)
    const medicationIds = allMedications.map((medication: Medication) => medication.id);
    const finalMedicationLogs = medicationIds.length > 0
      ? await db
          .select()
          .from(medicationLogs)
          .where(inArray(medicationLogs.medicationId, medicationIds))
      : [];

    return {
      user,
      cycles: userCycles,
      medications: allMedications,
      medicationLogs: finalMedicationLogs,
      symptoms: allSymptoms,
      testResults: allTestResults,
      appointments: allAppointments,
      milestones: allMilestones,
      events: allEvents,
      forumPosts: userForumPosts,
      forumComments: userForumComments,
      chatMessages: userChatMessages,
      doctorReviews: userDoctorReviews,
    };
  }

  private toTitleCase(value: string): string {
    return value
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private buildTipsFromTemplate(template: CycleStageTemplate): string[] {
    const sources = [template.monitoringProcedures, template.patientInsights]
      .map((value) => (value || "").trim())
      .filter(Boolean);

    if (!sources.length) {
      return [];
    }

    return sources
      .flatMap((source) =>
        source
          .split(/[\.\n]+/)
          .map((tip) => tip.trim())
          .filter((tip) => tip.length > 0),
      )
      .slice(0, 6);
  }

  private calculateMilestoneDateString(startDate: string | Date, day: number): string {
    const base = new Date(startDate);
    if (Number.isNaN(base.getTime())) {
      if (typeof startDate === "string") {
        return startDate;
      }
      return new Date().toISOString().split("T")[0];
    }
    // Handle negative days (pre-cycle milestones) and positive days
    const offset = day < 0 ? day : Math.max(day, 1) - 1;
    base.setDate(base.getDate() + offset);
    return base.toISOString().split("T")[0];
  }

  private mapStageToMilestoneType(stage: string): string {
    const normalized = stage.toLowerCase();

    if (normalized.includes("stimulation")) return "stimulation-start";
    if (normalized.includes("monitoring") || normalized.includes("scan")) return "monitoring";
    if (normalized.includes("trigger")) return "trigger-shot";
    if (normalized.includes("collection")) return "egg-collection";
    if (
      normalized.includes("pregnancy") &&
      (normalized.includes("blood") || normalized.includes("beta"))
    ) {
      return "beta-test";
    }
    if (normalized.includes("frozen") && normalized.includes("transfer")) return "frozen-transfer";
    if (normalized.includes("transfer")) return "embryo-transfer";
    if (normalized.includes("lining")) return "monitoring";
    if (normalized.includes("follicle")) return "monitoring";
    if (normalized.includes("fertilisation") || normalized.includes("fertilization")) return "fertilisation";
    if (normalized.includes("luteal")) return "luteal-phase";
    if (normalized.includes("menstrual") || normalized.includes("period")) return "cycle-start";
    if (normalized.includes("iui")) return "iui-procedure";
    if (normalized.includes("insemination")) return "iui-procedure";
    if (normalized.includes("ovulation") && normalized.includes("induction")) return "stimulation-start";
    if (normalized.includes("counselling") || normalized.includes("counseling")) return "counselling";
    if (normalized.includes("donor") && normalized.includes("screening")) return "donor-screening";
    if (normalized.includes("waiting") && normalized.includes("period")) return "waiting-period";

    return normalized
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private buildMilestoneNotes(_template: CycleStageTemplate): string {
    // Do not prefill milestone notes; keep this for user-entered notes only.
    return "";
  }

  private async createTemplateMilestonesForCycle(cycle: Cycle): Promise<void> {
    const cycleStartDate = cycle.startDate ? new Date(cycle.startDate) : null;
    if (!cycleStartDate || Number.isNaN(cycleStartDate.getTime())) {
      return;
    }

    const [existing] =
      (await db
        .select({ count: count() })
        .from(milestones)
        .where(eq(milestones.cycleId, cycle.id))
        .limit(1)) || [];
    const existingCount = existing ? Number(existing.count) : 0;
    if (existingCount > 0) {
      return;
    }

    const normalizedType = cycle.type?.toLowerCase().replace(/-/g, "_");
    if (!normalizedType) {
      return;
    }

    const templateKey = normalizedType === "fet" ? "ivf_frozen" : normalizedType;

    // Get base cycle milestones
    let templateStages: CycleStageTemplate[] = await db
      .select()
      .from(cycleStageTemplates)
      .where(eq(cycleStageTemplates.cycleType, templateKey))
      .orderBy(
        asc(cycleStageTemplates.dayStart),
        asc(cycleStageTemplates.stage),
      );

    // Egg Freezing should include all milestones from the template

    // Add donor conception milestones if applicable
    if (cycle.donorConception) {
      const donorStages: CycleStageTemplate[] = await db
        .select()
        .from(cycleStageTemplates)
        .where(eq(cycleStageTemplates.cycleType, "donor_conception"))
        .orderBy(asc(cycleStageTemplates.dayStart), asc(cycleStageTemplates.stage));

      // Combine donor milestones (pre-cycle) with cycle milestones
      templateStages = [...donorStages, ...templateStages];
    }

    if (!templateStages.length) {
      return;
    }

    const values: InsertMilestone[] = templateStages.map((template: CycleStageTemplate) => {
      const notes = this.buildMilestoneNotes(template);
      return {
        cycleId: cycle.id,
        type: this.mapStageToMilestoneType(template.stage),
        title: template.stage,
        date: this.calculateMilestoneDateString(cycleStartDate, template.dayStart || 1),
        status: "pending",
        notes: notes || undefined,
      };
    });

    await db.insert(milestones).values(values);
  }

  async deleteUserData(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  async getCommunityArticles(): Promise<CommunityArticle[]> {
    await ensureDbInitialized();
    const articles = await db
      .select()
      .from(communityArticles)
      .orderBy(asc(communityArticles.displayOrder), asc(communityArticles.createdAt));
    return articles;
  }

  async ensureCommunityArticlesSeeded(): Promise<void> {
    await ensureDbInitialized();
    
    const articles: InsertCommunityArticle[] = [
      {
        id: "ivf-process",
        title: "A guide to the IVF Process",
        summary: "Detailed guide for what to expect with an IVF process",
        url: "https://yourivfsuccess.com.au/about-ivf-treatment/process",
        category: "IVF",
        tags: ["IVF"],
        displayOrder: 1,
      },
      {
        id: "egg-retrieval",
        title: "Egg retrieval: what to expect & recovery",
        summary: "Detailed guide to an egg retrieval",
        url: "https://www.newlifeivf.com.au/your-guide-to-a-successful-egg-collection/?utm_source=chatgpt.com",
        category: "Egg",
        tags: ["Egg"],
        displayOrder: 2,
      },
      {
        id: "embryo-grading",
        title: "Embryo culture and grading (full guide)",
        summary: "Explanation of embryo grading according to Adora fertility",
        url: "https://www.adorafertility.com.au/how-embryos-are-graded/?utm_source=chatgpt.com",
        category: "Embryo",
        tags: ["Egg", "Embryo"],
        displayOrder: 3,
      },
      {
        id: "fet",
        title: "Frozen Embryo Transfers",
        summary: "What is a frozen embryo transfer",
        url: "https://www.lifefertility.com.au/resources/factsheets/frozen-embryo-transfer/?utm_source=chatgpt.com",
        category: "FET",
        tags: ["Embryo", "FET", "Egg"],
        displayOrder: 4,
      },
      {
        id: "ohss",
        title: "What is OHSS",
        summary: "Information on OHSS",
        url: "https://www.mivf.com.au/sites/mivf/files/2020-08/MVF01%20OHSS%20Factsheet%20July%202020_2.pdf?utm_source=chatgpt.com",
        category: "OHSS",
        tags: ["OHSS", "retrieval", "IVF"],
        displayOrder: 5,
      },
      {
        id: "latest-findings",
        title: "Latest Research",
        summary: "Interested research from Virtus",
        url: "https://www.ivf.com.au/about-us/latest-research",
        category: "IVF",
        tags: ["IVF"],
        displayOrder: 6,
      },
      {
        id: "ai-algorithm",
        title: "New AI algorithm sparks hope for infertile men in Australia",
        summary: "IVF Australia's new AI algorithm sparks hope for infertile men in Australia",
        url: "https://www.ivf.com.au/blog/new-ai-algorithm-for-infertile-men",
        category: "AI",
        tags: ["IVF", "AI", "Males Infertility"],
        displayOrder: 7,
      },
      {
        id: "art-intelligence",
        title: "How artificial intelligence is improving IVF outcomes",
        summary: "How artificial intelligence is improving IVF outcomes",
        url: "https://www.ivf.com.au/blog/improving-IVF-success-artificial-intelligence",
        category: "AI",
        tags: ["AI"],
        displayOrder: 8,
      },
      {
        id: "embryo-culture",
        title: "Embryo Culture Environmental Impacts",
        summary: "Does single embryo culture under atmospheric or reduced oxygen alter preimplantation metabolism and post-implantation development compared with culture in groups?",
        url: "https://www.ivf.com.au/about-us/latest-research/individual-culture-and-atmospheric-oxygen-during-culture",
        category: "Embryo",
        tags: ["Embryo"],
        displayOrder: 9,
      },
      {
        id: "success-rates",
        title: "Success rates",
        summary: "Success rates of IVF",
        url: "https://www.ivf.com.au/success-rates/ivf-success-rates",
        category: "IVF",
        tags: ["Success", "IVF"],
        displayOrder: 10,
      },
      {
        id: "fvr",
        title: "Frozen is as good as fresh",
        summary: "New Australian study is good news for women who are thinking about freezing their eggs",
        url: "https://www.virtushealth.com.au/investor-centre/asx-announcements/frozen-is-as-good-as-fresh-new-australian-study-is-good-news-for-women-who-are-thinking-about",
        category: "FET",
        tags: ["Embryo", "FET", "Egg"],
        displayOrder: 11,
      },
      {
        id: "miscarriages",
        title: "Understanding Miscarriages",
        summary: "Detailed explanation of miscarriages",
        url: "https://www.thewomens.org.au/health-information/pregnancy-and-birth/pregnancy-problems/early-pregnancy-problems/miscarriage",
        category: "Miscarriage",
        tags: ["Miscarriage"],
        displayOrder: 12,
      },
      {
        id: "what-is-dnc",
        title: "What to expect at a D&C",
        summary: "What you can expect when having a D&C",
        url: "https://www.mayoclinic.org/tests-procedures/dilation-and-curettage/about/pac-20384910",
        category: "Miscarriage",
        tags: ["Miscarriage"],
        displayOrder: 13,
      },
      {
        id: "recurring-misc",
        title: "Recurrent Miscarriage",
        summary: "What recurrent miscarriages may mean",
        url: "https://miscarriageaustralia.com.au/understanding-miscarriage/recurrent-miscarriage/",
        category: "Miscarriage",
        tags: ["Miscarriage"],
        displayOrder: 14,
      },
      {
        id: "icsi",
        title: "IVF vs ICSI",
        summary: "Difference between IVF and ICSI",
        url: "https://access.org.au/wp-content/uploads/2010/01/17-ivf-and-icsi.pdf",
        category: "IVF",
        tags: ["IVF", "ICSI"],
        displayOrder: 15,
      },
      {
        id: "fertility-nutrition",
        title: "Nutrition and Fertility",
        summary: "How diet and nutrition can impact fertility and IVF success rates",
        url: "https://www.ivf.com.au/blog/nutrition-and-fertility",
        category: "Nutrition",
        tags: ["Nutrition", "Fertility", "IVF"],
        displayOrder: 16,
      },
    ];

    // Check existing articles count
    const existing = await db.select().from(communityArticles);
    const existingIds = new Set<string>(existing.map((a: CommunityArticle) => a.id));
    
    // Only insert articles that don't exist
    const articlesToInsert = articles.filter(article => !existingIds.has(article.id));
    
    if (articlesToInsert.length > 0) {
      try {
        await db.insert(communityArticles).values(articlesToInsert);
        console.log(`[Storage] Seeded ${articlesToInsert.length} new community articles (${existing.length} already existed, ${articles.length} total expected)`);
      } catch (error: any) {
        // If articles already exist (race condition), that's fine
        if (error?.code !== '23505') { // PostgreSQL unique violation
          throw error;
        }
        console.log(`[Storage] Community articles already seeded`);
      }
    } else {
      console.log(`[Storage] All ${articles.length} community articles already exist`);
    }
  }

  // Educational Articles methods
  async getEducationalArticles(filters?: {
    phase?: string;
    cycleType?: string;
    cycleDay?: number;
    limit?: number;
    featured?: boolean;
  }): Promise<EducationalArticle[]> {
    await ensureDbInitialized();

    const conditions: any[] = [];

    if (filters?.featured !== undefined) {
      conditions.push(eq(educationalArticles.featured, filters.featured));
    }

    let query = db.select().from(educationalArticles);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    // Order by featured first, then by created date
    query = query.orderBy(
      desc(educationalArticles.featured),
      desc(educationalArticles.createdAt)
    ) as any;

    let articles = await query;

    // Filter by phase and cycleType in JavaScript (since array contains is complex in Drizzle)
    if (filters?.phase) {
      const phaseSlug = filters.phase.toLowerCase().replace(/\s+/g, '-');
      articles = articles.filter(article => {
        if (!article.phases || article.phases.length === 0) return true;
        return article.phases.includes('all') || 
               article.phases.some(p => p.toLowerCase() === phaseSlug || p.toLowerCase().includes(phaseSlug));
      });
    }

    if (filters?.cycleType) {
      // Normalize cycle type (handle both 'ivf-fresh' and 'ivf_fresh' formats)
      const normalizedCycleType = filters.cycleType.toLowerCase().replace(/-/g, '_');
      const dashCycleType = filters.cycleType.toLowerCase().replace(/_/g, '-');
      
      articles = articles.filter(article => {
        if (!article.cycleTypes || article.cycleTypes.length === 0) return true;
        return article.cycleTypes.includes('all') || 
               article.cycleTypes.some(ct => {
                 const normalized = ct.toLowerCase().replace(/-/g, '_');
                 const dash = ct.toLowerCase().replace(/_/g, '-');
                 return normalized === normalizedCycleType || dash === dashCycleType;
               });
      });
    }

    // Apply limit if specified
    if (filters?.limit) {
      articles = articles.slice(0, filters.limit);
    }

    return articles;
  }

  async getEducationalArticleBySlug(slug: string): Promise<EducationalArticle | undefined> {
    await ensureDbInitialized();
    const [article] = await db
      .select()
      .from(educationalArticles)
      .where(eq(educationalArticles.slug, slug))
      .limit(1);
    return article;
  }

  async getAllEducationalArticles(): Promise<EducationalArticle[]> {
    await ensureDbInitialized();
    return await db
      .select()
      .from(educationalArticles)
      .orderBy(desc(educationalArticles.featured), desc(educationalArticles.createdAt));
  }

  async createEducationalArticle(article: InsertEducationalArticle): Promise<EducationalArticle> {
    await ensureDbInitialized();
    const [created] = await db
      .insert(educationalArticles)
      .values(article)
      .returning();
    return created;
  }

  async ensureEducationalArticlesSeeded(): Promise<void> {
    await ensureDbInitialized();

    const [existing] = await db
      .select({ count: count() })
      .from(educationalArticles)
      .limit(1);

    const existingCount = existing ? Number(existing.count) : 0;
    if (existingCount > 0) {
      console.log(`[Storage] Educational articles already seeded (${existingCount} found)`);
      return;
    }

    console.log(`[Storage] Attempting to seed ${EDUCATIONAL_CONTENT_SEED.length} educational articles`);
    try {
      let inserted = 0;
      let skipped = 0;
      
      for (const article of EDUCATIONAL_CONTENT_SEED) {
        try {
          // Check if exists first
          const [existing] = await db
            .select()
            .from(educationalArticles)
            .where(eq(educationalArticles.slug, article.slug))
            .limit(1);
          
          if (existing) {
            skipped++;
            continue;
          }

          await db.insert(educationalArticles).values(article);
          inserted++;
        } catch (error: any) {
          // If article already exists (race condition), that's fine
          if (error?.code === '23505') { // PostgreSQL unique violation
            skipped++;
          } else {
            console.error(`[Storage] Error inserting article ${article.slug}:`, error);
            throw error;
          }
        }
      }

      console.log(`[Storage] Educational articles seeding complete: ${inserted} inserted, ${skipped} skipped, ${EDUCATIONAL_CONTENT_SEED.length} total`);
    } catch (error: any) {
      console.error("[Storage] Error seeding educational articles:", error);
      // Don't throw - allow server to continue even if seeding fails
    }
  }

  // Reference data operations
  async getTreatmentTypes(): Promise<TreatmentType[]> {
    return await db
      .select()
      .from(treatmentTypes)
      .where(eq(treatmentTypes.active, true))
      .orderBy(treatmentTypes.displayOrder, treatmentTypes.label);
  }

  async getClinics(): Promise<Clinic[]> {
    return await db
      .select()
      .from(clinics)
      .where(eq(clinics.active, true))
      .orderBy(clinics.displayOrder, clinics.name);
  }

  async getCycleTypes(): Promise<CycleType[]> {
    return await db
      .select()
      .from(cycleTypes)
      .where(eq(cycleTypes.active, true))
      .orderBy(asc(cycleTypes.displayOrder));
  }

  async getEventTypes(): Promise<EventType[]> {
    return await db
      .select()
      .from(eventTypes)
      .where(eq(eventTypes.active, true))
      .orderBy(eventTypes.displayOrder, eventTypes.label);
  }

  async getMilestoneTypes(cycleType?: string): Promise<MilestoneType[]> {
    const conditions = [eq(milestoneTypes.active, true)];
    if (cycleType) {
      conditions.push(eq(milestoneTypes.cycleType, cycleType));
    }

    return await db
      .select()
      .from(milestoneTypes)
      .where(and(...conditions))
      .orderBy(milestoneTypes.displayOrder, milestoneTypes.label);
  }

  async ensureReferenceDataSeeded(): Promise<void> {
    // Seed treatment types - Updated from Excel/Clinical Document
    const treatmentTypesData = [
      { id: "ivf", label: "IVF", description: "In Vitro Fertilization", displayOrder: 1 },
      { id: "iui", label: "IUI", description: "Intrauterine Insemination", displayOrder: 2 },
      { id: "fet", label: "Frozen Embryo Transfer", description: "Frozen Embryo Transfer (FET)", displayOrder: 3 },
      { id: "egg-freezing", label: "Egg Freezing", description: "Fertility Preservation", displayOrder: 4 },
      { id: "donor-conception", label: "Donor Conception", description: "Conception using donor sperm or eggs", displayOrder: 5 },
    ];

    for (const item of treatmentTypesData) {
      try {
        await db.insert(treatmentTypes).values(item)
          .onConflictDoUpdate({
            target: treatmentTypes.id,
            set: {
              label: item.label,
              description: item.description,
              displayOrder: item.displayOrder,
              updatedAt: new Date(),
            },
          });
      } catch (error: any) {
        console.error(`[Storage] Error upserting treatment type ${item.id}:`, error);
      }
    }

    // Seed clinics
    const clinicsData = [
      { id: "sydney-ivf", name: "Sydney IVF", displayOrder: 1 },
      { id: "monash-ivf", name: "Monash IVF", displayOrder: 2 },
      { id: "city-fertility", name: "City Fertility Centre", displayOrder: 3 },
      { id: "fertility-first", name: "Fertility First", displayOrder: 4 },
      { id: "genea", name: "Genea", displayOrder: 5 },
      { id: "virtus-health", name: "Virtus Health", displayOrder: 6 },
      { id: "adora-fertility", name: "Adora Fertility", displayOrder: 7 },
      { id: "other", name: "Other", displayOrder: 99 },
    ];

    for (const item of clinicsData) {
      try {
        await db.insert(clinics).values(item)
          .onConflictDoUpdate({
            target: clinics.id,
            set: {
              name: item.name,
              displayOrder: item.displayOrder,
              updatedAt: new Date(),
            },
          });
      } catch (error: any) {
        console.error(`[Storage] Error upserting clinic ${item.id}:`, error);
      }
    }

    // Seed cycle types - Updated from CSV data
    // Order: FET, IVF Cycle, IUI Cycle, Egg Freezing
    const cycleTypesData = [
      { id: "ivf-frozen", label: "FET", displayOrder: 1, active: true },
      { id: "ivf-fresh", label: "IVF Cycle", displayOrder: 2, active: true },
      { id: "iui", label: "IUI Cycle", displayOrder: 3, active: true },
      { id: "egg-freezing", label: "Egg Freezing", displayOrder: 4, active: true },
    ];

    // Deactivate unwanted cycle types
    const unwantedCycleTypes = ["donor-conception", "monitoring", "natural"];
    for (const id of unwantedCycleTypes) {
      try {
        await db.update(cycleTypes)
          .set({ active: false, updatedAt: new Date() })
          .where(eq(cycleTypes.id, id));
      } catch (error: any) {
        // Ignore if cycle type doesn't exist
      }
    }

    // Upsert the active cycle types
    for (const item of cycleTypesData) {
      try {
        await db.insert(cycleTypes).values(item)
          .onConflictDoUpdate({
            target: cycleTypes.id,
            set: {
              label: item.label,
              displayOrder: item.displayOrder,
              active: item.active,
              updatedAt: new Date(),
            },
          });
      } catch (error: any) {
        console.error(`[Storage] Error upserting cycle type ${item.id}:`, error);
      }
    }

    // Seed event types
    const eventTypesData = [
      { id: "doctor_visit", label: "Clinic appointment", displayOrder: 1 },
      { id: "test_result", label: "Lab or monitoring", displayOrder: 2 },
      { id: "procedure", label: "Procedure", displayOrder: 3 },
      { id: "medication", label: "Medication reminder", displayOrder: 4 },
      { id: "general_note", label: "Other", displayOrder: 5 },
    ];

    for (const item of eventTypesData) {
      try {
        await db.insert(eventTypes).values(item)
          .onConflictDoUpdate({
            target: eventTypes.id,
            set: {
              label: item.label,
              displayOrder: item.displayOrder,
              updatedAt: new Date(),
            },
          });
      } catch (error: any) {
        console.error(`[Storage] Error upserting event type ${item.id}:`, error);
      }
    }

    // Seed milestone types - Updated from CSV data (column E: milestone_name)
    const milestoneTypesData = [
      // IVF Cycle milestones (from CSV)
      { id: "ivf-day1-period", cycleType: "ivf-fresh", label: "Cycle day 1", displayOrder: 1 },
      { id: "ivf-baseline-bloods", cycleType: "ivf-fresh", label: "Baseline blood test", displayOrder: 2 },
      { id: "ivf-stimulation-start", cycleType: "ivf-fresh", label: "Stimulation injections start", displayOrder: 3 },
      { id: "ivf-monitoring-bloods", cycleType: "ivf-fresh", label: "Monitoring blood test", displayOrder: 4 },
      { id: "ivf-monitoring-scan", cycleType: "ivf-fresh", label: "Monitoring ultrasound", displayOrder: 5 },
      { id: "ivf-antagonist-start", cycleType: "ivf-fresh", label: "Antagonist injections start", displayOrder: 6 },
      { id: "ivf-trigger", cycleType: "ivf-fresh", label: "Trigger injection", displayOrder: 7 },
      { id: "ivf-egg-retrieval", cycleType: "ivf-fresh", label: "Egg retrieval", displayOrder: 8 },
      { id: "ivf-embryo-transfer", cycleType: "ivf-fresh", label: "Embryo transfer", displayOrder: 9 },
      { id: "ivf-embryo-freeze", cycleType: "ivf-fresh", label: "Embryos frozen", displayOrder: 10 },
      { id: "ivf-pregnancy-test", cycleType: "ivf-fresh", label: "Pregnancy blood test", displayOrder: 11 },
      // FET milestones (from CSV - column E)
      { id: "fet-day1-period", cycleType: "ivf-frozen", label: "Cycle day 1", displayOrder: 1 },
      { id: "fet-monitoring-bloods", cycleType: "ivf-frozen", label: "Monitoring blood test", displayOrder: 2 },
      { id: "fet-monitoring-scan", cycleType: "ivf-frozen", label: "Monitoring ultrasound", displayOrder: 3 },
      { id: "fet-lh-ov", cycleType: "ivf-frozen", label: "Ovulation detected", displayOrder: 4 },
      { id: "fet-trigger", cycleType: "ivf-frozen", label: "Medication starts", displayOrder: 5 },
      { id: "fet-transfer", cycleType: "ivf-frozen", label: "Embryo transfer", displayOrder: 6 },
      { id: "fet-pregnancy-test", cycleType: "ivf-frozen", label: "Pregnancy blood test", displayOrder: 7 },
      // IUI Cycle milestones (from CSV)
      { id: "iui-day1-period", cycleType: "iui", label: "Cycle day 1", displayOrder: 1 },
      { id: "iui-baseline-bloods", cycleType: "iui", label: "Baseline blood test", displayOrder: 2 },
      { id: "iui-monitoring-bloods", cycleType: "iui", label: "Monitoring blood test", displayOrder: 3 },
      { id: "iui-monitoring-scan", cycleType: "iui", label: "Monitoring ultrasound", displayOrder: 4 },
      { id: "iui-trigger", cycleType: "iui", label: "Trigger injection", displayOrder: 5 },
      { id: "iui-insemination", cycleType: "iui", label: "Insemination (IUI)", displayOrder: 6 },
      { id: "iui-progesterone-start", cycleType: "iui", label: "Medication starts", displayOrder: 7 },
      { id: "iui-pregnancy-test", cycleType: "iui", label: "Pregnancy blood test", displayOrder: 8 },
      // Egg Freezing milestones (from CSV)
      { id: "egg-freez-day1-period", cycleType: "egg-freezing", label: "Cycle day 1", displayOrder: 1 },
      { id: "egg-freez-baseline-bloods", cycleType: "egg-freezing", label: "Baseline blood test", displayOrder: 2 },
      { id: "egg-freez-stimulation-start", cycleType: "egg-freezing", label: "Stimulation injections start", displayOrder: 3 },
      { id: "egg-freez-monitoring-bloods", cycleType: "egg-freezing", label: "Monitoring blood test", displayOrder: 4 },
      { id: "egg-freez-monitoring-scan", cycleType: "egg-freezing", label: "Monitoring ultrasound", displayOrder: 5 },
      { id: "egg-freez-antagonist-start", cycleType: "egg-freezing", label: "Antagonist injections start", displayOrder: 6 },
      { id: "egg-freez-trigger", cycleType: "egg-freezing", label: "Trigger injection", displayOrder: 7 },
      { id: "egg-freez-retrieval", cycleType: "egg-freezing", label: "Egg retrieval", displayOrder: 8 },
      { id: "egg-freez-egg-freeze", cycleType: "egg-freezing", label: "Eggs frozen", displayOrder: 9 },
    ];

    const allowedMilestoneTypeIds = new Set(milestoneTypesData.map((item) => item.id));
    const allowedCycleTypes = new Set(["ivf-fresh", "ivf-frozen", "iui", "egg-freezing"]);
    const existingMilestoneTypes = await db
      .select({ id: milestoneTypes.id, cycleType: milestoneTypes.cycleType })
      .from(milestoneTypes);

    for (const existingType of existingMilestoneTypes) {
      if (allowedCycleTypes.has(existingType.cycleType) && !allowedMilestoneTypeIds.has(existingType.id)) {
        try {
          await db
            .update(milestoneTypes)
            .set({ active: false, updatedAt: new Date() })
            .where(eq(milestoneTypes.id, existingType.id));
        } catch (error: any) {
          // Ignore if milestone type doesn't exist or update fails
        }
      }
    }

    const unwantedMilestoneTypes = ["fet-progesterone-start"];
    for (const id of unwantedMilestoneTypes) {
      try {
        await db.update(milestoneTypes)
          .set({ active: false, updatedAt: new Date() })
          .where(eq(milestoneTypes.id, id));
      } catch (error: any) {
        // Ignore if milestone type doesn't exist
      }
    }

    for (const item of milestoneTypesData) {
      try {
        await db.insert(milestoneTypes).values(item)
          .onConflictDoUpdate({
            target: milestoneTypes.id,
            set: {
              cycleType: item.cycleType,
              label: item.label,
              displayOrder: item.displayOrder,
              updatedAt: new Date(),
            },
          });
      } catch (error: any) {
        console.error(`[Storage] Error upserting milestone type ${item.id}:`, error);
      }
    }

    console.log("[Storage] Reference data seeding complete");
  }

  async getContentBlocks(cycleTemplateId?: string): Promise<ContentBlock[]> {
    await ensureDbInitialized();
    const baseQuery = db.select().from(contentBlocks);

    const records = cycleTemplateId
      ? await baseQuery
          .where(eq(contentBlocks.cycleTemplateId, cycleTemplateId))
          .orderBy(asc(contentBlocks.milestoneOrder), asc(contentBlocks.milestoneName))
      : await baseQuery.orderBy(
          asc(contentBlocks.cycleTemplateId),
          asc(contentBlocks.milestoneOrder),
          asc(contentBlocks.milestoneName),
        );

    return records;
  }

  async getContentBlockByMilestone(
    cycleTemplateId: string,
    milestoneName: string,
  ): Promise<ContentBlock | undefined> {
    await ensureDbInitialized();
    const [block] = await db
      .select()
      .from(contentBlocks)
      .where(
        and(
          eq(contentBlocks.cycleTemplateId, cycleTemplateId),
          ilike(contentBlocks.milestoneName, milestoneName),
        ),
      )
      .limit(1);
    return block;
  }

  async ensureContentBlocksSeeded(): Promise<void> {
    await ensureDbInitialized();

    const csvPath = path.resolve(
      process.cwd(),
      "datafiles",
      "IVF App Data - ContentBlocks.csv",
    );

    let csvText = "";
    try {
      csvText = await fs.readFile(csvPath, "utf8");
    } catch (error) {
      console.error("[Storage] Unable to read ContentBlocks CSV:", error);
      return;
    }

    const rows = parseCsvRows(csvText);
    if (rows.length < 2) {
      console.warn("[Storage] ContentBlocks CSV is empty");
      return;
    }

    const header = rows[0].map((value) => value.trim());
    const indexOf = (name: string) => header.indexOf(name);

    const idx = {
      milestoneId: indexOf("milestone_id"),
      cycleTemplateId: indexOf("cycle_template_id"),
      milestoneOrder: indexOf("milestone_order"),
      expectedDayOffset: indexOf("expected_day_offset"),
      milestoneName: indexOf("milestone_name"),
      milestoneType: indexOf("milestone_type"),
      notificationTitle: indexOf("notification_title"),
      milestoneDetails: indexOf("milestone_details"),
      medicalInformation: indexOf(
        "personalised insights (dashboard) - medical_information",
      ),
      whatToExpect: indexOf("personalised insights (dashboard) what_to_expect"),
      todaysTips: indexOf("personalised insights (dashboard) todays_tips"),
    };

    for (const row of rows.slice(1)) {
      const milestoneId = normalizeCsvValue(row[idx.milestoneId]);
      if (!milestoneId) continue;

      const milestoneOrderValue = Number(
        normalizeCsvValue(row[idx.milestoneOrder]) || 0,
      );
      const expectedDayOffsetValue = Number(
        normalizeCsvValue(row[idx.expectedDayOffset]) || 0,
      );

      const item: InsertContentBlock = {
        id: milestoneId,
        cycleTemplateId: normalizeCsvValue(row[idx.cycleTemplateId]),
        milestoneName: normalizeCsvValue(row[idx.milestoneName]),
        milestoneType: normalizeCsvValue(row[idx.milestoneType]) || null,
        notificationTitle: normalizeCsvValue(row[idx.notificationTitle]) || null,
        milestoneDetails: normalizeCsvValue(row[idx.milestoneDetails]) || null,
        medicalInformation: normalizeCsvValue(row[idx.medicalInformation]) || null,
        whatToExpect: normalizeCsvValue(row[idx.whatToExpect]) || null,
        todaysTips: normalizeCsvValue(row[idx.todaysTips]) || null,
        milestoneOrder: Number.isNaN(milestoneOrderValue)
          ? 0
          : milestoneOrderValue,
        expectedDayOffset: Number.isNaN(expectedDayOffsetValue)
          ? null
          : expectedDayOffsetValue,
      };

      try {
        await db
          .insert(contentBlocks)
          .values(item)
          .onConflictDoUpdate({
            target: contentBlocks.id,
            set: {
              cycleTemplateId: item.cycleTemplateId,
              milestoneName: item.milestoneName,
              milestoneType: item.milestoneType,
              notificationTitle: item.notificationTitle,
              milestoneDetails: item.milestoneDetails,
              medicalInformation: item.medicalInformation,
              whatToExpect: item.whatToExpect,
              todaysTips: item.todaysTips,
              milestoneOrder: item.milestoneOrder,
              expectedDayOffset: item.expectedDayOffset,
              updatedAt: new Date(),
            },
          });
      } catch (error) {
        console.error(
          `[Storage] Error upserting content block ${item.id}:`,
          error,
        );
      }
    }

    console.log("[Storage] Content blocks seeding complete");
  }

  async getStageReferenceData(forceRefresh = false): Promise<StageReferenceData[]> {
    if (this.stageReferenceCache && !forceRefresh) {
      return this.stageReferenceCache;
    }

    const csvPath = path.resolve(
      process.cwd(),
      "datafiles",
      "IVF App Data - Stages.csv",
    );

    let csvText = "";
    try {
      csvText = await fs.readFile(csvPath, "utf8");
    } catch (error) {
      console.error("[Storage] Unable to read Stages CSV:", error);
      this.stageReferenceCache = [];
      return this.stageReferenceCache;
    }

    const rows = parseCsvRows(csvText);
    if (rows.length < 2) {
      console.warn("[Storage] Stages CSV is empty");
      this.stageReferenceCache = [];
      return this.stageReferenceCache;
    }

    const header = rows[0].map((value) => value.trim());
    const indexOf = (name: string) => header.indexOf(name);

    const idx = {
      stageId: indexOf("stage_id"),
      cycleTemplateId: indexOf("cycle_template_id"),
      stageName: indexOf("stage_name"),
      startMilestoneId: indexOf("start_milestone_id"),
      expectedDate: indexOf("expected_date"),
      endMilestoneId: indexOf("end_milestone_id"),
      expectedDate2: indexOf("expected_date2"),
      uiPriority: indexOf("ui_priority"),
      details: indexOf("details"),
    };

    const stageData: StageReferenceData[] = [];
    for (const row of rows.slice(1)) {
      const stageId = normalizeCsvValue(row[idx.stageId]);
      if (!stageId) continue;

      const expectedDateValue = Number(
        normalizeCsvValue(row[idx.expectedDate]) || 0,
      );
      const expectedDate2Value = Number(
        normalizeCsvValue(row[idx.expectedDate2]) || 0,
      );
      const uiPriorityValue = Number(
        normalizeCsvValue(row[idx.uiPriority]) || 0,
      );

      stageData.push({
        stageId,
        cycleTemplateId: normalizeCsvValue(row[idx.cycleTemplateId]),
        stageName: normalizeCsvValue(row[idx.stageName]),
        startMilestoneId: normalizeCsvValue(row[idx.startMilestoneId]),
        expectedDate: Number.isNaN(expectedDateValue) ? null : expectedDateValue,
        endMilestoneId: normalizeCsvValue(row[idx.endMilestoneId]),
        expectedDate2: Number.isNaN(expectedDate2Value) ? null : expectedDate2Value,
        uiPriority: Number.isNaN(uiPriorityValue) ? null : uiPriorityValue,
        details: normalizeCsvValue(row[idx.details]),
      });
    }

    this.stageReferenceCache = stageData;
    return stageData;
  }
}

export const storage = new DatabaseStorage();
