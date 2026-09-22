import { signToken } from './src/server/modules/auth/token.util.js';

async function run() {
  const mockUser = {
    id: 'test-user-id',
    role: 'CANDIDATE',
    email: 'test@example.com'
  };

  const token = signToken(mockUser);
  console.log('Token generated:', token);

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
