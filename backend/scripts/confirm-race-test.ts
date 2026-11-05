/**
 * Test xung dot o buoc CONFIRM (4.7.2) va buoc khoa nhieu slot (4.6.2).
 * Day la 2 kich ban con lai cua "khong the nao co 2 booking cung 1 slot".
 *
 *   npm run test:confirm-race
 */
import { createConnection } from 'mysql2/promise';

const BASE = process.env.PROBE_BASE_URL ?? 'http://localhost:3000';
const PASSWORD = 'ConfirmRace@123';

async function call(path: string, body?: unknown, token?: string): Promise<{ status: number; json: any }> {
  const response = await fetch(`${BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}

function db() {
  return createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3307),
    user: process.env.DB_USERNAME ?? 'pickleball',
    password: process.env.DB_PASSWORD ?? 'pickleball123',
    database: process.env.DB_DATABASE ?? 'pickleball_booking',
  });
}

async function makeUsers(count: number): Promise<string[]> {
  const stamp = Date.now().toString(36);
  const seed = Math.floor(Math.random() * 1e8);
  return Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const email = `cfm-${stamp}-${index}@test.local`;
      const phone = `0${'35789'[index % 5]}${String((seed + index * 7919) % 1e8).padStart(8, '0')}`;
      const created = await call('/api/auth/register', {
        fullName: `Confirm Race ${index}`,
        email,
        phoneNumber: phone,
        password: PASSWORD,
      });
      if (created.status >= 400) {
        throw new Error(`Khong tao duoc tai khoan ${index}: ${created.status} ${JSON.stringify(created.json)}`);
      }
      return created.json.tokens.accessToken as string;
    }),
  );
}

async function freeSlots(count: number): Promise<{ slotId: number; courtId: number }[]> {
  const date = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const found = await call(`/api/availability?date=${date}`);
  if (found.status !== 200 || !found.json?.courts?.length) {
    throw new Error(`availability HTTP ${found.status} - backend/DB dang chay khong?`);
  }
  const slots = found.json.courts.flatMap((court: any) =>
    court.slots.map((slot: any) => ({ slotId: slot.slotId, courtId: court.courtId })),
  );
  if (slots.length < count) {
    throw new Error(`Can ${count} slot ma chi tim duoc ${slots.length} trong ngay ${date}`);
  }
  return slots.slice(0, count);
}

let failures = 0;
function expect(name: string, pass: boolean, detail = ''): void {
  if (!pass) failures += 1;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  :: ${detail}` : ''}`);
}

async function resetSlots(slotIds: number[]): Promise<void> {
  const connection = await db();
  try {
    await connection.query(
      `UPDATE booking_slots
          SET status='AVAILABLE', locked_by=NULL, lock_expires_at=NULL, booking_id=NULL
        WHERE slot_id IN (?)`,
      [slotIds],
    );
  } finally {
    await connection.end();
  }
}

async function scenarioConfirmRace(): Promise<void> {
  console.log('\n[Kich ban 1] Nhieu user cung CONFIRM mot slot ma chi mot nguoi nam giu');
  const tokens = await makeUsers(20);
  const [{ slotId }] = await freeSlots(1);
  await resetSlots([slotId]);

  const holder = tokens[0];
  const outsider = tokens[1];

  const lock = await call('/api/bookings/lock', { slotIds: [slotId] }, holder);
  expect('Holder giu cho thanh cong', lock.status === 201, `HTTP ${lock.status}`);

  const leaked = await call('/api/bookings/confirm', { slotIds: [slotId] }, outsider);
  expect(
    'User KHONG giu cho bi tu choi khi confirm',
    leaked.status === 403 && leaked.json?.code === 'SLOT_NOT_LOCKED_BY_USER',
    `HTTP ${leaked.status} ${leaked.json?.code}`,
  );

  const attempts = await Promise.all([
    call('/api/bookings/confirm', { slotIds: [slotId] }, holder),
    ...tokens.slice(1).map((token) => call('/api/bookings/confirm', { slotIds: [slotId] }, token)),
  ]);
  const created = attempts.filter((r) => r.status === 201 || r.status === 200);
  const rejected = attempts.filter((r) => r.status === 403 || r.status === 409);
  expect(
    '20 request confirm dong thoi → dung 1 booking duoc tao',
    created.length === 1 && rejected.length === attempts.length - 1,
    `thanh cong=${created.length} tu choi=${rejected.length} khac=${attempts.length - created.length - rejected.length}`,
  );

  const connection = await db();
  try {
    const [rows] = await connection.query(
      'SELECT COUNT(1) AS so_booking, MAX(booking_id) AS booking_id FROM booking_slots WHERE slot_id = ?',
      [slotId],
    );
    const state = (rows as Array<Record<string, unknown>>)[0];
    expect(
      'Slot trong DB o BOOKED voi DUNG mot booking_id',
      Number(state.so_booking) === 1 && Number(state.booking_id) > 0,
      JSON.stringify(state),
    );
    const [dupes] = await connection.query(
      `SELECT COUNT(1) AS n FROM booking_slots
        WHERE status='BOOKED' AND court_id = (SELECT court_id FROM booking_slots WHERE slot_id = ?)
          AND start_time = (SELECT start_time FROM booking_slots WHERE slot_id = ?)`,
      [slotId, slotId],
    );
    const sameSlotBooked = Number((dupes as Array<{ n: string }>)[0].n);
    expect(
      'Khong co slot BOOKED nao khac trung cung (court, start_time)',
      sameSlotBooked === 1,
      `so dong BOOKED cung khung gio = ${sameSlotBooked}`,
    );
  } finally {
    await connection.end();
  }
}

async function scenarioMultiSlotRace(): Promise<void> {
  console.log('\n[Kich ban 2] 2 user khoa 2 tap slot CHONG NHAU theo thu tu nguoc nhau');
  const tokens = await makeUsers(2);
  const slots = await freeSlots(4);
  const setA = [slots[0].slotId, slots[1].slotId, slots[2].slotId];
  const setB = [slots[2].slotId, slots[1].slotId, slots[3].slotId];
  await resetSlots([...setA, ...setB]);

  const [first, second] = await Promise.all([
    call('/api/bookings/lock', { slotIds: setA }, tokens[0]),
    call('/api/bookings/lock', { slotIds: setB }, tokens[1]),
  ]);

  const outcomes = [first, second];
  const succeeded = outcomes.filter((r) => r.status === 201);
  const conflicted = outcomes.filter((r) => r.status === 409);
  expect(
    'Khong deadlock triet de: moi request tra ve 201 hoac 409, khong loi 500',
    succeeded.length + conflicted.length === 2,
    outcomes.map((r) => `${r.status}:${r.json?.code ?? ''}`).join(' | '),
  );

  if (conflicted.length === 1) {
    expect(
      'Xung dot duoc bao cao bang SLOT_NOT_AVAILABLE (khong phai loi he thong)',
      conflicted[0].json?.code === 'SLOT_NOT_AVAILABLE',
      JSON.stringify(conflicted[0].json?.details ?? {}),
    );
  }

  const connection = await db();
  try {
    const [rows] = await connection.query(
      'SELECT slot_id, locked_by FROM booking_slots WHERE slot_id IN (?) AND status="LOCKED"',
      [[...new Set([...setA, ...setB])]],
    );
    const held = rows as Array<{ slot_id: number; locked_by: number }>;
    const uniqueSlots = new Set(held.map((row) => Number(row.slot_id)));
    expect(
      'Khong co slot nao bi 2 nguoi giu dong thoi (khong trung slot_id)',
      uniqueSlots.size === held.length && held.every((row) => row.locked_by !== null),
      `so dong LOCKED=${held.length}, slot khac nhau=${uniqueSlots.size}`,
    );
    const overlap = setA.filter((id) => setB.includes(id)).map(Number);
    const overlapRows = held.filter((row) => overlap.includes(Number(row.slot_id)));
    const overlapOwners = new Set(overlapRows.map((row) => row.locked_by));
    expect(
      'Moi slot chong nhau chi thuoc ve MOT chu duoc (khong bi 2 user nam cung luc)',
      overlapOwners.size <= 1,
      `slot chong nhau=${overlap.join(',')} -> ${overlapRows.map((r) => `owner#${r.locked_by}`).join(',') || 'khong ai giu'}`,
    );
    expect(
      'Don thua cuoc rollback TOAN BO: khong giu lai bat ky slot nao',
      held.length === 3,
      `tong slot dang bi giu=${held.length} (= dung 3 slot cua mot don thang cuoc)`,
    );
  } finally {
    await connection.end();
  }
}

async function main(): Promise<void> {
  await scenarioConfirmRace();
  await scenarioMultiSlotRace();
  console.log('');
  console.log(failures === 0 ? 'KET LUAN: PASS toan bo kich ban xung dot confirm + multi-slot.' : `KET LUAN: FAIL (${failures} buoc).`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error('[test] LOI:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
