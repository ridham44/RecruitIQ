import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Return all education records for a candidate (ordered oldest-first by startYear).
 */
export async function listEducations(candidateId) {
  return prisma.education.findMany({
    where: { candidateId },
    orderBy: [{ startYear: 'asc' }, { createdAt: 'asc' }],
  });
}

/**
 * Add a new education record to the candidate's profile.
 */
export async function addEducation(candidateId, data) {
  return prisma.education.create({
    data: {
      candidateId,
      degree: data.degree,
      fieldOfStudy: data.fieldOfStudy ?? null,
      institution: data.institution ?? null,
      startYear: data.startYear ?? null,
      endYear: data.isCurrentlyStudying ? null : (data.endYear ?? null),
      isCurrentlyStudying: data.isCurrentlyStudying ?? false,
      grade: data.grade ?? null,
    },
  });
}

/**
 * Update a specific education record.
 * Verifies ownership via candidateId before updating.
 */
export async function updateEducation(id, candidateId, data) {
  const record = await prisma.education.findFirst({ where: { id, candidateId } });
  if (!record) throw ApiError.notFound('Education record not found');

  return prisma.education.update({
    where: { id },
    data: {
      degree: data.degree ?? record.degree,
      fieldOfStudy: data.fieldOfStudy !== undefined ? data.fieldOfStudy : record.fieldOfStudy,
      institution: data.institution !== undefined ? data.institution : record.institution,
      startYear: data.startYear !== undefined ? data.startYear : record.startYear,
      endYear: data.isCurrentlyStudying ? null : (data.endYear !== undefined ? data.endYear : record.endYear),
      isCurrentlyStudying: data.isCurrentlyStudying !== undefined ? data.isCurrentlyStudying : record.isCurrentlyStudying,
      grade: data.grade !== undefined ? data.grade : record.grade,
    },
  });
}

/**
 * Delete an education record.
 * Verifies ownership via candidateId before deleting.
 */
export async function deleteEducation(id, candidateId) {
  const record = await prisma.education.findFirst({ where: { id, candidateId } });
  if (!record) throw ApiError.notFound('Education record not found');
  return prisma.education.delete({ where: { id } });
}
