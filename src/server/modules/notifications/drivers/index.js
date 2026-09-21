import * as brevoDriver from './brevo.driver.js';
import * as consoleDriver from './console.driver.js';
import { env } from '../../../config/env.js';

// Same seam pattern as src/server/resume/storage/index.js: callers never
// import a driver directly, so swapping providers (or adding a second one
// later) means adding a driver file and updating this map — never touching
// email.service.js. Defaults to "brevo" once BREVO_API_KEY is set, else
// falls back to "console" so the app never crashes for lack of email
// configuration — it just logs instead of sending.
const drivers = { brevo: brevoDriver, console: consoleDriver };

const driverName = process.env.EMAIL_PROVIDER || (env.brevoApiKey ? 'brevo' : 'console');
const driver = drivers[driverName] || consoleDriver;

export const emailDriver = {
  send: driver.send,
};
