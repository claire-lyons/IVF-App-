import { db, ensureDbInitialized } from "../server/db";
import { forumPosts } from "../shared/schema";
import { desc } from "drizzle-orm";

const main = async () => {
  await ensureDbInitialized();
  const posts = await db.select().from(forumPosts).orderBy(desc(forumPosts.createdAt));
  if (posts.length === 0) {
    console.log("No forum posts found.");
    return;
  }
  console.log("Forum posts:");
  for (const post of posts) {
    const title = post.title?.replace(/\s+/g, " ").trim();
    const content = post.content?.replace(/\s+/g, " ").trim();
    const snippet = content.length > 80 ? `${content.slice(0, 80)}…` : content;
    console.log(`- ${post.id} | ${title} | ${snippet}`);
  }
};

main().catch((error) => {
  console.error("Failed to list posts:", error);
  process.exit(1);
});
