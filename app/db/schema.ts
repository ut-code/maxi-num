import {
  doublePrecision,
  index,
  integer,
  pgTable,
  real,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// スコア画面から送信されたスコア。順位は result（演算の結果の数値）が大きい順
export const scores = pgTable(
  "scores",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    stageNumber: integer().notNull(),
    name: varchar({ length: 20 }).notNull(),
    result: doublePrecision().notNull(),
    stars: real().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index("scores_stage_result_idx").on(table.stageNumber, table.result)]
);
