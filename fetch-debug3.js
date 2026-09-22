import * as authService from './src/server/modules/auth/auth.service.js';
import { prisma } from './src/server/config/prisma.js';

async function run() {
  const { token } = await authService.registerCompany({
    email: `test-${Date.now()}@example.com`,
    password: 'password',
    companyName: 'Test Company'
  });

  const response = await fetch('http://localhost:3001/api/v1/jobs/company/mine', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const body = await response.json().catch(() => null);
  console.log('Status:', response.status);
  console.log('Body:', body);
}

run().catch(console.error);
