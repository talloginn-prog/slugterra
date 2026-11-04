import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const playerProgress = sqliteTable('player_progress', {
  userId: text('user_id').primaryKey().notNull(),
  progress: text('progress').notNull(),
  revision: integer('revision').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
});
