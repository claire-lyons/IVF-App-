import { db, ensureDbInitialized } from "../server/db";
import { forumPosts } from "../shared/schema";
import { eq } from "drizzle-orm";

const ids = [
  "d4f59e90-d08c-47dd-bc8a-c99376aa4028",
  "96eefc82-16b9-4c24-9c0f-518dcbc6b2ba",
];

const main = async () => {
  await ensureDbInitialized();
  for (const id of ids) {
    await db.delete(forumPosts).where(eq(forumPosts.id, id));
    console.log(`Deleted ${id}`);
  }
};

main().catch((error) => {
  console.error("Failed to delete posts:", error);
  process.exit(1);
});
