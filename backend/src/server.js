import fs from "node:fs";
import path from "node:path";
import express from "express";
import pg from "pg";

const { Pool } = pg;

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://inkauth:inkauth@127.0.0.1:5432/inkauth";

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const app = express();
app.use(express.json({ limit: "50mb" }));

function parseBb(value) {
  const bb = Number(value);
  return Number.isInteger(bb) && bb > 0 ? bb : null;
}

const defaultBoard = [{ id: "board-1", name: "Шаблон 1" }];

async function ensureDefaultBoard(bb) {
  await pool.query(
    `INSERT INTO master_boards (bb, board_id, name, sort_order)
     VALUES ($1, 'board-1', 'Шаблон 1', 0)
     ON CONFLICT (bb, board_id) DO NOTHING`,
    [bb],
  );
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

app.get("/api/master-boards/:bb", async (req, res) => {
  const bb = parseBb(req.params.bb);
  if (!bb) return res.status(400).json({ error: "Invalid bb" });

  try {
    await ensureDefaultBoard(bb);
    const { rows } = await pool.query(
      `SELECT board_id, name
       FROM master_boards
       WHERE bb = $1
       ORDER BY sort_order ASC, board_id ASC`,
      [bb],
    );
    const boards = rows.map((row) => ({ id: row.board_id, name: row.name }));
    res.json({ boards: boards.length ? boards : defaultBoard });
  } catch (error) {
    res.status(500).json({ error: String(error?.message || error) });
  }
});

app.put("/api/master-boards/:bb", async (req, res) => {
  const bb = parseBb(req.params.bb);
  if (!bb) return res.status(400).json({ error: "Invalid bb" });
  const boards = Array.isArray(req.body?.boards) ? req.body.boards : null;
  if (!boards) return res.status(400).json({ error: "boards array is required" });

  const normalized = boards
    .map((board, index) => ({
      id: String(board?.id || "").trim(),
      name: String(board?.name || "").trim(),
      sort: index,
    }))
    .filter((board) => board.id && board.name);

  if (!normalized.length) normalized.push({ id: "board-1", name: "Шаблон 1", sort: 0 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM master_boards WHERE bb = $1", [bb]);
    for (const board of normalized) {
      await client.query(
        `INSERT INTO master_boards (bb, board_id, name, sort_order, updated_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [bb, board.id, board.name, board.sort],
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: String(error?.message || error) });
  } finally {
    client.release();
  }
});

app.get("/api/board-state/:bb/:boardId", async (req, res) => {
  const bb = parseBb(req.params.bb);
  const boardId = String(req.params.boardId || "").trim();
  if (!bb || !boardId) return res.status(400).json({ error: "Invalid board identity" });
  const previewOnly = req.query?.previewOnly === "1";

  try {
    const { rows } = await pool.query(
      `SELECT snapshot_json, thumb_png, preview_png, updated_at
       FROM board_states
       WHERE bb = $1 AND board_id = $2`,
      [bb, boardId],
    );
    if (!rows.length) return res.json({ found: false });
    const row = rows[0];
    if (previewOnly) {
      return res.json({
        found: true,
        thumb: row.thumb_png || null,
        preview: row.preview_png || null,
        updatedAt: row.updated_at,
      });
    }
    res.json({
      found: true,
      snapshot: row.snapshot_json || null,
      thumb: row.thumb_png || null,
      preview: row.preview_png || null,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    res.status(500).json({ error: String(error?.message || error) });
  }
});

app.put("/api/board-state/:bb/:boardId", async (req, res) => {
  const bb = parseBb(req.params.bb);
  const boardId = String(req.params.boardId || "").trim();
  if (!bb || !boardId) return res.status(400).json({ error: "Invalid board identity" });

  const snapshot = typeof req.body?.snapshot === "string" ? req.body.snapshot : null;
  const thumb = typeof req.body?.thumb === "string" ? req.body.thumb : null;
  const preview = typeof req.body?.preview === "string" ? req.body.preview : null;

  try {
    await pool.query(
      `INSERT INTO board_states (bb, board_id, snapshot_json, thumb_png, preview_png, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (bb, board_id)
       DO UPDATE SET
         snapshot_json = EXCLUDED.snapshot_json,
         thumb_png = EXCLUDED.thumb_png,
         preview_png = EXCLUDED.preview_png,
         updated_at = NOW()`,
      [bb, boardId, snapshot, thumb, preview],
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error?.message || error) });
  }
});

const staticRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
if (fs.existsSync(path.join(staticRoot, "index.html"))) {
  app.use(express.static(staticRoot));
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on :${PORT}`);
});
