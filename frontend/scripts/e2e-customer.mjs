/**
 * E2E cho luong Customer (FR-01 -> FR-04) chang qua backend THAT + Chrome that.
 * Chay: node scripts/e2e-customer.mjs   (can backend :3000 + frontend :3001 + MySQL :3307)
 *
 * Khac hon cac harness truoc: ghi lai body cua POST /bookings/lock de chung minh
 * slot ma UI gui dung la slot bi nguoi khac gianh, khong phong doan.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001';
const API = process.env.E2E_API ?? 'http://localhost:3000/api';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PASSWORD = 'Matkhau@123';

const hourLabel = process.argv[2] ?? '15:00';
const dateFor = (offsetDays) => toDate(new Date(Date.now() + offsetDays * 86_400_000));
function toDate(value) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
const label = (iso) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(iso));

const api = (path, options = {}) =>
  fetch(API + path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const loginApi = async (email) =>
  (await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: PASSWORD }) }))
    .body?.tokens?.accessToken;

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  :: ' + detail : ''}`);
};

const emailA = 'e2e.customerA@example.com';
const emailB = 'e2e.customerB@example.com';
const ensureAccount = async (email, fullName) => {
  const created = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, phoneNumber: '09' + Math.floor(Math.random() * 1e8), password: PASSWORD }),
  });
  if (created.status < 400) return created.body.tokens.accessToken;
  const existing = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (existing.status >= 400) throw new Error(`Khong dung duoc tai khoan ${email}: ${existing.status}`);
  return existing.body.tokens.accessToken;
};

const tokenB = await ensureAccount(emailB, 'E2E Customer B');
const targetDate = dateFor(4);

// Chon 1 slot AVAILABLE va bao dam no dang trong (xoa giu cho cu).
const availability = await api(`/availability?date=${targetDate}`);
const courts = availability.body?.courts ?? [];
if (courts.length === 0) throw new Error(`Backend khong tra san nao cho ${targetDate} - server/DB chay chua?`);
const court = courts[0];
const tileFor = (hhmm) => court.slots.find((s) => label(s.startTime) === hhmm);
const raceSlot = tileFor(hourLabel);
if (!raceSlot) throw new Error(`San ${court.courtId} khong co slot ${hourLabel} trong ngay ${targetDate}`);

for (const token of [tokenB].filter(Boolean)) {
  await api(`/bookings/lock/${raceSlot.slotId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  locale: 'vi-VN',
  timezoneId: 'Asia/Ho_Chi_Minh',
});
const page = await context.newPage();
const lockRequests = [];
page.on('request', async (request) => {
  if (request.url().includes('/api/bookings/lock') && request.method() === 'POST') {
    lockRequests.push({ body: request.postData(), at: Date.now() });
  }
});

// 1. FR-01: dang nhap that qua form, luu token cho luot sau.
const tokenA = await ensureAccount(emailA, 'E2E Customer A');
await page.goto(`${BASE}/dang-nhap`, { waitUntil: 'networkidle' });
await page.fill('#email', emailA);
await page.fill('#password', PASSWORD);
await page.click('button[type=submit]');
await page.waitForSelector('text=Tra cứu sân trống', { timeout: 25000 });
check('FR-16 Dang nhap qua form → ve trang tra cuu', true);

// 2. Dat ngay + khung gio, dung dung cai UI dang hien thi.
await page.locator('input[type="date"]').fill(targetDate);
await page.waitForTimeout(2600);
const tile = page
  .locator('section')
  .filter({ hasText: court.courtName })
  .locator('button')
  .filter({ hasText: new RegExp(`^${hourLabel}\\s–`) })
  .first();
await tile.waitFor({ state: 'visible', timeout: 20000 });
check(
  `FR-01 Luoi slot cua "${court.courtName}" (${targetDate}) co khung ${hourLabel}`,
  (await tile.innerText()).includes(hourLabel),
  (await tile.innerText()).replace(/\s+/g, ' '),
);

// 3. Xung dot: user B gian slot qua API that, user A van giu thao da chon.
await tile.click();
await page.waitForTimeout(700);
const stolen = await api('/bookings/lock', {
  method: 'POST',
  headers: { authorization: `Bearer ${tokenB}` },
  body: JSON.stringify({ slotIds: [raceSlot.slotId] }),
});
check('FR-02 user B giu cho thanh cong tren slot trong', stolen.status === 201, `HTTP ${stolen.status}`);

lockRequests.length = 0;
await page.getByRole('button', { name: 'Giữ chỗ 5 phút' }).first().click();
await page.waitForTimeout(3500);

const sentSlotId = lockRequests.length > 0 ? JSON.parse(lockRequests[0].body).slotIds[0] : null;
check(
  'UI gui dung slotId bi gianh (khong phai slot cua ngay khac)',
  sentSlotId === raceSlot.slotId,
  `UI gui ${sentSlotId}, slot bi gianh ${raceSlot.slotId}`,
);

const notice = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
check(
  'NFR-02/FR-02 user A bi tu choi 409 + canh bao tieng Viet, khong crash',
  /Không giữ chỗ được/.test(notice) && /vừa bị người khác đặt/.test(notice),
  notice.match(/Không giữ chỗ được[^×]{0,90}/)?.[0]?.trim() ?? '(khong thay canh bao)',
);

// 4. Slot phai chuyen sang "Dang co nguoi giu" va khong con chon duoc.
await page.waitForTimeout(2500);
const heldTile = page
  .locator('section')
  .filter({ hasText: court.courtName })
  .locator('button')
  .filter({ hasText: new RegExp(`^${hourLabel}\\s–`) })
  .first();
const heldText = (await heldTile.innerText()).replace(/\s+/g, ' ');
check(
  'FR-01/02 slot bi gianh hien "Dang co nguoi giu (mm:ss)" va bi khoa click',
  /Đang có người giữ/.test(heldText) && !(await heldTile.isEnabled()),
  heldText,
);

// 5. Golden path: chon 2 khung lien ke cua MỘT san, giu cho roi xac nhan.
// DONG CHI chay nhieu lan: lay 2 slot dang CON TRONG (sau don truoc cua chinh test van con slot khac)
const pickSlots = court.slots
  .filter((s) => s.slotId !== raceSlot.slotId)
  .filter((s) => new Date(s.startTime).getTime() > Date.now() + 3_600_000)
  .slice(0, 2);
if (pickSlots.length < 2) throw new Error('San khong con du 2 slot trong de test golden path');
const pickLabels = pickSlots.map((slot) => label(slot.startTime));
for (const slot of pickSlots) {
  for (const token of [await ensureAccount(emailA, 'E2E Customer A'), tokenB]) {
    await api(`/bookings/lock/${slot.slotId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
  }
}
for (const hhmm of pickLabels) {
  await page
    .locator('section')
    .filter({ hasText: court.courtName })
    .locator('button')
    .filter({ hasText: new RegExp(`^${hhmm}\\s–`) })
    .first()
    .click();
  await page.waitForTimeout(400);
}
await page.getByRole('button', { name: 'Giữ chỗ 5 phút' }).first().click();
await page.waitForURL('**/dat-chong', { timeout: 20000 });
const summary = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
// String THAT cua UI: "Khung giu cho dang giu cho (N)" + "N khung giu cho giu cho"
check(
  'FR-02 giu cho 2 slot lien ke → sang man xac nhan, co dem nguoc 5 phut',
  /khung giờ giữ chỗ/i.test(summary) && /\d:\d\d/.test(summary),
  summary.match(/Khung giờ đang giữ chỗ \([^)]*\)[^]{0,60}/)?.[0]?.replace(/\s+/g, ' ') ?? summary.slice(0, 90),
);

// App dung hop thoaxac nhan (role=dialog) - phai bam qua 2 buoc nhu nguoi that.
await page.getByRole('button', { name: 'Xác nhận đặt sân' }).first().click();
await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 15000 });
await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận đặt', exact: true }).click();
await page.waitForTimeout(9000);
const booked = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const bookingCode = booked.match(/PKL-\d{8}-[A-Z0-9]{6}/)?.[0] ?? null;
check('FR-03 xac nhan dat → co ma dat san', bookingCode !== null, bookingCode ?? '(khong thay ma)');
check('FR-03 hien ma QR check-in', (await page.locator('canvas, img').count()) > 0 || /QR/.test(booked));

// 6. FR-04: kiem tra ben trong DB + xem lich su + huy.
const after = await api(`/availability?date=${targetDate}`);
const courtAfter = (after.body?.courts ?? []).find((c) => c.courtId === court.courtId);
const bookedIds = pickSlots.map((slot) => slot.slotId);
const stillFree = (courtAfter?.slots ?? []).filter((s) => bookedIds.includes(s.slotId));
check(
  'NFR-02 2 slot da dat KHONG CON xuat la trong danh sach slot trong',
  stillFree.length === 0,
  stillFree.map((s) => s.slotId).join(',') || 'ok',
);

await page.goto(`${BASE}/lich-dat`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const history = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
check('FR-04 lich su dat hien don vua tao', bookingCode !== null && history.includes(bookingCode), bookingCode ?? '');

const cancelButton = page.getByRole('button', { name: 'Hủy đặt sân' }).first();
if (await cancelButton.count()) {
  await cancelButton.click();
  await page.waitForTimeout(1200);
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    await dialog.getByRole('button', { name: /Hủy lịch đặt|Đang hủy/ }).first().click();
  }
  await page.waitForTimeout(4000);
  const refilled = await api(`/availability?date=${targetDate}`);
  const courtRefilled = (refilled.body?.courts ?? []).find((c) => c.courtId === court.courtId);
  const back = (courtRefilled?.slots ?? []).filter((s) => bookedIds.includes(s.slotId));
  check('FR-04 huy lich → slot tro lai AVAILABLE', back.length === bookedIds.length, `tro lai ${back.length}/${bookedIds.length}`);
} else {
  check('FR-04 huy lich → slot tro lai AVAILABLE', false, '(khong tim thay nut Huy trong lich su)');
}

await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log('');
console.log(failed === 0 ? `E2E PASS: ${results.length}/${results.length} buoc.` : `E2E FAIL: ${failed}/${results.length} buoc loi.`);
process.exitCode = failed === 0 ? 0 : 1;
