/**
 * TC-CONCURRENCY-01 / NFR-02: N nguoi cung dat MỘT slot, he thong phai khong cho
 * double-booking. Chay end-to-end qua HTTP that (khong mock) neu co --server.
 *
 *   npm run load:concurrency -- --vus 100 --slot auto
 *   npm run load:concurrency -- --vus 500 --slot auto --confirm
 */
import { createConnection } from 'mysql2/promise';

interface Args {
  vus: number;
  baseUrl: string;
  date: string;
  confirm: boolean;
  password: string;
}

function parseArgs(): Args {
  const raw = process.argv.slice(2);
  const get = (name: string, fallback: string): string => {
    const index = raw.indexOf(`--${name}`);
    return index >= 0 && raw[index + 1] !== undefined && !raw[index + 1].startsWith('--')
      ? (raw[index + 1] as string)
      : fallback;
  };
  const date = new Date(Date.now() + 3 * 86_400_000);
  return {
    vus: Number(get('vus', '50')),
    baseUrl: get('base', process.env.PROBE_BASE_URL ?? 'http://localhost:3000'),
    date: get('date', toDate(date)),
    confirm: raw.includes('--confirm'),
    password: get('password', 'Probe@12345'),
  };
}

function toDate(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

async function json(url: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

async function pickCourtSlot(args: Args): Promise<{ slotId: number; courtId: number }> {
  const { status, body } = await json(
    `${args.baseUrl}/api/availability?date=${args.date}`,
  );
  if (status !== 200 || !Array.isArray(body?.courts) || body.courts.length === 0) {
    throw new Error(`Khong lay duoc availability (HTTP ${status}). Server chay chua?`);
  }
  for (const court of body.courts) {
    const free = (court.slots ?? []).find(
      (slot: { availability: string; holdRemainingSeconds: number }) =>
        slot.availability === 'AVAILABLE' && slot.holdRemainingSeconds === 0,
    );
    if (free) {
      return { slotId: free.slotId, courtId: court.courtId };
    }
  }
  throw new Error(`Ngay ${args.date} khong con slot AVAILABLE nao`);
}

/** SĐT unique theo tung lan chay (neu trung thi DB bat uk_users_phone_number). */
function phoneFor(runSeed: number, index: number): string {
  const prefix = '35789'[index % 5];
  const tail = String((runSeed + index * 7919) % 100_000_000).padStart(8, '0');
  return `0${prefix}${tail}`;
}

/** Mo N tai khoan khac nhau de tao xung dot that, khong dung lai 3 user seed. */
async function registerUsers(args: Args, count: number): Promise<string[]> {
  const stamp = Date.now().toString(36);
  const runSeed = Math.floor(Math.random() * 100_000_000);
  const tokens = await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const email = `probe${stamp}_${index}@test.local`;
      const phoneNumber = phoneFor(runSeed, index);
      const created = await json(`${args.baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: `Probe User ${index}`,
          email,
          phoneNumber,
          password: args.password,
        }),
      });
      if (created.status >= 400) {
        throw new Error(
          `Register probe ${index} that bai (HTTP ${created.status}): ${JSON.stringify(created.body)}`,
        );
      }
      return created.body.tokens.accessToken as string;
    }),
  );
  return tokens;
}

/**
 * Giai phong slot ve AVAILABLE de moi lan probe bat dau tu cung mot trang thai.
 * Giu lai booking tha tren (slot BOOKED thi probe se bao loi khac).
 */
async function resetSlot(slotId: number): Promise<void> {
  const connection = await createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3307),
    user: process.env.DB_USERNAME ?? 'pickleball',
    password: process.env.DB_PASSWORD ?? 'pickleball123',
    database: process.env.DB_DATABASE ?? 'pickleball_booking',
  });
  await connection.execute(
    `UPDATE booking_slots
        SET status = 'AVAILABLE', locked_by = NULL, lock_expires_at = NULL, booking_id = NULL
      WHERE slot_id = ? AND booking_id IS NULL`,
    [slotId],
  );
  await connection.end();
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log(`[probe] vus=${args.vus} date=${args.date} base=${args.baseUrl}`);

  const { slotId, courtId } = await pickCourtSlot(args);
  console.log(`[probe] slot duanh gia = ${slotId} (court ${courtId})`);

  const tokens = await registerUsers(args, args.vus);
  console.log(`[probe] da san ${tokens.length} tai khoan doc lap`);

  await resetSlot(slotId);

  const started = performance.now();
  const results = await Promise.all(
    tokens.map((token) => {
      const t0 = performance.now();
      return json(`${args.baseUrl}/api/bookings/lock`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ slotIds: [slotId] }),
      }).then((r) => ({ ...r, latencyMs: performance.now() - t0 }));
    }),
  );
  const elapsedMs = performance.now() - started;

  const winners = results.filter((r) => r.status === 201 || r.status === 200);
  const rejected = results.filter((r) => r.status === 409);
  const unexpected = results.filter(
    (r) => r.status !== 409 && r.status !== 201 && r.status !== 200,
  );

  const codes = new Map<string, number>();
  for (const r of results) {
    const code = String(r.body?.code ?? r.status);
    codes.set(code, (codes.get(code) ?? 0) + 1);
  }

  console.log('');
  console.log(`  Thoi gian xong 1 dot ${args.vus} request dong thoi : ${elapsedMs.toFixed(0)} ms`);
  const percentiles = [50, 95, 99].map((p) => `P${p}=${percentile(results.map((r) => r.latencyMs), p).toFixed(0)}ms`);
  const slowest = Math.max(...results.map((r) => r.latencyMs));
  console.log(`  Thoi gian phan ho tung request (NFR-01)        : ${percentiles.join(' ')} max=${slowest.toFixed(0)}ms`);
  console.log(`  Ket luan NFR-01 (P95 <= 2000ms @100 users)      : ${percentile(results.map((r) => r.latencyMs), 95) <= 2000 ? 'DAT' : 'KHONG DAT'}`);
  console.log(`  Lock thanh cong (HTTP 200/201)                 : ${winners.length}`);
  console.log(`  Bi tu choi 409 SLOT_NOT_AVAILABLE              : ${rejected.length}`);
  console.log(`  HTTP bat ngo                                   : ${unexpected.length}`);
  console.log(`  Phan bo ma                                     : ${[...codes].map(([k, v]) => `${k}=${v}`).join(', ')}`);

  const connection = await createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3307),
    user: process.env.DB_USERNAME ?? 'pickleball',
    password: process.env.DB_PASSWORD ?? 'pickleball123',
    database: process.env.DB_DATABASE ?? 'pickleball_booking',
  });
  const [rows] = await connection.query(
    'SELECT status, locked_by, booking_id FROM booking_slots WHERE slot_id = ?',
    [slotId],
  );
  const dbRow = (rows as Array<Record<string, unknown>>)[0] ?? {};
  console.log(`  Trang thai slot trong DB                       : ${JSON.stringify(dbRow)}`);

  // Bat buoc: chi mot nguoi nam giu duoc slot, va khong co 2 booking cung slot.
  const holders = Number(dbRow['locked_by'] ?? 0);
  const ok = winners.length === 1 && rejected.length === args.vus - 1 && unexpected.length === 0 && holders > 0;

  if (args.confirm && winners.length === 1) {
    const token = tokens[results.indexOf(winners[0])];
    const confirmed = await json(`${args.baseUrl}/api/bookings/confirm`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ slotIds: [slotId] }),
    });
    console.log(`  Xac nhan dat (HTTP ${confirmed.status})         : ${JSON.stringify(confirmed.body?.bookingCode ?? confirmed.body)}`);
    const [dup] = await connection.query(
      'SELECT COUNT(1) AS n FROM booking_slots WHERE court_id = ? AND start_time = (SELECT start_time FROM booking_slots WHERE slot_id = ?) AND status = "BOOKED"',
      [courtId, slotId],
    );
    console.log(`  So slot BOOKED trung khung gio tren san       : ${(dup as Array<{ n: string }>)[0]?.n}`);
  }

  await connection.end();

  console.log('');
  if (ok) {
    console.log(`  KET LUAN: PASS - ${args.vus} request dong thoi tren 1 slot, dung 1 thanh cong, 0 double-booking.`);
  } else {
    console.log('  KET LUAN: FAIL - xem chi tiet o tren.');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[probe] LOI:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

/** Phan vi theo nearest-rank (P95 la chi tieu NFR-01 trong tai lieu). */
function percentile(samples: number[], p: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, rank))];
}
