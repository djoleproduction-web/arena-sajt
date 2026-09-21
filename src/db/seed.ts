import "dotenv/config";
import { eq } from "drizzle-orm";
import { artists, platformConnections, scheduledPosts } from "./schema";
import { db } from "./index";

/**
 * Clean-slate seed.
 *
 * Wipes every content row (posts + connections — demo or otherwise) and
 * guarantees exactly the two main artists exist in `artists`:
 *
 *   - Ole_Lofi
 *   - HXDNN FXCE
 *
 * Any other artist rows created by hand are preserved; the calendar and
 * dashboard start completely empty until real posts are scheduled.
 */
const ROSTER = ["Ole_Lofi", "HXDNN FXCE"] as const;

async function main() {
  console.log("seed: wiping scheduled_posts…");
  await db.delete(scheduledPosts);

  console.log("seed: wiping platform_connections…");
  await db.delete(platformConnections);

  for (const name of ROSTER) {
    const [existing] = await db
      .select()
      .from(artists)
      .where(eq(artists.name, name));
    if (existing) {
      console.log(`seed: artist "${name}" already present (id=${existing.id})`);
    } else {
      const [row] = await db.insert(artists).values({ name }).returning();
      console.log(`seed: inserted artist "${name}" (id=${row.id})`);
    }
  }

  console.log("seed: done — database is a clean slate with the two main artists.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
