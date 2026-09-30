import * as consoleDriver from './console.driver.js';
import * as twilioDriver from './twilio.driver.js';
import { env } from '../../../config/env.js';

// Build plan P4: same seam as the email drivers — callers only use smsDriver,
// switching providers is SMS_DRIVER in .env (console | twilio). Add an
// Indian DLT provider (e.g. MSG91) as another driver file here.
const drivers = { console: consoleDriver, twilio: twilioDriver };

const driver = drivers[env.smsDriver] || consoleDriver;

export const smsDriver = {
  name: driver.name,
  send: driver.send,
};
