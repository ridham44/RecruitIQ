// A storage driver only needs to implement `save`. Keeping the interface
// this small is what lets Section 9's "swap local disk for S3/R2/Cloudinary
// later" requirement hold without touching callers.
//
// save(buffer, meta: { fileName, mimeType, candidateId }) => Promise<{ storageKey, storageUrl }>
