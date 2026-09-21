import * as localDriver from './local.driver.js';
import * as cloudDriver from './cloud.driver.js';

// Single seam the rest of the app depends on. Swapping storage providers
// (Section 9) means changing STORAGE_DRIVER and implementing cloud.driver.js
// — resume.service.js never imports a driver directly.
const drivers = { local: localDriver, cloud: cloudDriver };

const driverName = process.env.STORAGE_DRIVER || 'local';
const driver = drivers[driverName] || localDriver;

export const storage = {
  save: driver.save,
  read: driver.read,
};
