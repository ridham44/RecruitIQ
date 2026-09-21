import * as localDriver from './local.driver.js';
import * as databaseDriver from './database.driver.js';
import * as cloudDriver from './cloud.driver.js';

// Single seam the rest of the app depends on. Swapping storage providers
// (Section 9) means changing STORAGE_DRIVER and implementing cloud.driver.js
// — resumes.service.js never imports a driver directly.
//
// "database" is the default: it's the only driver that works out of the
// box on Vercel serverless (no persistent local filesystem) without
// requiring a third-party storage account. "local" remains available for
// anyone who wants resumes on disk during local development; it must never
// be used in production. "cloud" is a stub for a future S3/R2/Cloudinary
// implementation.
const drivers = { local: localDriver, database: databaseDriver, cloud: cloudDriver };

const driverName = process.env.STORAGE_DRIVER || 'database';
const driver = drivers[driverName] || databaseDriver;

export const storage = {
  save: driver.save,
  read: driver.read,
};
