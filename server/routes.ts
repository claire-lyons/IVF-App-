import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, getSupabaseClient, getSupabaseAdminClient, deleteSupabaseUser } from "./supabaseAuth";
import { generateChatResponse, generateCycleInsight } from "./openai";
import { notifyDoctorOfAppointment, notifyPatientOfAppointment } from "./notifications";
import { generateCycleSummaryHTML, generateCycleSummaryCSV, generateCycleSummaryPDF } from "./reportGenerator";
import {
  insertCycleSchema,
  insertMedicationSchema,
  insertSymptomSchema,
  insertTestResultSchema,
  insertAppointmentSchema,
  insertMilestoneSchema,
  insertDoctorSchema,
  insertDoctorReviewSchema,
  insertForumPostSchema,
  insertForumCommentSchema,
  insertChatMessageSchema,
  insertDirectMessageSchema,
} from "@shared/schema";
export async function registerRoutes(app: Express): Promise<Server> {
  console.log("[Routes] ========== REGISTERING ROUTES ==========");
  // Auth middleware
  await setupAuth(app);
  console.log("[Routes] Auth middleware setup complete");

  // Delete all existing doctors and seed new ones on startup
  try {
    console.log("[Routes] Deleting all existing doctors...");
    await storage.deleteAllDoctors();
    console.log("[Routes] All doctors deleted");
    
    console.log("[Routes] Seeding doctors from Excel data...");
    await storage.ensureDoctorsSeeded();
    console.log("[Routes] Doctor seeding complete");
  } catch (error) {
    console.error("[Routes] Error during doctor deletion/seeding:", error);
    // Continue even if seeding fails
  }

  // Seed medication info on startup
  try {
    await storage.ensureMedicationInfoSeeded();
    console.log("[Routes] Medication info seeding check complete");
  } catch (error) {
    console.error("[Routes] Error seeding medication info:", error);
  }

  // Seed educational articles on startup
  try {
    await storage.ensureEducationalArticlesSeeded();
    console.log("[Routes] Educational articles seeding check complete");
  } catch (error) {
    console.error("[Routes] Error seeding educational articles:", error);
  }

  // Seed reference data (treatment types, clinics, cycle types, event types, milestone types) on startup
  try {
    await storage.ensureReferenceDataSeeded();
    console.log("[Routes] Reference data seeding complete");
  } catch (error) {
    console.error("[Routes] Error seeding reference data:", error);
  }

  // Seed content blocks (personalized insights) on startup
  try {
    await storage.ensureContentBlocksSeeded();
    console.log("[Routes] Content blocks seeding complete");
  } catch (error) {
    console.error("[Routes] Error seeding content blocks:", error);
  }

  // Seed cycle stage templates on startup (force refresh to align with CSV)
  try {
    await storage.ensureCycleStageTemplatesSeeded(true);
    console.log("[Routes] Cycle stage templates seeding complete");
  } catch (error) {
    console.error("[Routes] Error seeding cycle stage templates:", error);
  }

  // Health check endpoint (no auth required)
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Backend is running" });
  });

  // Test export endpoint (no auth required) - for debugging
  app.get("/api/test-export", (req, res) => {
    console.log("[Test Export] Route hit!");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="test-export.csv"`);
    res.send("Test,Data,Export\n1,2,3\n");
  });

  // Auth proxy endpoints (to avoid CORS issues with Supabase)
  const authSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
  });

  const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phoneNumber: z.union([z.string(), z.null(), z.literal("")]).optional().refine((val) => {
      // Allow empty string, null, or undefined
      if (val === null || val === undefined || val === "") {
        return true;
      }
      // If provided, validate: only digits, 10-15 digits
      if (typeof val === "string") {
        const digitsOnly = val.replace(/\D/g, '');
        return digitsOnly.length >= 10 && digitsOnly.length <= 15;
      }
      return false;
    }, "Phone number must be 10-15 digits").transform((val) => {
      // Convert empty string, null, or undefined to null
      if (val === null || val === undefined || val === "") {
        return null;
      }
      // If it's a string, extract only digits and return null if empty after processing
      if (typeof val === "string") {
        const digitsOnly = val.replace(/\D/g, '');
        return digitsOnly === "" ? null : digitsOnly;
      }
      return null;
    }),
    dateOfBirth: z.string().optional(),
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = authSchema.parse(req.body);
      const supabase = getSupabaseClient();
      console.log("[Login] Attempting to sign in with email:", email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      if (data.user) {
        await storage.upsertUser({
          id: data.user.id,
          email: data.user.email || "",
          firstName: data.user.user_metadata?.firstName || "",
          lastName: data.user.user_metadata?.lastName || "",
          profileImageUrl: data.user.user_metadata?.profileImageUrl || null,
        });
      }

      res.json({
        user: data.user,
        session: data.session,
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(400).json({ message: error.message || "Login failed" });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, firstName, lastName, phoneNumber, dateOfBirth } =
        signupSchema.parse(req.body);
      
      console.log("[Signup] Attempting to sign up with email:", email);
      
      // Check if email already exists in database
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        console.log("[Signup] Email already exists in database:", email);
        return res.status(400).json({ 
          message: "This email is already in use. Please log in or use another email." 
        });
      }

      // Check if email already exists in Supabase Auth using admin client
      try {
        const supabaseAdmin = getSupabaseAdminClient();
        const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (!listError && authUsers) {
          const emailExists = authUsers.users.some(user => 
            user.email?.toLowerCase() === email.toLowerCase()
          );
          
          if (emailExists) {
            console.log("[Signup] Email already exists in Supabase Auth:", email);
            return res.status(400).json({ 
              message: "This email is already in use. Please log in or use another email." 
            });
          }
        }
      } catch (adminError) {
        // If admin client check fails, continue with signup attempt
        // Supabase signUp will catch duplicate emails
        console.warn("[Signup] Could not check Supabase Auth for existing email, proceeding with signup:", adminError);
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            firstName: firstName || "",
            lastName: lastName || "",
            phoneNumber: phoneNumber || null,
            dateOfBirth: dateOfBirth || null,
          },
        },
      });

      if (error) {
        // Check if error is related to duplicate email
        if (error.message.includes("already registered") || 
            error.message.includes("already exists") ||
            error.message.includes("User already registered")) {
          return res.status(400).json({ 
            message: "This email is already in use. Please log in or use another email." 
          });
        }
        return res.status(400).json({ message: error.message });
      }

      if (data.user) {
        await storage.upsertUser({
          id: data.user.id,
          email: data.user.email || "",
          firstName: data.user.user_metadata?.firstName || "",
          lastName: data.user.user_metadata?.lastName || "",
          profileImageUrl: data.user.user_metadata?.profileImageUrl || null,
        });
      }

      res.json({
        user: data.user,
        session: data.session,
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      res.status(400).json({ message: error.message || "Signup failed" });
    }
  });

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Fetch user metadata from Supabase to get phone number and notification preferences
      const supabaseAdmin = getSupabaseAdminClient();
      const { data: { user: supabaseUser }, error: supabaseError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (supabaseError) {
        console.error("[GET /api/auth/user] Supabase user fetch error:", supabaseError);
        // Continue with DB user if Supabase fetch fails
      }
      
      // Include phone and notification preferences from user_metadata if they exist
      const responseUser: any = { ...user };
      if (supabaseUser?.user_metadata?.phone !== undefined) {
        responseUser.phone = supabaseUser.user_metadata.phone;
      }
      
      // Include notification preferences from user_metadata
      const notificationFields = ['emailNotifications', 'pushNotifications', 'medicationReminders', 'appointmentReminders'];
      for (const field of notificationFields) {
        if (supabaseUser?.user_metadata?.[field] !== undefined) {
          responseUser[field] = supabaseUser.user_metadata[field];
        }
      }
      // Include timezone from user_metadata
      if (supabaseUser?.user_metadata?.timezone !== undefined) {
        responseUser.timezone = supabaseUser.user_metadata.timezone;
      }
      
      res.json(responseUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const updateData = req.body;
      
      console.log("[PATCH /api/auth/user] Received update data:", JSON.stringify(updateData));

      // Validate and sanitize update data - only allow fields that exist in users table
      const allowedFields = ['firstName', 'lastName', 'email', 'age', 'location', 'treatmentType', 'clinicName'];
      const sanitizedData: any = {};
      
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          sanitizedData[field] = updateData[field];
        }
      }
      
      console.log("[PATCH /api/auth/user] Sanitized data for DB:", JSON.stringify(sanitizedData));

      // Update user profile in database
      const updatedUser = await storage.updateUserProfile(userId, sanitizedData);

      // Update Supabase auth metadata and email using admin API
      const supabaseAdmin = getSupabaseAdminClient();
      const updateMetadata: any = {};
      
      // Get current user metadata to preserve existing fields
      const { data: currentUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (getUserError) {
        console.error("[PATCH /api/auth/user] Error fetching current user:", getUserError);
      }
      
      // Merge existing metadata with new updates
      const existingMetadata = currentUser?.user?.user_metadata || {};
      
      // Define notification fields array once for reuse
      const notificationFields = ['emailNotifications', 'pushNotifications', 'medicationReminders', 'appointmentReminders'];
      
      if (sanitizedData.firstName !== undefined) {
        updateMetadata.firstName = sanitizedData.firstName;
      } else if (existingMetadata.firstName !== undefined) {
        updateMetadata.firstName = existingMetadata.firstName;
      }
      
      if (sanitizedData.lastName !== undefined) {
        updateMetadata.lastName = sanitizedData.lastName;
      } else if (existingMetadata.lastName !== undefined) {
        updateMetadata.lastName = existingMetadata.lastName;
      }
      
      // Store phone in user_metadata if provided (users table doesn't have phone field)
      if (updateData.phone !== undefined) {
        // Validate phone number: only digits, 10-15 digits
        if (updateData.phone === null || updateData.phone === "") {
          updateMetadata.phone = null;
        } else {
          const phoneStr = String(updateData.phone);
          const digitsOnly = phoneStr.replace(/\D/g, '');
          if (digitsOnly.length < 10 || digitsOnly.length > 15) {
            return res.status(400).json({ 
              message: "Phone number must be 10-15 digits" 
            });
          }
          updateMetadata.phone = digitsOnly;
        }
      } else if (existingMetadata.phone !== undefined) {
        updateMetadata.phone = existingMetadata.phone;
      }

      // Store notification preferences in user_metadata
      console.log("[PATCH /api/auth/user] Processing notification preferences from updateData:", {
        emailNotifications: updateData.emailNotifications,
        pushNotifications: updateData.pushNotifications,
        medicationReminders: updateData.medicationReminders,
        appointmentReminders: updateData.appointmentReminders,
      });
      for (const field of notificationFields) {
        if (updateData[field] !== undefined) {
          updateMetadata[field] = Boolean(updateData[field]);
          console.log(`[PATCH /api/auth/user] Setting ${field} to:`, updateMetadata[field]);
        } else if (existingMetadata[field] !== undefined) {
          updateMetadata[field] = existingMetadata[field];
          console.log(`[PATCH /api/auth/user] Preserving existing ${field}:`, updateMetadata[field]);
        }
      }

      // Store timezone in user_metadata if provided
      if (updateData.timezone !== undefined) {
        updateMetadata.timezone = String(updateData.timezone);
        console.log("[PATCH /api/auth/user] Setting timezone to:", updateMetadata.timezone);
      } else if (existingMetadata.timezone !== undefined) {
        updateMetadata.timezone = existingMetadata.timezone;
        console.log("[PATCH /api/auth/user] Preserving existing timezone:", updateMetadata.timezone);
      }

      console.log("[PATCH /api/auth/user] Final updateMetadata:", JSON.stringify(updateMetadata));

      // Update Supabase user metadata and email using admin API
      const { data: authUpdateData, error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        {
          email: sanitizedData.email || currentUser?.user?.email,
          user_metadata: updateMetadata,
        }
      );

      if (authUpdateError) {
        console.error("[PATCH /api/auth/user] Supabase auth update error:", authUpdateError);
        return res.status(500).json({ message: authUpdateError.message });
      }

      // Fetch the updated user from database to ensure we return the latest data
      const finalUser = await storage.getUser(userId);
      
      // Return updated user with phone and notification preferences from auth metadata
      const responseUser: any = { ...finalUser };
      // Get phone from the updated auth metadata
      if (authUpdateData?.user?.user_metadata?.phone !== undefined) {
        (responseUser as any).phone = authUpdateData.user.user_metadata.phone;
      }
      // Get notification preferences from the updated auth metadata
      for (const field of notificationFields) {
        if (authUpdateData?.user?.user_metadata?.[field] !== undefined) {
          (responseUser as any)[field] = authUpdateData.user.user_metadata[field];
        }
      }
      // Get timezone from the updated auth metadata
      if (authUpdateData?.user?.user_metadata?.timezone !== undefined) {
        (responseUser as any).timezone = authUpdateData.user.user_metadata.timezone;
      }
      
      console.log("[PATCH /api/auth/user] Returning updated user:", JSON.stringify(responseUser));

      res.json(responseUser);
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(400).json({ message: error.message || "Failed to update user" });
    }
  });

  // Change password endpoint
  app.post("/api/auth/change-password", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      // Verify current password by attempting to sign in
      const supabase = getSupabaseClient();
      const userEmail = req.user.email;
      
      console.log("[Change Password] Verifying current password for user:", userId);
      const { data: verifyData, error: verifyError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (verifyError || !verifyData.user) {
        console.error("[Change Password] Current password verification failed:", verifyError);
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Update password using admin API
      const supabaseAdmin = getSupabaseAdminClient();
      console.log("[Change Password] Updating password for user:", userId);
      const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        {
          password: newPassword,
        }
      );

      if (updateError) {
        console.error("[Change Password] Password update error:", updateError);
        return res.status(500).json({ message: updateError.message || "Failed to update password" });
      }

      console.log("[Change Password] Password updated successfully for user:", userId);
      res.json({ message: "Password updated successfully" });
    } catch (error: any) {
      console.error("[Change Password] Error:", error);
      res.status(500).json({ message: error.message || "Failed to change password" });
    }
  });

  app.delete("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { reason } = req.body || {};

      console.log(`[Delete User] Starting deletion for user: ${userId}`);

      // CRITICAL: Delete from Supabase Auth FIRST (before database deletion)
      // This prevents the user from logging in again
      let supabaseDeleted = false;
      try {
        console.log(`[Delete User] Attempting to delete from Supabase Auth...`);
        supabaseDeleted = await deleteSupabaseUser(userId);
        if (supabaseDeleted) {
          console.log(`[Delete User] Successfully deleted from Supabase Auth`);
        } else {
          console.warn(`[Delete User] WARNING: Could not delete from Supabase Auth (admin client not available)`);
        }
      } catch (error: any) {
        console.error("[Delete User] ERROR deleting Supabase auth user:", error);
        // Don't fail completely, but log the error
        // The user will still be deleted from our database
      }

      // Delete from our database
      console.log(`[Delete User] Deleting user data from database...`);
      await storage.deleteUserData(userId);
      console.log(`[Delete User] User data deleted from database`);

      // If Supabase deletion failed, warn the user
      if (!supabaseDeleted) {
        console.warn(`[Delete User] WARNING: User deleted from database but may still exist in Supabase Auth`);
        res.status(200).json({ 
          success: true, 
          message: "Account deleted from database. Note: Supabase Auth deletion may have failed - please contact support if you can still log in.",
          warning: "Supabase Auth deletion may have failed",
          reason: reason || null 
        });
      } else {
        res.status(200).json({ 
          success: true, 
          message: "Account deleted successfully", 
          reason: reason || null 
        });
      }
    } catch (error: any) {
      console.error("[Delete User] Error deleting user:", error);
      res.status(500).json({ 
        message: "Failed to delete account",
        error: error?.message || "Unknown error"
      });
    }
  });

  // Data export endpoint (GDPR requirement)
  // IMPORTANT: This route must be registered BEFORE Vite middleware
  console.log("[Routes] Registering /api/user/export route...");
  app.get("/api/user/export", isAuthenticated, async (req: any, res) => {
    console.log(`[Export] ========== ROUTE HANDLER CALLED ==========`);
    console.log(`[Export] Route hit! Path: ${req.path}, Method: ${req.method}`);
    console.log(`[Export] User object:`, req.user ? "exists" : "missing");
    console.log(`[Export] User ID:`, req.user?.id || "NOT FOUND");
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        console.error("[Export] ERROR: No user ID found in req.user");
        console.error("[Export] req.user:", req.user);
        return res.status(401).json({ message: "Unauthorized" });
      }

      // CRITICAL: Verify user still exists in database
      // If user was deleted, they shouldn't be able to export data
      console.log(`[Export] Verifying user exists in database: ${userId}`);
      const userExists = await storage.getUser(userId);
      if (!userExists) {
        console.error(`[Export] ERROR: User ${userId} does not exist in database - account may have been deleted`);
        return res.status(404).json({ 
          message: "User account not found. This account may have been deleted.",
          error: "USER_NOT_FOUND"
        });
      }

      console.log(`[Export] User verified, starting data export for user: ${userId}`);
      const userData = await storage.exportUserData(userId);
      console.log(`[Export] Data export completed for user: ${userId}`);
      console.log(`[Export] Data size:`, JSON.stringify(userData).length, "bytes");

      // Always return JSON - frontend will convert to CSV if needed
      res.setHeader("Content-Type", "application/json");
      const responseData = {
        exportDate: new Date().toISOString(),
        version: "1.0",
        data: userData,
      };
      console.log(`[Export] Sending response, size:`, JSON.stringify(responseData).length, "bytes");
      res.json(responseData);
      console.log(`[Export] ========== RESPONSE SENT ==========`);
    } catch (error: any) {
      console.error("[Export] ========== ERROR OCCURRED ==========");
      console.error("[Export] Error exporting user data:", error);
      console.error("[Export] Error stack:", error?.stack);
      
      // Check if error is because user doesn't exist
      if (error?.message?.includes("User not found") || error?.message?.includes("not found")) {
        return res.status(404).json({ 
          message: "User account not found. This account may have been deleted.",
          error: "USER_NOT_FOUND"
        });
      }
      
      res.status(500).json({ 
        message: "Failed to export user data",
        error: error?.message || "Unknown error"
      });
    }
  });

  // Profile routes
  app.post(
    "/api/profile/complete-onboarding",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { age, location, treatmentType, clinicName } = req.body;

        const user = await storage.completeOnboarding(userId, {
          age: parseInt(age),
          location,
          treatmentType,
          clinicName,
        });

        res.json(user);
      } catch (error) {
        console.error("Error completing onboarding:", error);
        res.status(500).json({ message: "Failed to complete onboarding" });
      }
    },
  );

  // Cycle routes
  // Serve cycle template data
  app.get("/api/cycles/templates", async (_req, res) => {
    try {
      const templates = await storage.getCycleTemplateMap();
      res.json(templates);
    } catch (error) {
      console.error("Error loading cycle templates:", error);
      res.status(500).json({ message: "Failed to load cycle templates" });
    }
  });

  app.get("/api/content-blocks", async (req, res) => {
    try {
      const cycleTemplateId = req.query.cycleTemplateId as string | undefined;
      const blocks = await storage.getContentBlocks(cycleTemplateId);
      res.json(blocks);
    } catch (error) {
      console.error("Error loading content blocks:", error);
      res.status(500).json({ message: "Failed to load content blocks" });
    }
  });

  app.get("/api/cycles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const cycles = await storage.getUserCycles(userId);
      res.json(cycles);
    } catch (error) {
      console.error("Error fetching cycles:", error);
      res.status(500).json({ message: "Failed to fetch cycles" });
    }
  });

  app.get("/api/cycles/active", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const cycle = await storage.getActiveCycle(userId);
      res.json(cycle);
    } catch (error) {
      console.error("Error fetching active cycle:", error);
      res.status(500).json({ message: "Failed to fetch active cycle" });
    }
  });

  app.post("/api/cycles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // Parse and validate with schema (includes donorConception)
      const cycleData = insertCycleSchema.parse(req.body);
      const cycle = await storage.createCycle({ userId, ...cycleData });
      res.json(cycle);
    } catch (error) {
      console.error("Error creating cycle:", error);
      res.status(500).json({ message: "Failed to create cycle" });
    }
  });

  app.patch("/api/cycles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const cycle = await storage.updateCycle(id, req.body);
      res.json(cycle);
    } catch (error) {
      console.error("Error updating cycle:", error);
      res.status(500).json({ message: "Failed to update cycle" });
    }
  });

  app.put("/api/cycles/:id/end", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { result, notes } = req.body;
      const cycle = await storage.endCycle(id, result, notes);
      res.json(cycle);
    } catch (error) {
      console.error("Error ending cycle:", error);
      res.status(500).json({ message: "Failed to end cycle" });
    }
  });

  app.delete("/api/cycles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      await storage.deleteCycle(id, userId);
      res.json({ message: "Cycle deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting cycle:", error);
      if (error.message === "Cycle not found") {
        res.status(404).json({ message: "Cycle not found" });
      } else if (error.message.includes("Unauthorized")) {
        res.status(403).json({ message: "Unauthorized: You can only delete your own cycles" });
      } else {
        res.status(500).json({ message: "Failed to delete cycle" });
      }
    }
  });

  // Cycle summary endpoint
  app.get("/api/cycles/:id/summary", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const format = (req.query.format as string) || "json"; // 'json' or 'html'
      const exportType = (req.query.export as string) || null; // 'pdf' or 'csv'

      // Verify user owns this cycle
      const cycle = await storage.getCycleById(id);
      if (!cycle || cycle.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const summary = await storage.getCycleSummary(id);
      const user = await storage.getUser(userId);
      const userName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : undefined;

      if (exportType === "csv") {
        const csv = generateCycleSummaryCSV(summary, userName);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="cycle-summary-${id}.csv"`);
        return res.send(csv);
      }

      if (exportType === "pdf") {
        try {
          console.log(`[PDF Export] Starting PDF generation for cycle ${id}`);
          console.log(`[PDF Export] Summary data:`, {
            cycle: summary.cycle?.id,
            medications: summary.medications?.length || 0,
            symptoms: summary.symptoms?.length || 0,
            testResults: summary.testResults?.length || 0,
            milestones: summary.milestones?.length || 0,
            appointments: summary.appointments?.length || 0,
            events: summary.events?.length || 0,
          });
          
          const pdfBuffer = await generateCycleSummaryPDF(summary, userName);
          
          if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new Error("PDF buffer is empty after generation");
          }
          
          console.log(`[PDF Export] PDF generated successfully, size: ${pdfBuffer.length} bytes`);
          
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="cycle-summary-${id}.pdf"`);
          res.setHeader("Content-Length", pdfBuffer.length.toString());
          res.setHeader("Cache-Control", "no-cache");
          return res.send(pdfBuffer);
        } catch (pdfError) {
          console.error("[PDF Export] PDF generation error:", pdfError);
          if (pdfError instanceof Error) {
            console.error("[PDF Export] Error stack:", pdfError.stack);
          }
          const errorMessage = pdfError instanceof Error ? pdfError.message : "Unknown error";
          return res.status(500).json({ 
            message: "Failed to generate PDF", 
            error: errorMessage 
          });
        }
      }

      if (format === "html") {
        const html = generateCycleSummaryHTML(summary, userName);
        res.setHeader("Content-Type", "text/html");
        return res.send(html);
      }

      return res.json(summary);
    } catch (error) {
      console.error("Error generating cycle summary:", error);
      res.status(500).json({ message: "Failed to generate cycle summary" });
    }
  });

  // Get or generate share token for a cycle
  app.get("/api/cycles/:id/share-token", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Verify user owns this cycle
      const cycle = await storage.getCycleById(id);
      if (!cycle || cycle.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const shareToken = await storage.getOrCreateShareToken(id);
      res.json({ shareToken });
    } catch (error) {
      console.error("Error getting share token:", error);
      res.status(500).json({ message: "Failed to get share token" });
    }
  });

  // Public share endpoint (no authentication required)
  app.get("/api/summary/share/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const format = (req.query.format as string) || "json"; // 'json' or 'html'
      const exportType = (req.query.export as string) || null; // 'pdf' or 'csv'

      // Find cycle by share token
      const cycle = await storage.getCycleByShareToken(token);
      if (!cycle) {
        return res.status(404).json({ message: "Summary not found or link expired" });
      }

      const summary = await storage.getCycleSummary(cycle.id);
      const user = await storage.getUser(cycle.userId);
      const userName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : undefined;

      if (exportType === "csv") {
        const csv = generateCycleSummaryCSV(summary, userName);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="cycle-summary-${cycle.id}.csv"`);
        return res.send(csv);
      }

      if (exportType === "pdf") {
        try {
          const pdfBuffer = await generateCycleSummaryPDF(summary, userName);
          if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new Error("PDF buffer is empty after generation");
          }
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="cycle-summary-${cycle.id}.pdf"`);
          res.setHeader("Content-Length", pdfBuffer.length.toString());
          res.setHeader("Cache-Control", "no-cache");
          return res.send(pdfBuffer);
        } catch (pdfError) {
          console.error("[PDF Export] PDF generation error:", pdfError);
          return res.status(500).json({ 
            message: "Failed to generate PDF", 
            error: pdfError instanceof Error ? pdfError.message : "Unknown error" 
          });
        }
      }

      if (format === "html") {
        const html = generateCycleSummaryHTML(summary, userName);
        res.setHeader("Content-Type", "text/html");
        return res.send(html);
      }

      return res.json(summary);
    } catch (error) {
      console.error("Error generating public cycle summary:", error);
      res.status(500).json({ message: "Failed to generate cycle summary" });
    }
  });

  // Milestone routes
  app.get(
    "/api/cycles/:cycleId/milestones",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { cycleId } = req.params;
        const milestones = await storage.getCycleMilestones(cycleId);
        res.json(milestones);
      } catch (error) {
        console.error("Error fetching milestones:", error);
        res.status(500).json({ message: "Failed to fetch milestones" });
      }
    },
  );

  // Helper function to validate milestone status workflow
  const validateMilestoneStatusWorkflow = (
    data: any,
    existingMilestone?: any
  ): { isValid: boolean; error?: string; validatedData: any } => {
    // Create a copy to avoid mutating the original request body
    const validatedData = { ...data };
    
    // Only validate that date is provided (single date field)
    if (!validatedData.date) {
      return {
        isValid: false,
        error: "Date is required for milestones",
        validatedData
      };
    }

    return { isValid: true, validatedData };
  };

  app.post("/api/milestones", isAuthenticated, async (req: any, res) => {
    try {
      // Parse with Zod schema first
      const parsedData = insertMilestoneSchema.parse(req.body);
      
      // Validate status workflow
      const validation = validateMilestoneStatusWorkflow(parsedData);
      if (!validation.isValid) {
        return res.status(400).json({ message: validation.error });
      }
      
      const milestone = await storage.createMilestone(validation.validatedData);
      res.json(milestone);
    } catch (error) {
      console.error("Error creating milestone:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid milestone data", errors: error });
      }
      res.status(500).json({ message: "Failed to create milestone" });
    }
  });

  app.patch("/api/milestones/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Get existing milestone to check current status
      const existingMilestone = await storage.getMilestoneById(id);
      if (!existingMilestone) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      
      // Parse with partial Zod schema to ensure type safety
      const parsedData = insertMilestoneSchema.partial().parse(req.body);
      
      // Validate status workflow (pass entire existing milestone)
      const validation = validateMilestoneStatusWorkflow(parsedData, existingMilestone);
      if (!validation.isValid) {
        return res.status(400).json({ message: validation.error });
      }
      
      // Update the milestone with validated data
      const milestone = await storage.updateMilestone(id, validation.validatedData);
      res.json(milestone);
    } catch (error) {
      console.error("Error updating milestone:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid milestone data", errors: error });
      }
      res.status(500).json({ message: "Failed to update milestone" });
    }
  });

  app.delete("/api/milestones/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteMilestone(id);
      res.json({ message: "Milestone deleted successfully" });
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ message: "Failed to delete milestone" });
    }
  });

  // Daily insights
  app.get("/api/cycles/:id/insight", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const cycle = await storage.getActiveCycle(req.user.id);

      if (!cycle) {
        return res.status(404).json({ message: "No active cycle found" });
      }

      const startDate = new Date(cycle.startDate);
      const today = new Date();
      const cycleDay =
        Math.floor(
          (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;

      // Get recent symptoms for context
      const symptoms = await storage.getCycleSymptoms(cycle.id);
      const recentSymptoms = symptoms
        .slice(0, 3)
        .map((s) => s.mood || "")
        .filter(Boolean);

      const insight = await generateCycleInsight(
        cycleDay,
        cycle.type,
        recentSymptoms,
      );

      res.json({ insight, cycleDay });
    } catch (error) {
      console.error("Error generating insight:", error);
      res.status(500).json({ message: "Failed to generate insight" });
    }
  });

  // Medication routes
  app.get(
    "/api/cycles/:cycleId/medications",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { cycleId } = req.params;
        const medications = await storage.getCycleMedications(cycleId);
        res.json(medications);
      } catch (error) {
        console.error("Error fetching medications:", error);
        res.status(500).json({ message: "Failed to fetch medications" });
      }
    },
  );

  // Medication information endpoints (public - no auth required for reference data)
  app.get("/api/medications/info", async (req, res) => {
    try {
      console.log("[Medication Info API] Fetching all medications...");
      const medications = await storage.getAllMedicationInfo();
      console.log(`[Medication Info API] Found ${medications.length} medications`);
      res.json(medications);
    } catch (error) {
      console.error("Error fetching medication info:", error);
      res.status(500).json({ message: "Failed to fetch medication information" });
    }
  });

  // Manual trigger for seeding (for debugging)
  app.post("/api/medications/info/seed", async (req, res) => {
    try {
      console.log("[Medication Info API] Manual seeding triggered...");
      await storage.ensureMedicationInfoSeeded();
      const medications = await storage.getAllMedicationInfo();
      res.json({ 
        message: "Seeding completed", 
        count: medications.length,
        medications 
      });
    } catch (error) {
      console.error("Error seeding medication info:", error);
      res.status(500).json({ message: "Failed to seed medication information", error: String(error) });
    }
  });

  app.get("/api/medications/info/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`[Medication Info API] Looking up medication by ID: "${id}"`);
      
      const medication = await storage.getMedicationInfoById(id);
      if (!medication) {
        console.log(`[Medication Info API] Medication not found: "${id}"`);
        return res.status(404).json({ message: "Medication not found" });
      }
      
      console.log(`[Medication Info API] Found medication: ${medication.name}`);
      res.json(medication);
    } catch (error) {
      console.error("Error fetching medication info:", error);
      res.status(500).json({ message: "Failed to fetch medication information" });
    }
  });

  // Create new medication info (admin/public - for adding custom medications)
  app.post("/api/medications/info", async (req, res) => {
    try {
      const { name, generic, class: medClass, purpose, route, timing, commonSideEffects, seriousSideEffects, monitoringNotes, patientNotes, reference, videoLink } = req.body;
      
      if (!name || !generic || !medClass || !purpose || !route || !timing) {
        return res.status(400).json({ message: "Missing required fields: name, generic, class, purpose, route, timing" });
      }

      // Generate ID from name (lowercase, replace spaces with underscores)
      const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      
      const newMedication = await storage.createMedicationInfo({
        id,
        name,
        generic,
        class: medClass,
        purpose,
        route,
        timing,
        commonSideEffects: commonSideEffects || [],
        seriousSideEffects: seriousSideEffects || [],
        monitoringNotes: monitoringNotes || null,
        patientNotes: patientNotes || null,
        reference: reference || null,
        videoLink: videoLink || null,
      });

      console.log(`[Medication Info API] Created new medication: ${newMedication.name}`);
      res.status(201).json(newMedication);
    } catch (error: any) {
      console.error("Error creating medication info:", error);
      if (error?.code === '23505') {
        return res.status(409).json({ message: "Medication with this name already exists" });
      }
      res.status(500).json({ message: "Failed to create medication information" });
    }
  });

  app.post("/api/medications", isAuthenticated, async (req: any, res) => {
    try {
      const medicationData = insertMedicationSchema.parse(req.body);
      const medication = await storage.createMedication(medicationData);
      res.json(medication);
    } catch (error) {
      console.error("Error creating medication:", error);
      res.status(500).json({ message: "Failed to create medication" });
    }
  });

  app.patch("/api/medications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const medication = await storage.updateMedication(id, updateData);
      res.json(medication);
    } catch (error) {
      console.error("Error updating medication:", error);
      res.status(500).json({ message: "Failed to update medication" });
    }
  });

  app.delete("/api/medications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Verify the medication belongs to the user
      const existingMedication = await storage.getMedicationById(id);
      if (!existingMedication) {
        return res.status(404).json({ message: "Medication not found" });
      }
      
      // Verify the cycle belongs to the user
      const cycle = await storage.getCycleById(existingMedication.cycleId);
      if (!cycle || cycle.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      await storage.deleteMedication(id);
      res.json({ message: "Medication deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting medication:", error);
      if (error.message === "Medication not found") {
        return res.status(404).json({ message: "Medication not found" });
      }
      res.status(500).json({ message: "Failed to delete medication" });
    }
  });

  app.post(
    "/api/medications/:id/log",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { date, taken, notes } = req.body;

        const log = await storage.logMedication({
          medicationId: id,
          date,
          taken,
          takenAt: taken ? new Date() : null,
          notes,
        });

        res.json(log);
      } catch (error) {
        console.error("Error logging medication:", error);
        res.status(500).json({ message: "Failed to log medication" });
      }
    },
  );

  // Get all medication logs for a cycle
  app.get(
    "/api/cycles/:cycleId/medication-logs",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { cycleId } = req.params;
        const medications = await storage.getCycleMedications(cycleId);
        const medicationIds = medications.map(m => m.id);
        
        if (medicationIds.length === 0) {
          return res.json([]);
        }

        const logs = await storage.getCycleMedicationLogs(cycleId);

        res.json(logs);
      } catch (error) {
        console.error("Error fetching medication logs:", error);
        res.status(500).json({ message: "Failed to fetch medication logs" });
      }
    },
  );

  // Symptom routes
  app.get(
    "/api/cycles/:cycleId/symptoms",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { cycleId } = req.params;
        const symptoms = await storage.getCycleSymptoms(cycleId);
        res.json(symptoms);
      } catch (error) {
        console.error("Error fetching symptoms:", error);
        res.status(500).json({ message: "Failed to fetch symptoms" });
      }
    },
  );

  app.post("/api/symptoms", isAuthenticated, async (req: any, res) => {
    try {
      const symptomData = insertSymptomSchema.parse(req.body);

      // Check if symptoms already exist for this date
      const existing = await storage.getSymptomsByDate(
        symptomData.cycleId,
        symptomData.date,
      );

      if (existing) {
        // Update existing symptoms
        const updated = await storage.updateSymptom(existing.id, symptomData);
        res.json(updated);
      } else {
        // Create new symptoms
        const symptom = await storage.createSymptom(symptomData);
        res.json(symptom);
      }
    } catch (error) {
      console.error("Error saving symptoms:", error);
      res.status(500).json({ message: "Failed to save symptoms" });
    }
  });

  app.patch("/api/symptoms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Verify the symptom belongs to the user
      const existingSymptom = await storage.getSymptomById(id);
      if (!existingSymptom) {
        return res.status(404).json({ message: "Symptom not found" });
      }
      
      // Verify the cycle belongs to the user
      const cycle = await storage.getCycleById(existingSymptom.cycleId);
      if (!cycle || cycle.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updateData = req.body;
      const symptom = await storage.updateSymptom(id, updateData);
      res.json(symptom);
    } catch (error) {
      console.error("Error updating symptom:", error);
      res.status(500).json({ message: "Failed to update symptom" });
    }
  });

  app.delete("/api/symptoms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Verify the symptom belongs to the user
      const existingSymptom = await storage.getSymptomById(id);
      if (!existingSymptom) {
        return res.status(404).json({ message: "Symptom not found" });
      }
      
      // Verify the cycle belongs to the user
      const cycle = await storage.getCycleById(existingSymptom.cycleId);
      if (!cycle || cycle.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      await storage.deleteSymptom(id);
      res.json({ message: "Symptom deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting symptom:", error);
      if (error.message === "Symptom not found") {
        return res.status(404).json({ message: "Symptom not found" });
      }
      res.status(500).json({ message: "Failed to delete symptom" });
    }
  });

  // Test results routes
  app.get(
    "/api/cycles/:cycleId/test-results",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { cycleId } = req.params;
        const results = await storage.getCycleTestResults(cycleId);
        res.json(results);
      } catch (error) {
        console.error("Error fetching test results:", error);
        res.status(500).json({ message: "Failed to fetch test results" });
      }
    },
  );

  app.post("/api/test-results", isAuthenticated, async (req: any, res) => {
    try {
      const resultData = insertTestResultSchema.parse(req.body);
      const result = await storage.createTestResult(resultData);
      res.json(result);
    } catch (error) {
      console.error("Error creating test result:", error);
      res.status(500).json({ message: "Failed to create test result" });
    }
  });

  app.patch("/api/test-results/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Verify the test result belongs to the user
      const existingResult = await storage.getTestResultById(id);
      if (!existingResult) {
        return res.status(404).json({ message: "Test result not found" });
      }
      
      // Verify the cycle belongs to the user
      const cycle = await storage.getCycleById(existingResult.cycleId);
      if (!cycle || cycle.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updateData = req.body;
      const result = await storage.updateTestResult(id, updateData);
      res.json(result);
    } catch (error) {
      console.error("Error updating test result:", error);
      res.status(500).json({ message: "Failed to update test result" });
    }
  });

  app.delete("/api/test-results/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Verify the test result belongs to the user
      const existingResult = await storage.getTestResultById(id);
      if (!existingResult) {
        return res.status(404).json({ message: "Test result not found" });
      }
      
      // Verify the cycle belongs to the user
      const cycle = await storage.getCycleById(existingResult.cycleId);
      if (!cycle || cycle.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      await storage.deleteTestResult(id);
      res.json({ message: "Test result deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting test result:", error);
      if (error.message === "Test result not found") {
        return res.status(404).json({ message: "Test result not found" });
      }
      res.status(500).json({ message: "Failed to delete test result" });
    }
  });

  // Appointment routes
  app.get(
    "/api/appointments/upcoming",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        console.log(`[GET /api/appointments/upcoming] Fetching appointments for user ${userId}`);
        const appointments = await storage.getUserUpcomingAppointments(userId);
        console.log(`[GET /api/appointments/upcoming] Returning ${appointments.length} appointments`);
        res.json(appointments);
      } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({ message: "Failed to fetch appointments" });
      }
    },
  );

  app.post("/api/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const payload = { ...req.body };

      if (payload.date) {
        const dateValue = new Date(payload.date);
        if (isNaN(dateValue.getTime())) {
          return res.status(400).json({ message: "Invalid appointment date" });
        }
        payload.date = dateValue;
      }

      const appointmentData = insertAppointmentSchema.parse(payload);
      
      // CRITICAL SECURITY: Validate that the cycle belongs to the authenticated user
      const cycle = await storage.getCycleById(appointmentData.cycleId);
      if (!cycle) {
        return res.status(404).json({ message: "Cycle not found" });
      }
      if (cycle.userId !== userId) {
        console.error(`[SECURITY] User ${userId} attempted to create appointment for cycle ${appointmentData.cycleId} owned by ${cycle.userId}`);
        return res.status(403).json({ message: "Access denied: Cycle does not belong to you" });
      }
      
      // storage.createAppointment will check for duplicates and return existing if found
      // This is the single source of truth for duplicate prevention
      const appointment = await storage.createAppointment(appointmentData);
      res.json(appointment);
    } catch (error) {
      console.error("Error creating appointment:", error);
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  app.patch("/api/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Verify the appointment belongs to the user
      const existingAppointment = await storage.getAppointmentById(id);
      if (!existingAppointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // Verify the cycle belongs to the user
      const cycle = await storage.getCycleById(existingAppointment.cycleId);
      if (!cycle || cycle.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updateData = req.body;
      if (updateData.date) {
        const dateValue = new Date(updateData.date);
        if (isNaN(dateValue.getTime())) {
          return res.status(400).json({ message: "Invalid appointment date" });
        }
        updateData.date = dateValue;
      }
      
      const appointment = await storage.updateAppointment(id, updateData);
      res.json(appointment);
    } catch (error) {
      console.error("Error updating appointment:", error);
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  app.delete("/api/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Verify the appointment belongs to the user
      const existingAppointment = await storage.getAppointmentById(id);
      if (!existingAppointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // Verify the cycle belongs to the user
      const cycle = await storage.getCycleById(existingAppointment.cycleId);
      if (!cycle || cycle.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      await storage.deleteAppointment(id);
      res.json({ message: "Appointment deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting appointment:", error);
      if (error.message === "Appointment not found") {
        return res.status(404).json({ message: "Appointment not found" });
      }
      res.status(500).json({ message: "Failed to delete appointment" });
    }
  });

  // Doctor routes
  console.log("[Routes] Registering doctor routes...");
  app.get("/api/doctors", async (req, res) => {
    try {
      const { query, location, specialty, bulkBilling, telehealth, weekendHours, experience, distance, sortBy } = req.query;
      console.log(`[GET /api/doctors] Query params:`, { query, location, specialty, bulkBilling, telehealth, weekendHours, experience, distance, sortBy });
      const doctors = await storage.searchDoctors(
        query as string,
        location as string,
        specialty as string,
        bulkBilling === "true" ? true : bulkBilling === "false" ? false : undefined,
        sortBy as "rating" | "name" | "reviews" | "distance" | undefined,
        telehealth === "true" ? true : undefined,
        weekendHours === "true" ? true : undefined,
        experience as string | undefined,
        distance as string | undefined,
      );
      console.log(`[GET /api/doctors] Returning ${doctors.length} doctors`);
      res.json(doctors);
    } catch (error) {
      console.error("Error searching doctors:", error);
      res.status(500).json({ message: "Failed to search doctors" });
    }
  });

  app.get("/api/doctors/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const doctor = await storage.getDoctor(id);
      if (!doctor) {
        return res.status(404).json({ message: "Doctor not found" });
      }
      res.json(doctor);
    } catch (error) {
      console.error("Error fetching doctor:", error);
      res.status(500).json({ message: "Failed to fetch doctor" });
    }
  });

  app.post("/api/doctors", async (req, res) => {
    try {
      const rawData = req.body;
      
      // Validate and sanitize phone number if provided
      if (rawData.phone !== undefined && rawData.phone !== null) {
        if (rawData.phone === "") {
          rawData.phone = null;
        } else {
          const digitsOnly = String(rawData.phone).replace(/\D/g, '');
          if (digitsOnly.length < 10 || digitsOnly.length > 15) {
            return res.status(400).json({ 
              message: "Phone number must be 10-15 digits" 
            });
          }
          rawData.phone = digitsOnly;
        }
      }
      
      const doctorData = insertDoctorSchema.parse(rawData);
      const doctor = await storage.createDoctor(doctorData);
      res.json(doctor);
    } catch (error: any) {
      console.error("Error creating doctor:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid doctor data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create doctor" });
    }
  });

  console.log("[Routes] Registering PATCH /api/doctors/:id");
  app.patch("/api/doctors/:id", isAuthenticated, async (req: any, res) => {
    try {
      console.log(`[PATCH /api/doctors/:id] Route hit with id: ${req.params.id}`);
      const { id } = req.params;
      
      // Validate phone number if provided in update
      const updateData = { ...req.body };
      if (updateData.phone !== undefined) {
        if (updateData.phone === null || updateData.phone === "") {
          updateData.phone = null;
        } else {
          const digitsOnly = String(updateData.phone).replace(/\D/g, '');
          if (digitsOnly.length < 10 || digitsOnly.length > 15) {
            return res.status(400).json({ 
              message: "Phone number must be 10-15 digits" 
            });
          }
          updateData.phone = digitsOnly;
        }
      }
      
      // Note: In a production app, you'd check if user created the doctor or is admin
      // For now, we'll allow any authenticated user to edit
      const doctor = await storage.updateDoctor(id, updateData);
      console.log(`[PATCH /api/doctors/:id] Successfully updated doctor: ${id}`);
      res.json(doctor);
    } catch (error: any) {
      console.error("Error updating doctor:", error);
      if (error.message === "Doctor not found") {
        return res.status(404).json({ message: "Doctor not found" });
      }
      res.status(500).json({ message: "Failed to update doctor" });
    }
  });

  console.log("[Routes] Registering DELETE /api/doctors/:id");
  app.delete("/api/doctors/:id", isAuthenticated, async (req: any, res) => {
    try {
      console.log(`[DELETE /api/doctors/:id] Route hit with id: ${req.params.id}`);
      const { id } = req.params;
      // Note: In a production app, you'd check if user created the doctor or is admin
      // For now, we'll allow any authenticated user to delete
      await storage.deleteDoctor(id);
      console.log(`[DELETE /api/doctors/:id] Successfully deleted doctor: ${id}`);
      res.json({ message: "Doctor deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting doctor:", error);
      if (error.message === "Doctor not found") {
        return res.status(404).json({ message: "Doctor not found" });
      }
      res.status(500).json({ message: "Failed to delete doctor" });
    }
  });

  app.get("/api/doctors/:id/reviews", async (req, res) => {
    try {
      const { id } = req.params;
      const sortBy = req.query.sortBy as "recent" | "best" | "worst" | undefined;
      const reviews = await storage.getDoctorReviews(id, sortBy);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.post(
    "/api/doctors/:id/reviews",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const userId = req.user.id;
        const reviewData = insertDoctorReviewSchema.parse({
          ...req.body,
          doctorId: id,
          userId,
        });
        const review = await storage.createDoctorReview(reviewData);
        res.json(review);
      } catch (error) {
        console.error("Error creating review:", error);
        res.status(500).json({ message: "Failed to create review" });
      }
    },
  );

  app.patch(
    "/api/doctors/:id/reviews/:reviewId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { reviewId } = req.params;
        const userId = req.user.id;
        
        // Check if review exists and belongs to user
        const reviews = await storage.getDoctorReviews(req.params.id);
        const review = reviews.find(r => r.id === reviewId);
        
        if (!review) {
          return res.status(404).json({ message: "Review not found" });
        }
        
        if (review.userId !== userId) {
          return res.status(403).json({ message: "You can only edit your own reviews" });
        }
        
        const updated = await storage.updateDoctorReview(reviewId, req.body);
        res.json(updated);
      } catch (error: any) {
        console.error("Error updating review:", error);
        if (error.message === "Review not found") {
          return res.status(404).json({ message: "Review not found" });
        }
        res.status(500).json({ message: "Failed to update review" });
      }
    },
  );

  app.delete(
    "/api/doctors/:id/reviews/:reviewId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { reviewId } = req.params;
        const userId = req.user.id;
        
        // Check if review exists and belongs to user
        const reviews = await storage.getDoctorReviews(req.params.id);
        const review = reviews.find(r => r.id === reviewId);
        
        if (!review) {
          return res.status(404).json({ message: "Review not found" });
        }
        
        if (review.userId !== userId) {
          return res.status(403).json({ message: "You can only delete your own reviews" });
        }
        
        await storage.deleteDoctorReview(reviewId);
        res.json({ message: "Review deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting review:", error);
        if (error.message === "Review not found") {
          return res.status(404).json({ message: "Review not found" });
        }
        res.status(500).json({ message: "Failed to delete review" });
      }
    },
  );

  // Review helpfulness voting
  app.post(
    "/api/reviews/:reviewId/helpful",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { reviewId } = req.params;
        const userId = req.user.id;
        const { helpful } = req.body; // true or false

        if (typeof helpful !== "boolean") {
          return res.status(400).json({ message: "helpful must be a boolean" });
        }

        const result = await storage.toggleReviewHelpfulness(reviewId, userId, helpful);
        res.json(result);
      } catch (error) {
        console.error("Error toggling review helpfulness:", error);
        res.status(500).json({ message: "Failed to toggle review helpfulness" });
      }
    },
  );

  app.get(
    "/api/reviews/:reviewId/helpful",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { reviewId } = req.params;
        const userId = req.user.id;

        const vote = await storage.getUserReviewVote(reviewId, userId);
        res.json({ helpful: vote });
      } catch (error) {
        console.error("Error getting user review vote:", error);
        res.status(500).json({ message: "Failed to get user review vote" });
      }
    },
  );

  // Create new doctor/clinic
  app.post(
    "/api/doctors",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const doctorData = insertDoctorSchema.parse(req.body);
        const doctor = await storage.createDoctor(doctorData);
        res.json(doctor);
      } catch (error: any) {
        console.error("Error creating doctor:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid doctor data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create doctor" });
      }
    },
  );

  // Forum routes
  // Community articles endpoint (public, no auth required)
  app.get("/api/community/articles", async (req, res) => {
    try {
      // Ensure articles are seeded
      await storage.ensureCommunityArticlesSeeded();
      const articles = await storage.getCommunityArticles();
      res.json(articles);
    } catch (error) {
      console.error("Error fetching community articles:", error);
      res.status(500).json({ message: "Failed to fetch community articles" });
    }
  });

  app.get("/api/forum/posts", async (req: any, res) => {
    try {
      const { category, limit } = req.query;
      const userId = req.user?.id; // Get userId if authenticated
      const posts = await storage.getForumPosts(
        category as string,
        limit ? parseInt(limit as string) : undefined,
        userId,
      );
      res.json(posts);
    } catch (error) {
      console.error("Error fetching forum posts:", error);
      res.status(500).json({ message: "Failed to fetch forum posts" });
    }
  });

  app.get("/api/forum/posts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const post = await storage.getForumPost(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      res.json(post);
    } catch (error) {
      console.error("Error fetching forum post:", error);
      res.status(500).json({ message: "Failed to fetch forum post" });
    }
  });

  app.post("/api/forum/posts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const postData = insertForumPostSchema.parse({
        ...req.body,
        userId,
      });
      const post = await storage.createForumPost(postData);
      res.json(post);
    } catch (error) {
      console.error("Error creating forum post:", error);
      res.status(500).json({ message: "Failed to create forum post" });
    }
  });

  app.delete("/api/forum/posts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      await storage.deleteForumPost(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting forum post:", error);
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to delete forum post" });
    }
  });

  app.get("/api/forum/posts/:id/comments", async (req, res) => {
    try {
      const { id } = req.params;
      const comments = await storage.getForumComments(id);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post(
    "/api/forum/posts/:id/comments",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const userId = req.user.id;
        const commentData = insertForumCommentSchema.parse({
          ...req.body,
          postId: id,
          userId,
        });
        const comment = await storage.createForumComment(commentData);
        res.json(comment);
      } catch (error) {
        console.error("Error creating comment:", error);
        res.status(500).json({ message: "Failed to create comment" });
      }
    },
  );

  app.post(
    "/api/forum/posts/:id/like",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        await storage.likeForumPost(id);
        res.json({ success: true });
      } catch (error) {
        console.error("Error liking post:", error);
        res.status(500).json({ message: "Failed to like post" });
      }
    },
  );

  app.post(
    "/api/forum/posts/:id/react",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { reaction } = req.body;
        const userId = req.user.id;

        if (!reaction || typeof reaction !== "string") {
          return res.status(400).json({ message: "Reaction type is required" });
        }

        await storage.reactToForumPost(id, userId, reaction);
        res.json({ success: true });
      } catch (error) {
        console.error("Error reacting to post:", error);
        res.status(500).json({ message: "Failed to react to post" });
      }
    },
  );

  // Direct messaging routes
  app.get("/api/messages/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/messages/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const count = await storage.getUnreadMessageCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.get("/api/messages/:otherUserId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { otherUserId } = req.params;
      const messages = await storage.getMessages(userId, otherUserId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { receiverId, content } = req.body;

      if (!receiverId || !content) {
        return res.status(400).json({ message: "Receiver ID and content are required" });
      }

      const messageData = insertDirectMessageSchema.parse({
        senderId: userId,
        receiverId,
        content,
        read: false,
      });

      const message = await storage.sendDirectMessage(messageData);
      res.json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.post("/api/messages/:senderId/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { senderId } = req.params;
      await storage.markMessagesAsRead(userId, senderId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  // Chat routes
  app.get("/api/chat/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const messages = await storage.getUserChatMessages(userId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post("/api/chat/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { content } = req.body;

      // Save user message
      await storage.createChatMessage({
        userId,
        content,
        role: "user",
      });

      // Get conversation history
      const history = await storage.getUserChatMessages(userId);
      const conversationHistory = history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Generate AI response
      const aiResponse = await generateChatResponse(
        content,
        conversationHistory,
      );

      // Save AI response
      const aiMessage = await storage.createChatMessage({
        userId,
        content: aiResponse.message,
        role: "assistant",
      });

      res.json({
        message: aiMessage,
        suggestions: aiResponse.suggestions,
      });
    } catch (error) {
      console.error("Error in chat:", error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  // Event logging routes
  app.get("/api/events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const events = await storage.getUserEvents(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const event = await storage.getEventById(id);

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Verify user owns this event
      if (event.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.get("/api/cycles/:cycleId/events", isAuthenticated, async (req: any, res) => {
    try {
      const { cycleId } = req.params;

      // Verify user owns this cycle
      const cycle = await storage.getCycleById(cycleId);
      if (!cycle || cycle.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const events = await storage.getCycleEvents(cycleId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching cycle events:", error);
      res.status(500).json({ message: "Failed to fetch cycle events" });
    }
  });

  app.post("/api/events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const eventData = req.body;

      // Validate required fields
      if (!eventData.eventType || !eventData.title || !eventData.date) {
        return res.status(400).json({
          message: "Event type, title, and date are required",
        });
      }

      // If cycleId is provided, verify user owns the cycle
      if (eventData.cycleId) {
        const cycle = await storage.getCycleById(eventData.cycleId);
        if (!cycle || cycle.userId !== userId) {
          return res.status(403).json({ message: "Access denied to cycle" });
        }
      }

      const newEvent = await storage.createEvent({
        ...eventData,
        userId,
      });

      // Send notifications for doctor_visit appointments
      if (eventData.eventType === "doctor_visit" && eventData.doctorName) {
        try {
          // Get user information
          const user = await storage.getUser(userId);
          const patientName = user 
            ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Patient"
            : "Patient";

          // Get doctor information
          const doctors = await storage.searchDoctors(eventData.doctorName);
          const doctor = doctors.find(d => d.name === eventData.doctorName) || doctors[0];

          if (doctor) {
            // Notify doctor
            await notifyDoctorOfAppointment({
              doctorName: doctor.name,
              doctorEmail: doctor.email || undefined,
              doctorPhone: doctor.phone || undefined,
              patientName,
              appointmentDate: eventData.date,
              appointmentTime: eventData.time || undefined,
              location: eventData.location || doctor.location || undefined,
              notes: eventData.personalNotes || undefined,
            });

            // Notify patient (if email available)
            if (user?.email) {
              await notifyPatientOfAppointment(
                user.email,
                patientName,
                {
                  doctorName: doctor.name,
                  doctorEmail: doctor.email || undefined,
                  doctorPhone: doctor.phone || undefined,
                  patientName,
                  appointmentDate: eventData.date,
                  appointmentTime: eventData.time || undefined,
                  location: eventData.location || doctor.location || undefined,
                  notes: eventData.personalNotes || undefined,
                }
              );
            }
          } else {
            console.warn(`[Events] Doctor "${eventData.doctorName}" not found in database. Skipping notifications.`);
          }
        } catch (notificationError) {
          // Don't fail the request if notifications fail
          console.error("[Events] Failed to send appointment notifications:", notificationError);
        }
      }

      res.status(201).json(newEvent);
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.patch("/api/events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updates = req.body;

      // Verify user owns this event
      const existingEvent = await storage.getEventById(id);
      if (!existingEvent) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (existingEvent.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedEvent = await storage.updateEvent(id, updates);
      res.json(updatedEvent);
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  app.delete("/api/events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Verify user owns this event
      const existingEvent = await storage.getEventById(id);
      if (!existingEvent) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (existingEvent.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteEvent(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Educational Articles routes
  app.get("/api/educational-articles", async (req: any, res) => {
    try {
      const { phase, cycleType, cycleDay, limit, featured } = req.query;
      
      const filters: any = {};
      if (phase) filters.phase = phase;
      if (cycleType) filters.cycleType = cycleType;
      if (cycleDay) filters.cycleDay = parseInt(cycleDay as string);
      if (limit) filters.limit = parseInt(limit as string);
      if (featured !== undefined) filters.featured = featured === 'true';

      const articles = await storage.getEducationalArticles(filters);
      res.json(articles);
    } catch (error) {
      console.error("Error fetching educational articles:", error);
      res.status(500).json({ message: "Failed to fetch educational articles" });
    }
  });

  app.get("/api/educational-articles/:slug", async (req: any, res) => {
    try {
      const { slug } = req.params;
      const article = await storage.getEducationalArticleBySlug(slug);
      
      if (!article) {
        return res.status(404).json({ message: "Article not found" });
      }
      
      res.json(article);
    } catch (error) {
      console.error("Error fetching educational article:", error);
      res.status(500).json({ message: "Failed to fetch educational article" });
    }
  });

  // Reference data routes
  app.get("/api/reference/treatment-types", async (req, res) => {
    try {
      const types = await storage.getTreatmentTypes();
      res.json(types);
    } catch (error) {
      console.error("Error fetching treatment types:", error);
      res.status(500).json({ message: "Failed to fetch treatment types" });
    }
  });

  app.get("/api/reference/clinics", async (req, res) => {
    try {
      const clinics = await storage.getClinics();
      res.json(clinics);
    } catch (error) {
      console.error("Error fetching clinics:", error);
      res.status(500).json({ message: "Failed to fetch clinics" });
    }
  });

  app.get("/api/reference/cycle-types", async (req, res) => {
    try {
      const types = await storage.getCycleTypes();
      res.json(types);
    } catch (error) {
      console.error("Error fetching cycle types:", error);
      res.status(500).json({ message: "Failed to fetch cycle types" });
    }
  });

  app.get("/api/reference/event-types", async (req, res) => {
    try {
      const types = await storage.getEventTypes();
      res.json(types);
    } catch (error) {
      console.error("Error fetching event types:", error);
      res.status(500).json({ message: "Failed to fetch event types" });
    }
  });

  app.get("/api/reference/milestone-types", async (req, res) => {
    try {
      const cycleType = req.query.cycleType as string | undefined;
      const types = await storage.getMilestoneTypes(cycleType);
      res.json(types);
    } catch (error) {
      console.error("Error fetching milestone types:", error);
      res.status(500).json({ message: "Failed to fetch milestone types" });
    }
  });

  app.get("/api/reference/stages", async (_req, res) => {
    try {
      const stages = await storage.getStageReferenceData();
      res.json(stages);
    } catch (error) {
      console.error("Error fetching stage data:", error);
      res.status(500).json({ message: "Failed to fetch stage data" });
    }
  });

  // Ensure reference data is seeded on startup
  storage.ensureReferenceDataSeeded().catch((error) => {
    console.error("Error seeding reference data:", error);
  });

  console.log("[Routes] All routes registered successfully");
  const httpServer = createServer(app);
  return httpServer;
}
