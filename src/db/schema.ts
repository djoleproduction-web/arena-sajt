import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * Artists — roster of music artists managed in the workspace.
 */
export const artists = pgTable("artists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * One connection row per (artist, platform) pair.
 * status: 'connected' | 'disconnected'
 */
export const platformConnections = pgTable(
  "platform_connections",
  {
    id: serial("id").primaryKey(),
    artistId: integer("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(), // 'tiktok' | 'instagram' | 'youtube'
    accountHandle: text("account_handle").notNull(),
    status: text("status").notNull().default("disconnected"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("platform_connections_artist_platform_uniq").on(t.artistId, t.platform),
    index("platform_connections_artist_idx").on(t.artistId),
  ]
);

/**
 * Scheduled video posts.
 * status: 'draft' | 'scheduled' | 'published'
 * executionType: 'direct_publish' | 'send_to_draft'
 */
export const scheduledPosts = pgTable(
  "scheduled_posts",
  {
    id: serial("id").primaryKey(),
    artistId: integer("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    caption: text("caption").notNull().default(""),
    hashtags: text("hashtags").notNull().default(""),
    platforms: text("platforms").array().notNull().default([]),
    status: text("status").notNull().default("draft"),
    executionType: text("execution_type").notNull().default("direct_publish"),
    scheduledTime: timestamp("scheduled_time", { mode: "date" }),
    videoUrl: text("video_url"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("scheduled_posts_artist_idx").on(t.artistId),
    index("scheduled_posts_time_idx").on(t.scheduledTime),
  ]
);

export type ArtistRow = typeof artists.$inferSelect;
export type ConnectionRow = typeof platformConnections.$inferSelect;
export type PostRow = typeof scheduledPosts.$inferSelect;
