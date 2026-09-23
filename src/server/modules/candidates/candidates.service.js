import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

const CANDIDATE_WITH_EDUCATION = {
  include: { educations: { orderBy: [{ startYear: 'asc' }, { createdAt: 'asc' }] } },
};

export async function getCandidateByUserId(userId) {
  const candidate = await prisma.candidate.findUnique({
    where: { userId },
    ...CANDIDATE_WITH_EDUCATION,
  });
  if (!candidate) throw ApiError.notFound('Candidate profile not found');
  return candidate;
}

export async function updateCandidateProfile(userId, data) {
  const candidate = await getCandidateByUserId(userId);
  return prisma.candidate.update({
    where: { id: candidate.id },
    data: {
      fullName: data.fullName ?? candidate.fullName,
      phone: data.phone ?? candidate.phone,
      location: data.location ?? candidate.location,
      headline: data.headline ?? candidate.headline,
      skills: data.skills ?? candidate.skills,
      gender: data.gender ?? candidate.gender,
    },
    ...CANDIDATE_WITH_EDUCATION,
  });
}

