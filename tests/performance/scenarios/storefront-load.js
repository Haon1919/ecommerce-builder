import http from 'k6/http';
import { check, sleep } from 'k6';

// Read target URL from environment variable, defaulting to local dev server
const TARGET_URL = __ENV.TARGET_URL || 'http://localhost:3003';

export const options = {
    // A simple load test simulating normal traffic
    stages: [
        { duration: '30s', target: 20 }, // Ramp up to 20 users
        { duration: '1m', target: 20 },  // Stay at 20 users for 1 min
        { duration: '10s', target: 0 },  // Ramp down to 0 users
    ],
    thresholds: {
        // 95% of requests must complete below 500ms
        http_req_duration: ['p(95)<500'],
        // Less than 1% of requests can fail
        http_req_failed: ['rate<0.01'],
    },
};

export default function () {
    const res = http.get(TARGET_URL);

    check(res, {
        'is status 200': (r) => r.status === 200,
        'body size is > 0': (r) => r.body.length > 0,
    });

    // Emulate a user thinking for 1 to 3 seconds before next interaction
    sleep(Math.random() * 2 + 1);
}
