/**
 * Раздаёт корпоративный эталон из templates/ всем мастерам (ББ 1…MAX_BB).
 * Читает файлы из корня репозитория: templates/ink-company-standard.*
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

const BOARD_ID = "board-ink-company-standard";
const BOARD_NAME = "Эталонная доска";

const snapshotPath = path.join(repoRoot, "templates", "ink-company-standard.snapshot.json");
const thumbPath = path.join(repoRoot, "templates", "ink-company-standard.thumb.txt");
const previewPath = path.join(repoRoot, "templates", "ink-company-standard.preview.txt");

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://inkauth:inkauth@127.0.0.1:5432/inkauth";
const MAX_BB = Math.min(99, Math.max(1, Number(process.env.MAX_BB || 30)));

function readText(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const s = fs.readFileSync(filePath, "utf8").trim();
  return s.length ? s : null;
}

const snapshot = readText(snapshotPath);
if (!snapshot) {
  console.error(`Missing or empty: ${snapshotPath}`);
  process.exit(1);
}

const thumb = readText(thumbPath);
const preview = readText(previewPath);

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function seedBb(bb) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existing } = await client.query(
      `SELECT 1 FROM master_boards WHERE bb = $1 AND board_id = $2`,
      [bb, BOARD_ID],
    );

    if (!existing.length) {
      await client.query(`UPDATE master_boards SET sort_order = sort_order + 1 WHERE bb = $1`, [
        bb,
      ]);
      await client.query(
        `INSERT INTO master_boards (bb, board_id, name, sort_order, updated_at)
         VALUES ($1, $2, $3, 0, NOW())`,
        [bb, BOARD_ID, BOARD_NAME],
      );
    } else {
      await client.query(
        `UPDATE master_boards SET name = $3, updated_at = NOW() WHERE bb = $1 AND board_id = $2`,
        [bb, BOARD_ID, BOARD_NAME],
      );
    }

    await client.query(
      `INSERT INTO board_states (bb, board_id, snapshot_json, thumb_png, preview_png, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (bb, board_id)
       DO UPDATE SET
         snapshot_json = EXCLUDED.snapshot_json,
         thumb_png = EXCLUDED.thumb_png,
         preview_png = EXCLUDED.preview_png,
         updated_at = NOW()`,
      [bb, BOARD_ID, snapshot, thumb, preview],
    );

    await client.query("COMMIT");
    console.log(`BB ${bb}: эталон «${BOARD_NAME}» (${BOARD_ID})`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  for (let bb = 1; bb <= MAX_BB; bb += 1) {
    await seedBb(bb);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
