CREATE TABLE IF NOT EXISTS master_boards (
  bb INTEGER NOT NULL,
  board_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bb, board_id)
);

CREATE INDEX IF NOT EXISTS idx_master_boards_bb_sort
  ON master_boards (bb, sort_order, board_id);

CREATE TABLE IF NOT EXISTS board_states (
  bb INTEGER NOT NULL,
  board_id TEXT NOT NULL,
  snapshot_json TEXT,
  thumb_png TEXT,
  preview_png TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bb, board_id)
);
