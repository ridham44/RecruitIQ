// Build plan P4: default SMS driver — logs instead of sending, so OTP works
// in development with no provider or cost. The code shows in the API
// server's terminal.
export const name = 'console';

export async function send({ to, body }) {
  console.log(`[sms:console] To ${to}: ${body}`);
}
