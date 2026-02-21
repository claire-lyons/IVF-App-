import { sql } from 'drizzle-orm';
import {
  index,
  uniqueIndex,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - mandatory for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  age: integer("age"),
  location: varchar("location"),
  treatmentType: varchar("treatment_type"), // IVF, IUI, FET, Egg Freezing
  clinicName: varchar("clinic_name"),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Treatment cycles
export const cycles = pgTable("cycles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(), // IVF, IUI, FET, Egg Freezing
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  status: varchar("status").notNull().default("active"), // active, completed, cancelled
  result: varchar("result"), // positive, negative, miscarriage
  clinic: varchar("clinic"),
  doctor: varchar("doctor"),
  notes: text("notes"),
  shareToken: varchar("share_token"), // Token for public sharing
  donorConception: boolean("donor_conception").default(false), // Donor conception cycle
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Medications tracking
export const medications = pgTable("medications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cycleId: varchar("cycle_id").notNull().references(() => cycles.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  dosage: varchar("dosage").notNull(),
  frequency: varchar("frequency").notNull(),
  time: varchar("time"), // e.g., "8:00 PM"
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  sideEffects: text("side_effects"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily medication logs
export const medicationLogs = pgTable("medication_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  medicationId: varchar("medication_id").notNull().references(() => medications.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  taken: boolean("taken").default(false),
  takenAt: timestamp("taken_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Medication information (reference data)
export const medicationInfo = pgTable("medication_info", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull().unique(),
  generic: varchar("generic").notNull(),
  class: varchar("class").notNull(),
  purpose: text("purpose").notNull(),
  route: text("route").notNull(),
  timing: text("timing").notNull(),
  commonSideEffects: jsonb("common_side_effects").$type<string[]>().notNull().default([]),
  seriousSideEffects: jsonb("serious_side_effects").$type<string[]>().notNull().default([]),
  monitoringNotes: text("monitoring_notes"),
  patientNotes: text("patient_notes"),
  reference: text("reference"),
  videoLink: text("video_link"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Symptoms tracking
export const symptoms = pgTable("symptoms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cycleId: varchar("cycle_id").notNull().references(() => cycles.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  mood: varchar("mood"), // great, okay, tired, nauseous
  bloating: integer("bloating"), // 1-5 scale
  fatigue: integer("fatigue"), // 1-5 scale
  nausea: integer("nausea"), // 1-5 scale
  headache: integer("headache"), // 1-5 scale
  moodSwings: integer("mood_swings"), // 1-5 scale
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Test results
export const testResults = pgTable("test_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cycleId: varchar("cycle_id").notNull().references(() => cycles.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  type: varchar("type").notNull(), // blood, ultrasound, pregnancy_test
  name: varchar("name").notNull(), // E2, LH, FSH, follicle_count, etc.
  value: varchar("value"),
  unit: varchar("unit"),
  referenceRange: varchar("reference_range"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Milestones tracking
export const milestones = pgTable("milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cycleId: varchar("cycle_id").notNull().references(() => cycles.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(), // stimulation-start, trigger-shot, egg-collection, embryo-transfer, etc.
  title: varchar("title").notNull(),
  date: date("date").notNull(), // Expected/planned date
  startDate: date("start_date"), // Actual start date (required when moving from pending)
  endDate: date("end_date"), // Actual end date (required when completed/cancelled)
  notes: text("notes"),
  status: varchar("status").notNull().default("pending"), // pending, in-progress, completed, cancelled
  completed: boolean("completed").default(false), // Keep for backward compatibility
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Cycle stage templates
export const cycleStageTemplates = pgTable("cycle_stage_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cycleType: varchar("cycle_type").notNull(),
  stage: varchar("stage").notNull(),
  dayLabel: varchar("day_label").notNull(),
  dayStart: integer("day_start").notNull(),
  dayEnd: integer("day_end"),
  medicalDetails: text("medical_details"),
  monitoringProcedures: text("monitoring_procedures"),
  patientInsights: text("patient_insights"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Appointments
export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cycleId: varchar("cycle_id").notNull().references(() => cycles.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(), // consultation, scan, collection, transfer
  title: varchar("title").notNull(),
  date: timestamp("date").notNull(),
  location: varchar("location"),
  doctorName: varchar("doctor_name"),
  notes: text("notes"),
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Doctors and clinics
export const doctors = pgTable("doctors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  specialty: varchar("specialty").notNull(),
  clinic: varchar("clinic"),
  location: varchar("location").notNull(),
  address: text("address"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  phone: varchar("phone"),
  email: varchar("email"),
  website: varchar("website"),
  bulkBilling: boolean("bulk_billing").default(false),
  rating: decimal("rating", { precision: 2, scale: 1 }),
  reviewCount: integer("review_count").default(0),
  bio: text("bio"),
  qualifications: text("qualifications"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Doctor reviews
export const doctorReviews = pgTable("doctor_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id").notNull().references(() => doctors.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  price: decimal("price", { precision: 10, scale: 2 }), // Price paid for treatment/consultation
  treatmentType: varchar("treatment_type"), // IVF, IUI, FET, Consultation, etc.
  anonymous: boolean("anonymous").default(false),
  helpfulCount: integer("helpful_count").default(0), // Cached count of helpful votes
  createdAt: timestamp("created_at").defaultNow(),
});

// Review helpfulness votes
export const reviewHelpfulnessVotes = pgTable("review_helpfulness_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id").notNull().references(() => doctorReviews.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  helpful: boolean("helpful").notNull().default(true), // true = helpful, false = not helpful
  createdAt: timestamp("created_at").defaultNow(),
});

// Community forum posts
export const forumPosts = pgTable("forum_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  category: varchar("category"), // question, experience, support
  anonymous: boolean("anonymous").default(false),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Forum post comments
export const forumComments = pgTable("forum_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => forumPosts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  anonymous: boolean("anonymous").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Forum post reactions (one reaction per user per post)
export const forumPostReactions = pgTable("forum_post_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => forumPosts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reaction: varchar("reaction").notNull(), // like, love, happy, celebrate, wow, sad
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint: one reaction per user per post
  postUserUnique: uniqueIndex("forum_post_reactions_post_user_unique").on(table.postId, table.userId),
}));

// Chat messages with AI
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  role: varchar("role").notNull(), // user, assistant
  createdAt: timestamp("created_at").defaultNow(),
});

// Direct messages between users
export const directMessages = pgTable("direct_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiverId: varchar("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Educational content articles
export const educationalArticles = pgTable("educational_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  slug: varchar("slug").notNull().unique(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  category: varchar("category").notNull(), // medications, procedures, emotional-support, nutrition, side-effects
  tags: text("tags").array(),
  phases: text("phases").array(), // stimulation, egg-collection, transfer, two-week-wait, etc.
  cycleTypes: text("cycle_types").array(), // ivf-fresh, ivf-frozen, iui, etc.
  readingTime: integer("reading_time"), // in minutes
  featured: boolean("featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User bookmarks for educational articles
export const articleBookmarks = pgTable("article_bookmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  articleId: varchar("article_id").notNull().references(() => educationalArticles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Community articles (external links)
export const communityArticles = pgTable("community_articles", {
  id: varchar("id").primaryKey(),
  title: varchar("title").notNull(),
  summary: text("summary").notNull(),
  url: text("url").notNull(),
  category: varchar("category").notNull(),
  tags: text("tags").array(),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event logging with doctor notes
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: varchar("cycle_id").references(() => cycles.id, { onDelete: "cascade" }),
  milestoneId: varchar("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
  eventType: varchar("event_type").notNull(), // doctor_visit, observation, test_result, milestone, general_note, symptom, side_effect
  title: varchar("title").notNull(),
  description: text("description"),
  doctorNotes: text("doctor_notes"), // Detailed notes from doctor visits
  personalNotes: text("personal_notes"), // User's personal observations
  outcome: varchar("outcome"), // positive, negative, neutral, pending
  phase: varchar("phase"), // stimulation, egg-collection, transfer, two-week-wait, etc.
  date: date("date").notNull(),
  time: varchar("time"), // Optional time of day
  location: varchar("location"), // Clinic or location
  doctorName: varchar("doctor_name"),
  tags: text("tags").array(), // For categorization and filtering
  important: boolean("important").default(false), // Flag for important events
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reference data tables for static/lookup data
export const treatmentTypes = pgTable("treatment_types", {
  id: varchar("id").primaryKey(),
  label: varchar("label").notNull(),
  description: text("description"),
  displayOrder: integer("display_order").default(0),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clinics = pgTable("clinics", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull().unique(),
  displayOrder: integer("display_order").default(0),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cycleTypes = pgTable("cycle_types", {
  id: varchar("id").primaryKey(),
  label: varchar("label").notNull(),
  displayOrder: integer("display_order").default(0),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eventTypes = pgTable("event_types", {
  id: varchar("id").primaryKey(),
  label: varchar("label").notNull(),
  displayOrder: integer("display_order").default(0),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const milestoneTypes = pgTable("milestone_types", {
  id: varchar("id").primaryKey(),
  cycleType: varchar("cycle_type").notNull(), // ivf-fresh, ivf-frozen, iui, egg-freezing
  label: varchar("label").notNull(),
  displayOrder: integer("display_order").default(0),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contentBlocks = pgTable("content_blocks", {
  id: varchar("id").primaryKey(), // milestone_id from CSV
  cycleTemplateId: varchar("cycle_template_id").notNull(), // IVF, FET, IUI, EGG_FREEZ
  milestoneName: varchar("milestone_name").notNull(),
  milestoneType: varchar("milestone_type"),
  notificationTitle: varchar("notification_title"),
  milestoneDetails: text("milestone_details"),
  medicalInformation: text("medical_information"),
  whatToExpect: text("what_to_expect"),
  todaysTips: text("todays_tips"),
  milestoneOrder: integer("milestone_order").default(0),
  expectedDayOffset: integer("expected_day_offset"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  cycles: many(cycles),
  doctorReviews: many(doctorReviews),
  forumPosts: many(forumPosts),
  forumComments: many(forumComments),
  chatMessages: many(chatMessages),
  articleBookmarks: many(articleBookmarks),
  events: many(events),
}));

export const cyclesRelations = relations(cycles, ({ one, many }) => ({
  user: one(users, {
    fields: [cycles.userId],
    references: [users.id],
  }),
  medications: many(medications),
  symptoms: many(symptoms),
  testResults: many(testResults),
  appointments: many(appointments),
  milestones: many(milestones),
  events: many(events),
}));

export const medicationsRelations = relations(medications, ({ one, many }) => ({
  cycle: one(cycles, {
    fields: [medications.cycleId],
    references: [cycles.id],
  }),
  logs: many(medicationLogs),
}));

export const medicationLogsRelations = relations(medicationLogs, ({ one }) => ({
  medication: one(medications, {
    fields: [medicationLogs.medicationId],
    references: [medications.id],
  }),
}));

export const symptomsRelations = relations(symptoms, ({ one }) => ({
  cycle: one(cycles, {
    fields: [symptoms.cycleId],
    references: [cycles.id],
  }),
}));

export const testResultsRelations = relations(testResults, ({ one }) => ({
  cycle: one(cycles, {
    fields: [testResults.cycleId],
    references: [cycles.id],
  }),
}));

export const milestonesRelations = relations(milestones, ({ one }) => ({
  cycle: one(cycles, {
    fields: [milestones.cycleId],
    references: [cycles.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  cycle: one(cycles, {
    fields: [appointments.cycleId],
    references: [cycles.id],
  }),
}));

export const doctorsRelations = relations(doctors, ({ many }) => ({
  reviews: many(doctorReviews),
}));

export const doctorReviewsRelations = relations(doctorReviews, ({ one, many }) => ({
  doctor: one(doctors, {
    fields: [doctorReviews.doctorId],
    references: [doctors.id],
  }),
  user: one(users, {
    fields: [doctorReviews.userId],
    references: [users.id],
  }),
  helpfulnessVotes: many(reviewHelpfulnessVotes),
}));

export const reviewHelpfulnessVotesRelations = relations(reviewHelpfulnessVotes, ({ one }) => ({
  review: one(doctorReviews, {
    fields: [reviewHelpfulnessVotes.reviewId],
    references: [doctorReviews.id],
  }),
  user: one(users, {
    fields: [reviewHelpfulnessVotes.userId],
    references: [users.id],
  }),
}));

export const forumPostsRelations = relations(forumPosts, ({ one, many }) => ({
  user: one(users, {
    fields: [forumPosts.userId],
    references: [users.id],
  }),
  comments: many(forumComments),
}));

export const forumCommentsRelations = relations(forumComments, ({ one }) => ({
  post: one(forumPosts, {
    fields: [forumComments.postId],
    references: [forumPosts.id],
  }),
  user: one(users, {
    fields: [forumComments.userId],
    references: [users.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
}));

export const educationalArticlesRelations = relations(educationalArticles, ({ many }) => ({
  bookmarks: many(articleBookmarks),
}));

export const articleBookmarksRelations = relations(articleBookmarks, ({ one }) => ({
  user: one(users, {
    fields: [articleBookmarks.userId],
    references: [users.id],
  }),
  article: one(educationalArticles, {
    fields: [articleBookmarks.articleId],
    references: [educationalArticles.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  user: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
  cycle: one(cycles, {
    fields: [events.cycleId],
    references: [cycles.id],
  }),
  milestone: one(milestones, {
    fields: [events.milestoneId],
    references: [milestones.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCycleSchema = createInsertSchema(cycles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
});

export const insertMedicationSchema = createInsertSchema(medications).omit({
  id: true,
  createdAt: true,
});

export const insertMedicationLogSchema = createInsertSchema(medicationLogs).omit({
  id: true,
  createdAt: true,
});

export const insertMedicationInfoSchema = createInsertSchema(medicationInfo).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertSymptomSchema = createInsertSchema(symptoms).omit({
  id: true,
  createdAt: true,
});

export const insertTestResultSchema = createInsertSchema(testResults).omit({
  id: true,
  createdAt: true,
});

export const insertMilestoneSchema = createInsertSchema(milestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCycleStageTemplateSchema = createInsertSchema(cycleStageTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
});

export const insertDoctorSchema = createInsertSchema(doctors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  rating: true,
  reviewCount: true,
});

export const insertDoctorReviewSchema = createInsertSchema(doctorReviews).omit({
  id: true,
  createdAt: true,
  helpfulCount: true, // Auto-calculated
});

export const insertReviewHelpfulnessVoteSchema = createInsertSchema(reviewHelpfulnessVotes).omit({
  id: true,
  createdAt: true,
});

export const insertForumPostSchema = createInsertSchema(forumPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  likes: true,
});

export const insertForumCommentSchema = createInsertSchema(forumComments).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({
  id: true,
  createdAt: true,
});

export const insertEducationalArticleSchema = createInsertSchema(educationalArticles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertArticleBookmarkSchema = createInsertSchema(articleBookmarks).omit({
  id: true,
  createdAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertCycle = z.infer<typeof insertCycleSchema>;
export type Cycle = typeof cycles.$inferSelect;
export type InsertMedication = z.infer<typeof insertMedicationSchema>;
export type Medication = typeof medications.$inferSelect;
export type InsertMedicationLog = z.infer<typeof insertMedicationLogSchema>;
export type MedicationLog = typeof medicationLogs.$inferSelect;
export type InsertMedicationInfo = z.infer<typeof insertMedicationInfoSchema>;
export type MedicationInfo = typeof medicationInfo.$inferSelect;
export type InsertSymptom = z.infer<typeof insertSymptomSchema>;
export type Symptom = typeof symptoms.$inferSelect;
export type InsertTestResult = z.infer<typeof insertTestResultSchema>;
export type TestResult = typeof testResults.$inferSelect;
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestones.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertCycleStageTemplate = z.infer<typeof insertCycleStageTemplateSchema>;
export type CycleStageTemplate = typeof cycleStageTemplates.$inferSelect;
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type Doctor = typeof doctors.$inferSelect;
export type InsertDoctorReview = z.infer<typeof insertDoctorReviewSchema>;
export type DoctorReview = typeof doctorReviews.$inferSelect;
export type InsertReviewHelpfulnessVote = z.infer<typeof insertReviewHelpfulnessVoteSchema>;
export type ReviewHelpfulnessVote = typeof reviewHelpfulnessVotes.$inferSelect;
export type InsertForumPost = z.infer<typeof insertForumPostSchema>;
export type ForumPost = typeof forumPosts.$inferSelect;
export type InsertForumComment = z.infer<typeof insertForumCommentSchema>;
export type ForumComment = typeof forumComments.$inferSelect;
export type ForumPostReaction = typeof forumPostReactions.$inferSelect;
export type InsertForumPostReaction = typeof forumPostReactions.$inferInsert;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type DirectMessage = typeof directMessages.$inferSelect;
export type InsertEducationalArticle = z.infer<typeof insertEducationalArticleSchema>;
export type EducationalArticle = typeof educationalArticles.$inferSelect;
export type InsertArticleBookmark = z.infer<typeof insertArticleBookmarkSchema>;
export type ArticleBookmark = typeof articleBookmarks.$inferSelect;

export const insertCommunityArticleSchema = createInsertSchema(communityArticles);
export type InsertCommunityArticle = z.infer<typeof insertCommunityArticleSchema>;
export type CommunityArticle = typeof communityArticles.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// Reference data types
export type TreatmentType = typeof treatmentTypes.$inferSelect;
export type InsertTreatmentType = typeof treatmentTypes.$inferInsert;
export type Clinic = typeof clinics.$inferSelect;
export type InsertClinic = typeof clinics.$inferInsert;
export type CycleType = typeof cycleTypes.$inferSelect;
export type InsertCycleType = typeof cycleTypes.$inferInsert;
export type EventType = typeof eventTypes.$inferSelect;
export type InsertEventType = typeof eventTypes.$inferInsert;
export type MilestoneType = typeof milestoneTypes.$inferSelect;
export type InsertMilestoneType = typeof milestoneTypes.$inferInsert;
export type ContentBlock = typeof contentBlocks.$inferSelect;
export type InsertContentBlock = typeof contentBlocks.$inferInsert;