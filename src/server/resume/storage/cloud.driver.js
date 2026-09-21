// Placeholder for a future S3/R2/Cloudinary-backed driver (Section 9/19).
// Implement `save`/`read` against the chosen SDK and flip STORAGE_DRIVER to
// "cloud" — no other file in the codebase needs to change, since everything
// goes through resume/storage/index.js.
export async function save() {
  throw new Error(
    'Cloud storage driver is not configured. Implement src/server/resume/storage/cloud.driver.js ' +
      'and set STORAGE_DRIVER=cloud with the relevant provider credentials.'
  );
}

export async function read() {
  throw new Error('Cloud storage driver is not configured.');
}
