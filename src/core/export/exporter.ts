import { File, Paths } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";

import type { Stay, StayPhoto } from "@/core/domain/models";

export type ExportFormat = "json" | "csv";

type ExportStay = {
  id: number;
  start: string;
  end: string;
  lat: number;
  lng: number;
  radius_m: number;
  place_name: string | null;
  activity: string | null;
  confidence: number;
  photo_count: number;
};

function toIso(ts: number): string {
  return new Date(ts).toISOString();
}

function placeName(stay: Stay): string | null {
  if (stay.user_place_name) return stay.user_place_name;
  if (stay.place_json) {
    try {
      const p = JSON.parse(stay.place_json);
      return p.top?.name ?? null;
    } catch {}
  }
  return null;
}

function escapeCsv(val: string | number | null): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function fetchStaysInRange(
  db: SQLiteDatabase,
  startTs: number,
  endTs: number,
): Promise<Stay[]> {
  type StayRow = Omit<Stay, "needs_review"> & { needs_review: number };
  const rows = await db.getAllAsync<StayRow>(
    "SELECT * FROM stays WHERE start_ts >= ? AND start_ts < ? ORDER BY start_ts ASC",
    [startTs, endTs],
  );
  return rows.map((r) => ({ ...r, needs_review: Boolean(r.needs_review) }));
}

async function fetchPhotoCounts(
  db: SQLiteDatabase,
  stayIds: number[],
): Promise<Record<number, number>> {
  if (stayIds.length === 0) return {};
  const placeholders = stayIds.map(() => "?").join(",");
  const rows = await db.getAllAsync<{ stay_id: number; cnt: number }>(
    `SELECT stay_id, COUNT(*) as cnt FROM stay_photos WHERE stay_id IN (${placeholders}) GROUP BY stay_id`,
    stayIds,
  );
  const map: Record<number, number> = {};
  for (const r of rows) map[r.stay_id] = r.cnt;
  return map;
}

function buildRows(stays: Stay[], photoCounts: Record<number, number>): ExportStay[] {
  return stays.map((s) => ({
    id: s.id,
    start: toIso(s.start_ts),
    end: toIso(s.end_ts),
    lat: s.lat,
    lng: s.lng,
    radius_m: s.radius_m,
    place_name: placeName(s),
    activity: s.activity,
    confidence: s.confidence,
    photo_count: photoCounts[s.id] ?? 0,
  }));
}

function toJson(rows: ExportStay[]): string {
  return JSON.stringify(rows, null, 2);
}

function toCsv(rows: ExportStay[]): string {
  const header = "id,start,end,lat,lng,radius_m,place_name,activity,confidence,photo_count";
  const lines = rows.map((r) =>
    [r.id, r.start, r.end, r.lat, r.lng, r.radius_m, escapeCsv(r.place_name), escapeCsv(r.activity), r.confidence, r.photo_count].join(","),
  );
  return [header, ...lines].join("\n");
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export async function exportData(
  db: SQLiteDatabase,
  startDate: Date,
  endDate: Date,
  format: ExportFormat,
): Promise<string> {
  const startTs = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
  const endTs = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1).getTime();

  const stays = await fetchStaysInRange(db, startTs, endTs);
  const photoCounts = await fetchPhotoCounts(db, stays.map((s) => s.id));
  const rows = buildRows(stays, photoCounts);

  const content = format === "json" ? toJson(rows) : toCsv(rows);
  const ext = format === "json" ? "json" : "csv";
  const filename = `tracenote_${fmtDate(startDate)}-${fmtDate(endDate)}.${ext}`;

  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);

  return file.uri;
}
