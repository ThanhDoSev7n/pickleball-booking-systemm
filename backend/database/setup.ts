import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';

/** MySQL 1061 - ER_DUP_KEYNAME: schema.sql dung CREATE INDEX khong IF NOT EXISTS. */
const ER_DUP_KEYNAME = 1061;
const DEFAULT_DB_PORT = 3306;

interface DbConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

/** Ten DB/USER bi chen thang vao DDL (khong tham so hoa duoc) nen phai chang loc chat. */
const SQL_IDENTIFIER = /^[A-Za-z0-9_]{1,64}$/;

function assertIdentifier(value: string, label: string): string {
  if (!SQL_IDENTIFIER.test(value)) {
    throw new Error(`${label} = "${value}" khong hop le (chi chu cai, so, dau goc duoi)`);
  }
  return value;
}

interface SqlException extends Error {
  code?: string;
  errno?: number;
}

/** Doc .env truc tiep: script chay ngoai Nest nen khong can ConfigModule. */
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

function readConfig(): DbConfig & { rootUsername: string; rootPassword: string } {
  const env = { ...readEnv(resolve(__dirname, '..', '.env')), ...process.env };
  const config = {
    host: env.DB_HOST ?? '127.0.0.1',
    port: Number(env.DB_PORT ?? DEFAULT_DB_PORT),
    username: assertIdentifier(env.DB_USERNAME ?? 'pickleball', 'DB_USERNAME'),
    password: env.DB_PASSWORD ?? '',
    database: assertIdentifier(env.DB_DATABASE ?? 'pickleball_booking', 'DB_DATABASE'),
    rootUsername: env.DB_ROOT_USERNAME ? assertIdentifier(env.DB_ROOT_USERNAME, 'DB_ROOT_USERNAME') : '',
    rootPassword: env.DB_ROOT_PASSWORD ?? '',
  };
  return config;
}

function buildDataSource(config: DbConfig, database: string | null = config.database): DataSource {
  const target: DbConfig = { ...config, database: database ?? '' };
  return new DataSource({ ...target, type: 'mysql', synchronize: false, logging: false });
}

/**
 * Database + tai khoan app co the chua ton tai khi thanh vien khach chay lenh nay
 * tren may cua ho, nen bootstrap dung quyen root (neu duoc cap) de tao.
 */
async function bootstrapSchema(config: ReturnType<typeof readConfig>): Promise<void> {
  const adminCreds =
    config.rootUsername !== ''
      ? { username: config.rootUsername, password: config.rootPassword }
      : { username: config.username, password: config.password };

  const server = new DataSource({
    type: 'mysql',
    host: config.host,
    port: config.port,
    username: adminCreds.username,
    password: adminCreds.password,
    synchronize: false,
    logging: false,
  });
  await server.initialize();
  try {
    await server.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    if (adminCreds.username !== config.username) {
      await server.query(
        `CREATE USER IF NOT EXISTS '${config.username}'@'%' IDENTIFIED BY '${config.password}'`,
      );
      await server.query(
        `GRANT ALL PRIVILEGES ON \`${config.database}\`.* TO '${config.username}'@'%'`,
      );
      await server.query('FLUSH PRIVILEGES');
    }
    console.log(`  Da dam bao database "${config.database}" + quyen cho "${config.username}"`);
  } finally {
    await server.destroy();
  }
}

function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let buffer: string[] = [];
  for (const rawLine of sql.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('--')) {
      continue;
    }
    if (line.endsWith(';')) {
      buffer.push(line.slice(0, -1));
      statements.push(buffer.join('\n'));
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  if (buffer.length > 0) {
    statements.push(buffer.join('\n'));
  }
  return statements;
}

async function main(): Promise<void> {
  const config = readConfig();
  try {
    await bootstrapSchema(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `  [canh bao] Khong tu tao duoc database/user (${message}).
` +
        '  Hay tao tay hoac them DB_ROOT_USERNAME/DB_ROOT_PASSWORD vao backend/.env.',
    );
  }
  const dataSource = buildDataSource(config, config.database);
  await dataSource.initialize();
  const sql = readFileSync(resolve(__dirname, 'schema.sql'), 'utf8');

  for (const statement of splitStatements(sql)) {
    try {
      await dataSource.query(statement);
    } catch (error) {
      const exception = error as SqlException;
      // Idempotent: chay lenh setup lan 2 thi index da ton tai, bo qua.
      if (exception.errno === ER_DUP_KEYNAME || exception.code === 'ER_DUP_KEYNAME') {
        continue;
      }
      throw error;
    }
  }

  // Migration additive cho CSDL da co POS invoices truoc khi cot tien san duoc them.
  const courtAmountColumn = (await dataSource.query(
    `SELECT COUNT(*) AS column_count
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pos_invoices' AND COLUMN_NAME = 'court_amount'`,
    [config.database],
  )) as { column_count: number }[];
  if (Number(courtAmountColumn[0]?.column_count ?? 0) === 0) {
    await dataSource.query(
      'ALTER TABLE pos_invoices ADD COLUMN court_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER cluster_id',
    );
  }

  const rows = (await dataSource.query('SHOW TABLES')) as Record<string, string>[];
  const tables = rows.map((row) => Object.values(row)[0]);
  console.log(`[db:setup] DB ${dataSource.options.database} da san sang.`);
  console.log(`[db:setup] Bang hien co (${tables.length}): ${tables.join(', ')}`);
  await dataSource.destroy();
}

main().catch((error: unknown) => {
  console.error('[db:setup] THAT BAI:', error);
  process.exitCode = 1;
});
