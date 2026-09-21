import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

export async function getCompanyByUserId(userId) {
  const company = await prisma.company.findUnique({ where: { userId } });
  if (!company) throw ApiError.notFound('Company profile not found');
  return company;
}

export async function updateCompanyProfile(userId, data) {
  const company = await getCompanyByUserId(userId);
  return prisma.company.update({
    where: { id: company.id },
    data: {
      name: data.name ?? company.name,
      website: data.website ?? company.website,
      industry: data.industry ?? company.industry,
      size: data.size ?? company.size,
      location: data.location ?? company.location,
      description: data.description ?? company.description,
      logoUrl: data.logoUrl ?? company.logoUrl,
    },
  });
}
