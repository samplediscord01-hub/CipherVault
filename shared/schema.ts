import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const mediaItems = pgTable("media_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  thumbnail: text("thumbnail"),
  type: varchar("type", { enum: ["video", "folder"] }).notNull().default("video"),
  duration: integer("duration"), // in seconds
  size: integer("size"), // in bytes
  downloadUrl: text("download_url"),
  downloadExpiresAt: timestamp("download_expires_at"),
  downloadFetchedAt: timestamp("download_fetched_at"),
  scrapedAt: timestamp("scraped_at").defaultNow(),
  error: text("error"),
  folderVideoCount: integer("folder_video_count").default(0),
  folderImageCount: integer("folder_image_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  color: varchar("color").default("primary"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mediaItemTags = pgTable("media_item_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mediaItemId: varchar("media_item_id").notNull().references(() => mediaItems.id, { onDelete: "cascade" }),
  tagId: varchar("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
});

export const apiOptions = pgTable("api_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url").notNull(),
  method: varchar("method", { enum: ["GET", "POST"] }).notNull().default("POST"),
  type: varchar("type", { enum: ["json", "query"] }).notNull().default("json"),
  field: text("field").notNull(),
  status: varchar("status", { enum: ["available", "limited", "offline"] }).notNull().default("available"),
  isActive: boolean("is_active").default(true),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertMediaItemSchema = createInsertSchema(mediaItems).omit({
  id: true,
  createdAt: true,
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
});

export const insertMediaItemTagSchema = createInsertSchema(mediaItemTags).omit({
  id: true,
});

export const insertApiOptionSchema = createInsertSchema(apiOptions).omit({
  id: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type MediaItem = typeof mediaItems.$inferSelect;
export type InsertMediaItem = z.infer<typeof insertMediaItemSchema>;

export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;

export type MediaItemTag = typeof mediaItemTags.$inferSelect;
export type InsertMediaItemTag = z.infer<typeof insertMediaItemTagSchema>;

export type ApiOption = typeof apiOptions.$inferSelect;
export type InsertApiOption = z.infer<typeof insertApiOptionSchema>;

// Extended types for frontend
export type MediaItemWithTags = MediaItem & {
  tags: Tag[];
};

export type MediaSearchParams = {
  search?: string;
  tags?: string[];
  type?: "video" | "folder";
  sizeRange?: "small" | "medium" | "large";
  page?: number;
  limit?: number;
};
