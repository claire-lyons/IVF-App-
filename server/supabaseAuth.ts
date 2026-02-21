import type { Express, RequestHandler } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { storage } from "./storage";

let supabase: SupabaseClient | null = null;

let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseUrl.includes("=")) {
  supabaseUrl = supabaseUrl.split("=").pop() || supabaseUrl;
}

if (supabaseKey && supabaseKey.includes("=")) {
  supabaseKey = supabaseKey.split("=").pop() || supabaseKey;
}

console.log("Supabase URL:", supabaseUrl ? `${supabaseUrl.substring(0, 40)}...` : "not found");
console.log("Supabase Key:", supabaseKey ? `${supabaseKey.substring(0, 20)}...` : "not found");

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("Supabase client initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error);
  }
} else {
  console.warn("Supabase credentials not found - authentication will not work");
}

let supabaseAdmin: SupabaseClient | null = null;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseServiceRoleKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log("Supabase admin client initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Supabase admin client:", error);
  }
} else {
  console.warn("Supabase service role key not found - admin operations disabled");
}

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }
  return supabase;
}

export function getSupabaseAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized");
  }
  return supabaseAdmin;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  console.log(`[Auth] ========== AUTH MIDDLEWARE CALLED ==========`);
  console.log(`[Auth] Path: ${req.path}, Method: ${req.method}`);
  try {
    if (!supabase) {
      console.error("[Auth] ERROR: Supabase client not initialized");
      return res
        .status(500)
        .json({ message: "Authentication service unavailable" });
    }

    const authHeader = req.headers.authorization;
    console.log(`[Auth] Authorization header:`, authHeader ? "present" : "missing");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[Auth] ERROR: No valid authorization header");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.substring(7);
    console.log(`[Auth] Token extracted, length:`, token.length);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error("[Auth] ERROR: Invalid token or user not found", error);
      return res.status(401).json({ message: "Unauthorized" });
    }

    console.log(`[Auth] User authenticated:`, user.id);

    // Check if user exists in database
    let existingUser = await storage.getUser(user.id);
    
    // If user doesn't exist in database but is authenticated in Supabase,
    // this might be a signup that didn't complete. Auto-create the user.
    if (!existingUser) {
      console.warn(`[Auth] WARNING: User ${user.id} authenticated in Supabase but does not exist in database - auto-creating user record`);
      try {
        // Auto-create user in database from Supabase auth data
        existingUser = await storage.upsertUser({
          id: user.id,
          email: user.email || "",
          firstName: user.user_metadata?.firstName || "",
          lastName: user.user_metadata?.lastName || "",
          profileImageUrl: user.user_metadata?.profileImageUrl || null,
        });
        console.log(`[Auth] Successfully auto-created user record for ${user.id}`);
      } catch (error: any) {
        console.error(`[Auth] ERROR: Failed to auto-create user record:`, error);
        // If we can't create the user, return error
        return res.status(403).json({ 
          message: "Account not found. This account may have been deleted.",
          error: "ACCOUNT_DELETED"
        });
      }
    }

    // User exists - update metadata if needed
    const dbUser = await storage.updateUserProfile(user.id, {
      email: user.email || existingUser.email,
      firstName: user.user_metadata?.firstName || existingUser.firstName,
      lastName: user.user_metadata?.lastName || existingUser.lastName,
      profileImageUrl: user.user_metadata?.profileImageUrl || existingUser.profileImageUrl,
    });

    (req as any).user = {
      id: dbUser.id,
      email: dbUser.email,
      user_metadata: user.user_metadata,
    };

    console.log(`[Auth] User verified and set on request, calling next()...`);
    next();
  } catch (error) {
    console.error("[Auth] ========== AUTH ERROR ==========");
    console.error("[Auth] Error:", error);
    res.status(401).json({ message: "Unauthorized" });
  }
};

export async function deleteSupabaseUser(userId: string): Promise<boolean> {
  console.log(`[Supabase Auth] Attempting to delete user: ${userId}`);
  
  if (!supabaseAdmin) {
    console.error("[Supabase Auth] ERROR: Supabase admin client not available - cannot delete user from Supabase Auth");
    console.error("[Supabase Auth] Make sure SUPABASE_SERVICE_ROLE_KEY is set in environment variables");
    return false;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (error) {
      console.error("[Supabase Auth] ERROR deleting user:", error);
      throw error;
    }

    console.log(`[Supabase Auth] Successfully deleted user: ${userId}`);
    return true;
  } catch (error: any) {
    console.error("[Supabase Auth] Exception during user deletion:", error);
    throw error;
  }
}
