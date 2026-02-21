import { db, ensureDbInitialized } from "../server/db";
import { forumPosts } from "../shared/schema";
import { eq } from "drizzle-orm";

const isTestPost = (title: string, content: string) => {
  const hay = `${title}\n${content}`.toLowerCase();
  return (
    /^\s*test\b/.test(title.toLowerCase()) ||
    /^\s*testing\b/.test(title.toLowerCase()) ||
    hay.includes("test post") ||
    hay.includes("testing post") ||
    hay.includes("lorem ipsum")
  );
};

const main = async () => {
  await ensureDbInitialized();

  const posts = await db.select().from(forumPosts);
  const testPosts = posts.filter((post) => isTestPost(post.title, post.content));

  if (testPosts.length === 0) {
    console.log("No test forum posts found.");
    return;
  }

  console.log("Deleting test forum posts:");
  for (const post of testPosts) {
    console.log(`- ${post.id} | ${post.title}`);
    await db.delete(forumPosts).where(eq(forumPosts.id, post.id));
  }

  console.log(`Deleted ${testPosts.length} posts.`);
};

main().catch((error) => {
  console.error("Failed to delete test posts:", error);
  process.exit(1);
});
