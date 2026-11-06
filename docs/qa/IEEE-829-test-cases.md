# Test Design Specification — Admin, Reporting and Concurrent Booking

**Standard:** IEEE 829 style test design specification  
**System:** Pickleball Booking System  
**Version:** 1.0 · **Date:** 2026-11-06

## 1. Test items

- Admin account and RBAC endpoints under `/api/admin/users`.
- Admin court-cluster review endpoints under `/api/admin/clusters`.
- Owner and system-wide reports under `/api/owner/stats` and `/api/admin/stats`.
- Booking slot lock/confirm flow and MySQL InnoDB uniqueness/locking controls.
- CI build, lint, unit tests, and Docker image build/publish workflow.

## 2. Features to be tested

1. Only ADMIN can list/manage accounts, change roles, and approve/reject clusters.
2. Account deactivation clears refresh-token state; inactive credentials cannot continue authenticated sessions.
3. Report totals include revenue-producing booking states, exclude cancelled/no-show/pending bookings, and aggregate by date/court.
4. Occupancy is booked court-hours divided by active court opening-hours for the selected range, capped at 100%.
5. Concurrent requests targeting one slot yield one holder and conflicts for other users; there are no unexpected server errors or duplicate bookings.
6. CI gates publication on successful lint, unit tests, and production builds.

## 3. Test approach and environment

Use API-level integration tests against the actual NestJS service and MySQL 8.4/InnoDB configured with the project schema. Seed an ADMIN, OWNER, and isolated CUSTOMER accounts. Use a future AVAILABLE slot for race tests. Run backend unit tests and CI-equivalent lint/build commands. For HTTP contention, run the repository probe (`npm run load:concurrency -- --vus 100 --slot auto --confirm`) or k6 (`k6 run tests/load/booking-lock.js`) with isolated test users and a designated AVAILABLE slot. The direct probe also queries MySQL and checks the stored slot state; k6 measures the HTTP race and must be followed by its SQL assertion.

## 4. Pass/fail criteria

- Unauthorized/non-Admin mutation: HTTP 403, with no state change.
- Successful Admin action: HTTP 200/201 and persisted state matches the response.
- Report figures match the seeded booking/court fixtures and selected date range.
- Concurrent lock: exactly one success, remaining contenders receive 409, zero unexpected responses, exactly one locked/booked slot for the target court/time, and no duplicate booking. NFR-01 target: P95 under 2 seconds at 100 concurrent users.
- CI verify job passes before images publish.

## 5. Test cases

| ID | Preconditions | Steps | Expected result |
|---|---|---|---|
| ADM-01 | Admin and owner token exist | GET `/api/admin/clusters` as Admin | All clusters returned, including PENDING; owner data does not expose credentials |
| ADM-02 | A PENDING cluster exists | PATCH `/api/admin/clusters/{id}/decision` with `APPROVED` | Status becomes APPROVED and cluster is discoverable/bookable |
| ADM-03 | A PENDING cluster exists | Submit `REJECTED`; then attempt booking discovery | Status is REJECTED and cluster is not bookable |
| ADM-04 | Admin and customer accounts exist | GET `/api/admin/users`; PATCH role and active state | Safe account fields only; role/status persist; secrets are absent |
| ADM-05 | Owner token exists | Call admin users and cluster decision endpoints | HTTP 403; database state unchanged |
| ADM-06 | Admin token exists | Deactivate a non-admin, then authenticate that user | Deactivation persists and subsequent authentication is denied |
| RPT-01 | Seed known paid/confirmed and cancelled bookings | GET owner stats for `today` | Revenue/booking count include qualifying states only; date buckets include zero days |
| RPT-02 | Seed bookings across two owners | GET `/api/admin/stats?range=7days` | Totals equal the system aggregate, with no owner omitted or double counted |
| RPT-03 | Seed active courts with known opening hours and occupied intervals | Compare calculated occupancy with fixture arithmetic | Percentage equals booked hours / available hours × 100 and does not exceed 100 |
| CON-01 | One AVAILABLE slot; N isolated users | Run 100 lock requests concurrently, then query slot row | One success, 99 expected conflicts, one holder, zero unexpected errors/double-booking |
| CON-02 | One slot held by user A | Submit concurrent confirms from A and other users | At most one booking is created; non-holder confirmations fail; one slot references one booking |
| CON-03 | Two users request overlapping multi-slot sets in opposite order | Run repository `test:concurrency` scenario | One complete request succeeds; loser rolls back every slot; no deadlock leak/partial hold |
| OPS-01 | GitHub PR with valid source | Execute `verify` workflow | Backend/frontend lint, tests, and builds pass; publish job is skipped for PR |
| OPS-02 | Push to default branch | Execute workflow | Verify passes, then backend and frontend images are tagged and published to GHCR |

## 6. Load test execution record template

Record commit SHA, date, DB/service versions, VU count, duration, target slot ID, P50/P95/P99, HTTP success/conflict/unexpected counts, final `booking_slots` row, duplicate booking query count, and pass/fail. Do not run destructive reset SQL against production data.

For DB verification after a race, query the target `booking_slots` row by `slot_id`; expected `locked_by` has at most one value and `booking_id` references at most one booking. Verify duplicate booked periods with:

```sql
SELECT court_id, start_time, COUNT(*) AS booked_count
FROM booking_slots
WHERE status = 'BOOKED'
GROUP BY court_id, start_time
HAVING COUNT(*) > 1;
```

Expected rows: zero.
