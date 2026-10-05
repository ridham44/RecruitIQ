import { z } from 'zod';
import { orgNameSchema, optionalText, optionalUrlSchema, optionalUrlFor } from './common.js';

// Agency (company) profile — owner only.
export const updateCompanyProfileSchema = z
  .object({
    name: orgNameSchema('Agency name'),
    website: optionalUrlSchema,
    industry: optionalText('Industry', 120),
    size: optionalText('Company size', 60),
    location: optionalText('Location', 200),
    description: optionalText('Description', 4000),
    logoUrl: optionalUrlFor('Logo URL'),
  })
  .partial();
