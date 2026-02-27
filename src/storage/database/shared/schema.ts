import { pgTable, serial, timestamp, varchar, text, boolean, jsonb, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// 系统健康检查表（Supabase 内置，不要删除）
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 用户表 - 使用本地 token 标识用户
export const users = pgTable("users", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	token: varchar("token", { length: 64 }).notNull().unique(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
}, (table) => [
	index("users_token_idx").on(table.token),
]);

// 图片记录表
export const images = pgTable("images", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	userId: varchar("user_id", { length: 36 }).notNull(),
	prompt: text("prompt").notNull(),
	model: varchar("model", { length: 128 }).notNull(),
	provider: varchar("provider", { length: 32 }).notNull(),
	status: varchar("status", { length: 32 }).notNull().default('pending'),
	imageUrl: text("image_url"),
	errorMessage: text("error_message"),
	isPublic: boolean("is_public").notNull().default(false),
	config: jsonb("config"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
}, (table) => [
	index("images_user_id_idx").on(table.userId),
	index("images_status_idx").on(table.status),
	index("images_is_public_idx").on(table.isPublic),
	index("images_created_at_idx").on(table.createdAt),
]);
