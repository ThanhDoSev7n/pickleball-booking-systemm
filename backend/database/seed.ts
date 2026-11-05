import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { normalizePhone } from '../src/domain/model/user.entity';
import { toDateString } from '../src/domain/model/booking-slot.entity';
import { ClusterStatus, CourtType } from '../src/domain/value-object/court-type.vo';
import { UserRole } from '../src/domain/value-object/user-role.vo';
import { buildSlotWindows } from '../src/infrastructure/persistence/typeorm/repositories/slot.repository';

const DEMO_PASSWORD = 'Matkhau@123';
const DEFAULT_DB_PORT = 3306;
const DEFAULT_SALT_ROUNDS = 10;
const SEED_DAYS = 14;
const SLOT_BATCH_SIZE = 200;
const OPENING_TIME = '06:00';
const CLOSING_TIME = '22:00';
const SLOT_DURATION_MINUTES = 60;

interface SeedUser {
  email: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
}

interface SeedCluster {
  name: string;
  address: string;
  city: string;
  ownerEmail: string;
  status: ClusterStatus;
}

interface SeedCourt {
  clusterName: string;
  name: string;
  courtType: CourtType;
  surface: string;
}

const USERS: SeedUser[] = [
  { email: 'admin@pickleball.vn', fullName: 'Quan Tri Vien', phoneNumber: '0900000001', role: UserRole.ADMIN },
  { email: 'owner.hadong@pickleball.vn', fullName: 'Chu San Ha Dong', phoneNumber: '0900000002', role: UserRole.OWNER },
  { email: 'owner.quan7@pickleball.vn', fullName: 'Chu San Quan 7', phoneNumber: '0900000003', role: UserRole.OWNER },
  { email: 'staff1.hadong@pickleball.vn', fullName: 'Nhan Vien Ha Dong 1', phoneNumber: '0900000004', role: UserRole.STAFF },
  { email: 'staff2.hadong@pickleball.vn', fullName: 'Nhan Vien Ha Dong 2', phoneNumber: '0900000005', role: UserRole.STAFF },
  { email: 'customer1@pickleball.vn', fullName: 'Nguyen Van An', phoneNumber: '0912345678', role: UserRole.CUSTOMER },
  { email: 'customer2@pickleball.vn', fullName: 'Tran Thi Binh', phoneNumber: '0987654321', role: UserRole.CUSTOMER },
  { email: 'customer3@pickleball.vn', fullName: 'Le Van Cuong', phoneNumber: '0933333333', role: UserRole.CUSTOMER },
];

const CLUSTERS: SeedCluster[] = [
  {
    name: 'Pickleball Ha Dong',
    address: '83 Nguyen Truong To, Ha Dong',
    city: 'Ha Noi',
    ownerEmail: 'owner.hadong@pickleball.vn',
    status: ClusterStatus.APPROVED,
  },
  {
    name: 'Pickleball Quan 7',
    address: '12 Nguyen Thi Thap, Quan 7',
    city: 'Ho Chi Minh',
    ownerEmail: 'owner.quan7@pickleball.vn',
    status: ClusterStatus.PENDING,
  },
];

const COURTS: SeedCourt[] = [
  { clusterName: 'Pickleball Ha Dong', name: 'San Ha Dong 1', courtType: CourtType.OUTDOOR, surface: 'Acrylic' },
  { clusterName: 'Pickleball Ha Dong', name: 'San Ha Dong 2', courtType: CourtType.INDOOR, surface: 'Gach' },
  { clusterName: 'Pickleball Ha Dong', name: 'San Ha Dong 3', courtType: CourtType.COMPETITION, surface: 'PVC' },
  { clusterName: 'Pickleball Quan 7', name: 'San Quan 7 A', courtType: CourtType.INDOOR, surface: 'PVC' },
  { clusterName: 'Pickleball Quan 7', name: 'San Quan 7 B', courtType: CourtType.OUTDOOR, surface: 'Acrylic' },
  { clusterName: 'Pickleball Quan 7', name: 'San Quan 7 C', courtType: CourtType.OUTDOOR, surface: 'Acrylic' },
];

function readEnv(file: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator < 0) {
      continue;
    }
    env[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }
  return env;
}

function buildDataSource(env: Record<string, string | undefined>): DataSource {
  return new DataSource({
    type: 'mysql',
    host: env.DB_HOST ?? '127.0.0.1',
    port: Number(env.DB_PORT ?? DEFAULT_DB_PORT),
    username: env.DB_USERNAME ?? 'pickleball',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_DATABASE ?? 'pickleball_booking',
    synchronize: false,
    logging: false,
  });
}

async function seedUsers(dataSource: DataSource, passwordHash: string): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const seed of USERS) {
    // Ung dung luu SDT dang normalizePhone (bo so 0 dau), nen seed cung dung dang nay
    // de existsByPhone chan duoc trung SDT voi tai khoan da co.
    const phone = normalizePhone(seed.phoneNumber);
    const existing = (await dataSource.query(
      'SELECT user_id, phone_number FROM users WHERE email = ? LIMIT 1',
      [seed.email],
    )) as { user_id: number; phone_number: string }[];
    if (existing.length > 0) {
      if (existing[0].phone_number !== phone) {
        await dataSource.query('UPDATE users SET phone_number = ? WHERE user_id = ?', [
          phone,
          existing[0].user_id,
        ]);
      }
      ids.set(seed.email, existing[0].user_id);
      console.log(`  [users] ton tai: ${seed.email} (id ${existing[0].user_id})`);
      continue;
    }
    const result = (await dataSource.query(
      'INSERT INTO users (full_name, email, phone_number, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [seed.fullName, seed.email, phone, passwordHash, seed.role],
    )) as { insertId: number };
    ids.set(seed.email, result.insertId);
    console.log(`  [users] them moi: ${seed.role} ${seed.email} (id ${result.insertId})`);
  }
  return ids;
}

async function seedClusters(
  dataSource: DataSource,
  userIds: Map<string, number>,
): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const seed of CLUSTERS) {
    const existing = (await dataSource.query(
      'SELECT cluster_id FROM court_clusters WHERE name = ? LIMIT 1',
      [seed.name],
    )) as { cluster_id: number }[];
    if (existing.length > 0) {
      ids.set(seed.name, existing[0].cluster_id);
      console.log(`  [clusters] ton tai: ${seed.name} (id ${existing[0].cluster_id})`);
      continue;
    }
    const result = (await dataSource.query(
      'INSERT INTO court_clusters (name, address, city, description, owner_id, status, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [seed.name, seed.address, seed.city, `Cum san demo ${seed.city}`, userIds.get(seed.ownerEmail) ?? 0, seed.status],
    )) as { insertId: number };
    ids.set(seed.name, result.insertId);
    console.log(`  [clusters] them moi: ${seed.name} [${seed.status}] (id ${result.insertId})`);
  }
  return ids;
}

async function seedCourts(
  dataSource: DataSource,
  clusterIds: Map<string, number>,
): Promise<{ courtId: number; name: string }[]> {
  const courts: { courtId: number; name: string }[] = [];
  for (const seed of COURTS) {
    const clusterId = clusterIds.get(seed.clusterName) ?? 0;
    const existing = (await dataSource.query(
      'SELECT court_id FROM courts WHERE cluster_id = ? AND name = ? LIMIT 1',
      [clusterId, seed.name],
    )) as { court_id: number }[];
    if (existing.length > 0) {
      courts.push({ courtId: existing[0].court_id, name: seed.name });
      console.log(`  [courts] ton tai: ${seed.name} (id ${existing[0].court_id})`);
      continue;
    }
    const result = (await dataSource.query(
      `INSERT INTO courts (cluster_id, name, court_type, surface, opening_time, closing_time, slot_duration_minutes, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [clusterId, seed.name, seed.courtType, seed.surface, OPENING_TIME, CLOSING_TIME, SLOT_DURATION_MINUTES],
    )) as { insertId: number };
    courts.push({ courtId: result.insertId, name: seed.name });
    console.log(`  [courts] them moi: ${seed.name} [${seed.courtType}] (id ${result.insertId})`);
  }
  return courts;
}

/** Slot duoc sinh bang buildSlotWindows cua repository de trung het logic trong ung dung. */
async function seedSlots(dataSource: DataSource, courtIds: number[]): Promise<number> {
  const rows: (string | number)[][] = [];
  const today = new Date();
  for (let offset = 0; offset < SEED_DAYS; offset += 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const date = toDateString(day);
    for (const courtId of courtIds) {
      for (const [startIso, endIso] of buildSlotWindows(
        date,
        OPENING_TIME,
        CLOSING_TIME,
        SLOT_DURATION_MINUTES,
      )) {
        rows.push([courtId, date, startIso, endIso]);
      }
    }
  }

  let inserted = 0;
  for (let index = 0; index < rows.length; index += SLOT_BATCH_SIZE) {
    const chunk = rows.slice(index, index + SLOT_BATCH_SIZE);
    const placeholders = chunk.map(() => '(?, ?, ?, ?)').join(', ');
    const result = (await dataSource.query(
      `INSERT IGNORE INTO booking_slots (court_id, slot_date, start_time, end_time)
       VALUES ${placeholders}`,
      chunk.flat(),
    )) as { affectedRows: number };
    inserted += result.affectedRows;
  }
  return inserted;
}

async function main(): Promise<void> {
  const env = { ...readEnv(resolve(__dirname, '..', '.env')), ...process.env };
  const dataSource = buildDataSource(env);
  await dataSource.initialize();

  const saltRounds = Number(env.BCRYPT_SALT_ROUNDS ?? DEFAULT_SALT_ROUNDS);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, saltRounds);

  console.log('[db:seed] Tai khoan demo');
  const userIds = await seedUsers(dataSource, passwordHash);
  console.log('[db:seed] Cum san demo');
  const clusterIds = await seedClusters(dataSource, userIds);
  console.log('[db:seed] San demo');
  const courts = await seedCourts(dataSource, clusterIds);
  console.log('[db:seed] Sinh booking_slots cho 14 ngay tiep theo');
  const insertedSlots = await seedSlots(dataSource, courts.map((court) => court.courtId));

  const totalSlots = (await dataSource.query('SELECT COUNT(1) AS total FROM booking_slots')) as {
    total: string;
  }[];
  console.log(`[db:seed] Slot: them moi ${insertedSlots}, tong trong DB ${totalSlots[0].total}`);
  console.log(`[db:seed] Mat khau demo giong nhau cho 8 tai khoan: ${DEMO_PASSWORD}`);
  console.log('[db:seed] Lien ket san -> cum san demo (email dang nhap):');
  for (const cluster of CLUSTERS) {
    const names = COURTS.filter((court) => court.clusterName === cluster.name).map((court) => court.name);
    console.log(`  - ${cluster.name} [${cluster.status}]: ${names.join(', ')} (chu: ${cluster.ownerEmail})`);
  }

  await dataSource.destroy();
}

main().catch((error: unknown) => {
  console.error('[db:seed] THAT BAI:', error);
  process.exitCode = 1;
});
