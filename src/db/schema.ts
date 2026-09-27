import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const artists = pgTable("artists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const platformConnections = pgTable(
  "platform_connections",
  {
    id: serial("id").primaryKey(),
    artistId: integer("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    accountHandle: text("account_handle").notNull(),
    status: text("status").notNull().default("disconnected"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { mode: "date" }),
    platformAccountId: text("platform_account_id"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("platform_connections_artist_platform_uniq").on(t.artistId, t.platform),
    index("platform_connections_artist_idx").on(t.artistId),
  ]
);

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
