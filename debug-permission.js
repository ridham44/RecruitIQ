import { createApp } from './src/server/app.js';
import request from 'supertest';
import { signToken } from './src/server/modules/auth/token.util.js';

const app = createApp();

async function run() {
  const mockUser = {
    id: 'test-user-id',
    role: 'COMPANY',
    email: 'test@example.com'
  };

  const token = signToken(mockUser);
  console.log('Token generated:', token);

  const res = await request(app)
    .get('/api/v1/jobs/company/mine')
    .set('Authorization', `Bearer ${token}`);

  console.log('Response Status:', res.status);
  console.log('Response Body:', res.body);
}

run().catch(console.error);
