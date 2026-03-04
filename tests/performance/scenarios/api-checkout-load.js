import http from 'k6/http';
import { check, sleep } from 'k6';

const API_URL = __ENV.TARGET_URL || 'http://localhost:3001/api';
// Simulate a specific store
const STORE_ID = __ENV.STORE_ID || 'demo-store-1';

export const options = {
    stages: [
        { duration: '15s', target: 50 }, // Spike to 50 concurrent checkouts
        { duration: '30s', target: 50 }, // Hold
        { duration: '15s', target: 0 },  // Down
    ],
    thresholds: {
        http_req_duration: ['p(95)<1000'], // API requests can be slightly slower
        http_req_failed: ['rate<0.05'], // Max 5% failure rate during spike
    },
};

export default function () {
    const url = `${API_URL}/stores/${STORE_ID}/checkout`;
    const payload = JSON.stringify({
        items: [{ productId: 'test-product', quantity: 1 }],
        customerDetails: {
            email: `load-tester-${__VU}-${__ITER}@example.com`,
            name: 'Load Tester',
        }
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const res = http.post(url, payload, params);

    check(res, {
        'is status 201 or 400 (validation)': (r) => r.status === 201 || r.status === 400,
    });

    sleep(1);
}
