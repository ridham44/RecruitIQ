import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

export async function getCandidateByUserId(userId) {
  const candidate = await prisma.candidate.findUnique({ where: { userId } });
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
      university: data.university ?? candidate.university,
      college: data.college ?? candidate.college,
      degree: data.degree ?? candidate.degree,
      academicStatus: data.academicStatus ?? candidate.academicStatus,
      currentSemester: data.academicStatus === 'COMPLETED' ? null : data.currentSemester ?? candidate.currentSemester,
      latestSpi: data.latestSpi ?? candidate.latestSpi,
    },
  });
}
