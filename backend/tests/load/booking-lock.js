import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const successes = new Counter('booking_lock_successes');
const conflicts = new Counter('booking_lock_conflicts');
const unexpected = new Counter('booking_lock_unexpected');
const latency = new Trend('booking_lock_latency', true);
const users = (__ENV.PROBE_USERS || '').split(',').filter(Boolean);
http.setResponseCallback(http.expectedStatuses(200, 201, 409));

export const options = {
  scenarios: { contention: { executor: 'per-vu-iterations', vus: Number(__ENV.VUS || users.length), iterations: 1, maxDuration: '2m' } },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    booking_lock_latency: ['p(95)<2000'],
    booking_lock_successes: ['count==1'],
    booking_lock_unexpected: ['count==0'],
  },
};

export function setup() {
  if (!__ENV.BASE_URL || !__ENV.SLOT_ID || users.length < 2) {
    throw new Error('Set BASE_URL, SLOT_ID and PROBE_USERS=email:password,... (minimum 2 users).');
  }
  if (Number(__ENV.VUS || users.length) !== users.length) throw new Error('VUS must equal the number of PROBE_USERS.');
  return users.map((credential) => {
    const [email, password] = credential.split(':');
    const login = http.post(`${__ENV.BASE_URL}/api/auth/login`, JSON.stringify({ email, password }), { headers: { 'Content-Type': 'application/json' } });
    check(login, { 'login successful': (r) => r.status === 200 });
    const token = login.json('tokens.accessToken');
    if (!token) throw new Error(`Login failed for ${email} (HTTP ${login.status}).`);
    return token;
  });
}

export default function (tokens) {
  const token = tokens[__VU - 1];
  const started = Date.now();
  const response = http.post(`${__ENV.BASE_URL}/api/bookings/lock`, JSON.stringify({ slotIds: [Number(__ENV.SLOT_ID)] }), { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
  latency.add(Date.now() - started);
  if (response.status === 200 || response.status === 201) successes.add(1);
  else if (response.status === 409) conflicts.add(1);
  else unexpected.add(1);
  check(response, { 'only lock success or expected conflict': (r) => r.status === 200 || r.status === 201 || r.status === 409 });
}

export function teardown() {
  // Inspect the final DB state using the companion SQL assertions in IEEE-829 test cases.
}