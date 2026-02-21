import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = process.env.DATABASE_URL;

// Detect if using Neon (serverless) or local PostgreSQL
const isNeon = databaseUrl.includes("neon.tech");

let db: any;
let pool: any;
let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;

const initDb = async () => {
  if (dbInitialized) {
    return;
  }
  
  if (dbInitPromise) {
    return dbInitPromise;
  }
  
  dbInitPromise = (async () => {
    try {
      if (isNeon) {
        // Use Neon serverless driver for Neon databases
        const { Pool: NeonPool, neonConfig } = await import("@neondatabase/serverless");
        const { drizzle } = await import("drizzle-orm/neon-serverless");
        const ws = await import("ws");
        
        neonConfig.webSocketConstructor = ws.default;
        pool = new NeonPool({ connectionString: databaseUrl });
        db = drizzle({ client: pool, schema });
      } else {
        // Use standard PostgreSQL driver for local databases
        const { Pool: PgPool } = await import("pg");
        const { drizzle } = await import("drizzle-orm/node-postgres");
        
        pool = new PgPool({ connectionString: databaseUrl });
        db = drizzle({ client: pool, schema });
      }
      dbInitialized = true;
      console.log("Database connected successfully");
    } catch (error) {
      console.error("Failed to connect to database:", error);
      throw error;
    }
  })();
  
  return dbInitPromise;
};

// Initialize immediately
initDb();

// Function to ensure database is initialized
export async function ensureDbInitialized() {
  if (!dbInitialized && dbInitPromise) {
    await dbInitPromise;
  } else if (!dbInitialized) {
    await initDb();
  }
  if (!db) {
    throw new Error("Database initialization failed");
  }
  return db;
}

export { db, pool };
