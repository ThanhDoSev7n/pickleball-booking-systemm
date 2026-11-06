# Hệ thống hỗ trợ đặt sân Pickleball

Đồ án môn **Nhập môn Công nghệ phần mềm** — Trường Đại học Mở Hà Nội.
Đề tài: *Ứng dụng hỗ trợ đặt sân Pickleball*.

Bài toán trọng tâm là **chống trùng lịch (double-booking)** khi nhiều người cùng đặt một khung giờ.
Hệ thống giải quyết bằng **pessimistic locking** trên MySQL InnoDB
(`SELECT … FOR UPDATE` trong transaction ngắn) kết hợp ràng buộc
`UNIQUE (court_id, start_time)` như lớp phòng thủ cuối cùng — xem ADR-001, mục 4.6–4.7 của tài liệu thiết kế.

## Kiến trúc

Modular Monolith + Clean Architecture, mỗi bounded context một module:

```
backend/src/
  domain/           entity thuần TypeScript, value object, port (interface), SlotLockManager
  application/      use case, không biết gì về HTTP hay TypeORM
  infrastructure/   adapter: TypeORM repository, JWT, bcrypt, cron
  presentation/     controller, DTO, guard, exception filter
frontend/
  app/              Next.js App Router (route tiếng Việt: /san, /dat-chong, /lich-dat)
  src/lib/          axios client, auth context, booking cart context, use-polling
```

| Thành phần | Công nghệ |
| --- | --- |
| Backend | NestJS 11 + TypeScript |
| Database | MySQL 8.4 InnoDB, REPEATABLE READ |
| ORM | TypeORM (synchronize = false, schema viết tay) |
| Auth | JWT + RBAC 4 role |
| Web | Next.js (App Router) + Tailwind CSS |

## Chạy dự án

Yêu cầu: Node 20+, Docker Desktop.

```bash
# 1. Hang tang CSDL (cong 3307 de tranh MySQL local cua ban)
docker compose up -d

# 2. Backend
cd backend
npm install
cp .env.example .env      # sua DB_ROOT_PASSWORD = mat khau root MySQL cua ban
npm run db:setup          # tao database + apply database/schema.sql
npm run db:seed           # tao tai khoan demo, san, va slot cho 14 ngay
npm run start:dev         # http://localhost:3000

# 3. Frontend (terminal khac)
cd frontend
npm install
npm run dev               # http://localhost:3001
```

`npm run db:setup` tu dong tao database va tai khoan `pickleball` neu chua ton tai,
nen thanh vien moi clone ve co the chay ngay.

## Tai khoan demo

Mat khau chung: `Matkhau@123`

| Role | Email |
| --- | --- |
| ADMIN | `admin@pickleball.vn` |
| OWNER | `owner.hadong@pickleball.vn` (cum da duyet), `owner.quan7@pickleball.vn` (cum cho duyet) |
| STAFF | `staff1.hadong@pickleball.vn` |
| CUSTOMER | `customer1@pickleball.vn` … `customer6@pickleball.vn` |

## Co che giu cho (slot locking)

1. `POST /api/bookings/lock` mo transaction, `SELECT … FOR UPDATE` trên từng slot
   (**sap xep slotId tang dan** de deadlock circular khong the xay ra).
2. Slot chuyen `AVAILABLE → LOCKED`, ghi `locked_by` và `lock_expires_at = NOW() + 5 phut`.
3. Transaction cam ket trong vong chuc ms — thoi gian **giu cho 5 phut** nam o cot
   `lock_expires_at`, khong phai giu DB lock 5 phut (se gay contention nang).
4. Xac nhan dat: `POST /api/bookings/confirm` kiem tra van con la nguoi giu cho
   chua het han roi mới chuyen `LOCKED → BOOKED` va sinh ma QR check-in.
5. Cron chay moi 30 giay giai phong giu cho qua han; dong thoi moi luu tra den
   slot het han duoc tu choi nhu trong (lazy release).

Cau hinh qua `.env`: `LOCK_TTL_MINUTES`, `LOCK_RELEASE_INTERVAL_SECONDS`, `DEADLOCK_MAX_RETRIES`.

## Kiem thu

```bash
cd backend
npm test                                # 15 unit test cho SlotLockManager + state machine slot
npm run load:concurrency -- --vus 100   # N request dong thoi tren CUNG 1 slot (keu P50/P95/P99)
npm run test:concurrency                # xung dot o buoc confirm + khoa nhieu slot chong nhau

cd ../frontend
npm run test:e2e                        # 12 buoc E2E tren Chrome that + backend that
```

Ket qua do duoc tren may phat trien (MySQL 8.4 Docker, 1 instance NestJS):

| Thi nghiem | Ket qua |
| --- | --- |
| 100 request dong thoi tren 1 slot | 1 thanh cong, 99 tu choi 409, 0 loi khac · P50 330 ms, **P95 413 ms** |
| 200 request dong thoi tren 1 slot | 1 thanh cong, 199 tu choi 409, 0 loi khac · P50 596 ms, **P95 795 ms** |
| 20 user cung `confirm` 1 slot | 1 booking duoc tao, 19 bi tu choi 403/409 |
| 2 user khoa 2 tap slot chong nhau | 1 don 201, 1 don 409; don thua rollback **toan bo** (khong giu lai slot le) |

NFR-02 (0 double-booking) va NFR-01 (P95 ≤ 2 s @100 users) deu dat.
`npm run test:concurrency` tu tao tai khoan doc lap nen chay lai duoc nhieu lan.

## CAI DAT

| Run lenh | Tac dung |
| --- | --- |
| `npm run db:setup` | Tao/thu hoat database + bang theo `database/schema.sql` |
| `npm run db:seed` | Nap du lieu demo (idempotent, chay 2 lan khong nhan doi) |
| `npm test` | Unit test domain layer |
| `npm run load:concurrency` | Probe xung dot thực |

```bash
docker compose down          # giu du lieu
docker compose down -v       # XA toan bo du lieu, chay lai db:setup + db:seed
```

Cổng: frontend `3001`, backend `3000`, MySQL `3307`.

## Quy ước

Tuân thủ mục 2.2 của tài liệu: file kebab-case, class PascalCase,
hằng số `UPPER_SNAKE_CASE`; bảng/cột `snake_case`; ràng buộc `fk_` / `uk_` / `idx_`;
commit theo Conventional Commits; nhánh theo GitFlow (`main`, `develop`, `feature/*`).

## Tái phạm vi triển khai

Các module đang có gồm Identity/RBAC, Booking/Slot Locking, Pricing, Matchmaking, POS/Lễ tân,
Reporting cho chủ sân và Admin, duyệt cụm sân/quản lý tài khoản, cùng dashboard vận hành.
`total_amount` có thể còn `NULL` trước khi thanh toán; báo cáo sẽ ước tính từ bảng giá đã cấu hình.

## Admin, Reporting và DevOps

- Admin UI: `/admin` — duyệt/từ chối cụm sân, quản lý vai trò và trạng thái tài khoản, xem doanh thu và tỷ lệ lấp đầy toàn hệ thống.
- Owner UI: `/chu-san` — báo cáo theo chủ sân. API: `GET /api/owner/stats?range=today|7days|month`.
- Admin API: `/api/admin/clusters`, `/api/admin/users`, `GET /api/admin/stats?range=today|7days|month`; mọi endpoint yêu cầu JWT và role ADMIN.
- IEEE 829-style test design và tiêu chí nghiệm thu: [`docs/qa/IEEE-829-test-cases.md`](docs/qa/IEEE-829-test-cases.md).
- GitHub Actions ở `.github/workflows/ci-cd.yml` chạy lint, unit test, build; push lên GitHub Packages Container Registry khi verify thành công.
- Để bật deploy qua SSH trên push nhánh mặc định, đặt GitHub variable `DEPLOY_ENABLED=true`, `DEPLOY_PATH`, `NEXT_PUBLIC_API_URL` và secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`. Tạo `.env` trên host với `GHCR_NAMESPACE`, `GHCR_REPO`, `MYSQL_ROOT_PASSWORD`, `DB_PASSWORD`, `JWT_SECRET`, `FRONTEND_ORIGIN`; deploy Compose dùng MySQL volume bền vững, backend và frontend image theo SHA.
- Docker build: `docker build -t pickleball-backend ./backend` và `docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api -t pickleball-frontend ./frontend`.
- Race test với DB thật: `cd backend; npm run load:concurrency -- --vus 100 --slot auto --confirm`. k6 scenario: `k6 run tests/load/booking-lock.js` với `BASE_URL`, `SLOT_ID`, `VUS` và `PROBE_USERS=email:password,...`.

Dashboard Admin và chủ sân tự làm mới mỗi 30 giây. Occupancy được tính từ tổng giờ booking ở trạng thái CONFIRMED/PAID/CHECKED_IN/COMPLETED chia cho giờ mở cửa của các sân đang hoạt động thuộc cụm đã duyệt trong phạm vi báo cáo. Doanh thu lấy tổng đã lưu, hoặc ước tính theo bảng giá khi booking chưa có `total_amount`.


Cập nhật database MySql Docker . cd backend . npm run db:setup
