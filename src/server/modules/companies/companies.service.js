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

export async function getDashboardOverview(userId) {
  const company = await getCompanyByUserId(userId);
  const companyId = company.id;

  const jobs = await prisma.job.findMany({
    where: { companyId },
    include: {
      _count: {
        select: {
          applications: true,
          interviewSlots: true,
        },
      },
      applications: {
        include: {
          candidate: { include: { educations: true } },
          screeningResult: true,
          resume: {
            select: {
              id: true,
              fileName: true,
              rawText: true,
              parsedData: true,
            },
          },
          interviews: {
            include: {
              slot: true,
              report: true,
              events: true,
              questions: {
                select: {
                  id: true,
                  stage: true,
                  text: true,
                  type: true,
                  answer: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      interviewSlots: {
        include: {
          interviews: {
            include: {
              application: {
                include: { candidate: true },
              },
              report: true,
            },
          },
        },
        orderBy: { startTime: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // 1. Open jobs & jobs summary
  const openJobs = jobs.filter((j) => j.status === 'OPEN');
  const jobsSummary = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    status: j.status,
    applicationsCount: j._count.applications,
    slotsCount: j._count.interviewSlots,
    createdAt: j.createdAt,
    location: j.location,
    employmentType: j.employmentType,
    workMode: j.workMode,
    openings: j.openings,
    jobLevel: j.jobLevel,
    salaryRange: j.salaryRange,
  }));

  // 2. Candidate Pipeline by Stage
  const STAGES = [
    { key: 'APPLIED', label: 'Applied', color: 'slate' },
    { key: 'SCREENING', label: 'Screening', color: 'blue' },
    { key: 'SHORTLISTED', label: 'Shortlisted', color: 'amber' },
    { key: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled', color: 'indigo' },
    { key: 'INTERVIEW_COMPLETED', label: 'Interview Completed', color: 'emerald' },
    { key: 'REJECTED', label: 'Rejected', color: 'red' },
  ];

  const stageCounts = {
    APPLIED: 0,
    SCREENING: 0,
    SHORTLISTED: 0,
    INTERVIEW_SCHEDULED: 0,
    INTERVIEW_COMPLETED: 0,
    REJECTED: 0,
  };

  const allApplications = [];
  const allInterviews = [];

  for (const job of jobs) {
    for (const app of job.applications) {
      stageCounts[app.status] = (stageCounts[app.status] || 0) + 1;
      allApplications.push({
        ...app,
        jobTitle: job.title,
        jobRequiredSkills: job.requiredSkills || [],
        jobPreferredSkills: job.preferredSkills || [],
        jobMinExperience: job.minimumExperience || 0,
      });

      for (const interview of app.interviews) {
        allInterviews.push({
          ...interview,
          jobId: job.id,
          jobTitle: job.title,
          candidateName: app.candidate.fullName,
          candidateId: app.candidate.id,
          applicationStatus: app.status,
        });
      }
    }
  }

  const totalApplications = allApplications.length;

  const pipeline = STAGES.map((s) => ({
    ...s,
    count: stageCounts[s.key] || 0,
    percentage: totalApplications > 0 ? Math.round(((stageCounts[s.key] || 0) / totalApplications) * 100) : 0,
  }));

  // Interviews Today
  const interviewsToday = allInterviews.filter((i) => {
    const slotDate = i.slot?.startTime ? new Date(i.slot.startTime).toISOString().slice(0, 10) : null;
    return slotDate === todayStr;
  });
  const scheduledTodayCount = interviewsToday.filter((i) => i.status === 'SCHEDULED').length;
  const completedTodayCount = interviewsToday.filter((i) => i.status === 'COMPLETED').length;

  // Completed Interviews
  const completedInterviews = allInterviews
    .filter((i) => i.status === 'COMPLETED')
    .sort((a, b) => new Date(b.endedAt || b.createdAt) - new Date(a.endedAt || a.createdAt));

  // 3. Needs Attention Today items
  const needsAttention = [];

  // A) Candidates waiting for review (APPLIED or SCREENING)
  allApplications
    .filter((a) => a.status === 'APPLIED' || a.status === 'SCREENING')
    .forEach((a) => {
      const isScreened = a.screeningResult?.status === 'COMPLETED';
      needsAttention.push({
        id: `review-${a.id}`,
        type: isScreened ? 'SCREENED_AWAITING_REVIEW' : 'SCREENING_PENDING',
        priority: 'medium',
        title: isScreened ? 'Screening complete — review candidate' : 'Screening pending',
        description: isScreened
          ? `${a.candidate.fullName} scored ${Math.round(a.screeningResult.overallScore)}% match for ${a.jobTitle}. Ready for shortlist or reject decision.`
          : `${a.candidate.fullName} applied for ${a.jobTitle}. Run AI screening or manual review.`,
        candidateName: a.candidate.fullName,
        candidateId: a.candidate.id,
        jobTitle: a.jobTitle,
        jobId: a.jobId,
        targetUrl: `/company/jobs/${a.jobId}/candidates/${a.candidate.id}`,
        badge: isScreened ? `${Math.round(a.screeningResult.overallScore)}% Match` : 'New Application',
      });
    });

  // B) Candidates shortlisted but not yet scheduled
  allApplications
    .filter((a) => a.status === 'SHORTLISTED')
    .forEach((a) => {
      const hasActiveInterview = a.interviews.some((i) => i.status === 'SCHEDULED' || i.status === 'COMPLETED');
      if (!hasActiveInterview) {
        needsAttention.push({
          id: `shortlisted-unscheduled-${a.id}`,
          type: 'SHORTLISTED_PENDING_SCHEDULE',
          priority: 'high',
          title: 'Shortlisted — awaiting interview booking',
          description: `${a.candidate.fullName} is shortlisted for ${a.jobTitle}. Check if available interview slots are published.`,
          candidateName: a.candidate.fullName,
          candidateId: a.candidate.id,
          jobTitle: a.jobTitle,
          jobId: a.jobId,
          targetUrl: `/company/jobs/${a.jobId}/interviews`,
          badge: 'Shortlisted',
        });
      }
    });

  // C) Interviews scheduled today
  allInterviews
    .filter((i) => {
      const slotDate = i.slot?.startTime ? new Date(i.slot.startTime).toISOString().slice(0, 10) : null;
      return i.status === 'SCHEDULED' && slotDate === todayStr;
    })
    .forEach((i) => {
      needsAttention.push({
        id: `interview-today-${i.id}`,
        type: 'INTERVIEW_TODAY',
        priority: 'high',
        title: 'Interview scheduled today',
        description: `${i.candidateName} has an interview today for ${i.jobTitle} at ${new Date(i.slot.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`,
        candidateName: i.candidateName,
        candidateId: i.candidateId,
        jobTitle: i.jobTitle,
        jobId: i.jobId,
        interviewId: i.id,
        targetUrl: `/company/jobs/${i.jobId}/interviews/${i.id}`,
        badge: 'Scheduled Today',
      });
    });

  // D) Completed interviews whose report is ready / awaiting recruiter decision
  allInterviews
    .filter((i) => i.status === 'COMPLETED')
    .slice(0, 6)
    .forEach((i) => {
      const score = i.report?.overallScore != null ? `${Math.round(i.report.overallScore)}/100` : 'Pending Score';
      needsAttention.push({
        id: `decision-needed-${i.id}`,
        type: 'INTERVIEW_AWAITING_DECISION',
        priority: 'medium',
        title: 'AI Interview complete — review report & decision',
        description: `${i.candidateName} completed the AI interview for ${i.jobTitle} with overall score ${score}. Make next hiring decision.`,
        candidateName: i.candidateName,
        candidateId: i.candidateId,
        jobTitle: i.jobTitle,
        jobId: i.jobId,
        interviewId: i.id,
        targetUrl: `/company/jobs/${i.jobId}/interviews/${i.id}`,
        badge: score,
      });
    });

  // 4. Recent Completed Interviews
  const recentCompleted = completedInterviews.slice(0, 8).map((i) => ({
    interviewId: i.id,
    candidateName: i.candidateName,
    candidateId: i.candidateId,
    jobTitle: i.jobTitle,
    jobId: i.jobId,
    date: i.endedAt || i.slot?.startTime || i.createdAt,
    overallScore: i.report?.overallScore ?? null,
    technicalScore: i.report?.technicalScore ?? null,
    communicationScore: i.report?.communicationScore ?? null,
    reportStatus: i.report?.status || (i.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING'),
    eventsCount: i.events?.length || 0,
    tabSwitches: i.events?.filter((e) => e.type === 'TAB_SWITCH').length || 0,
    detailUrl: `/company/jobs/${i.jobId}/interviews/${i.id}`,
  }));

  // 5. What AI Evaluated (Phase 3 System Summary)
  const scores = completedInterviews.map((i) => i.report?.overallScore).filter((s) => s != null);
  const avgOverallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const techScores = completedInterviews.map((i) => i.report?.technicalScore).filter((s) => s != null);
  const avgTechScore = techScores.length > 0 ? Math.round(techScores.reduce((a, b) => a + b, 0) / techScores.length) : null;

  const commScores = completedInterviews.map((i) => i.report?.communicationScore).filter((s) => s != null);
  const avgCommScore = commScores.length > 0 ? Math.round(commScores.reduce((a, b) => a + b, 0) / commScores.length) : null;

  const allStrengths = completedInterviews.flatMap((i) => i.report?.strengths || []);
  const commonStrengths = Array.from(new Set(allStrengths)).slice(0, 6);

  const evaluationOverview = {
    pillars: [
      {
        name: 'Technical Competency & Depth',
        scoreKey: 'technicalScore',
        avgScore: avgTechScore,
        rubric: ['Factual accuracy (correctness)', 'Depth vs superficial answers', 'Domain-specific problem solving'],
        description: 'Scored 0–100 independently from delivery style. Probes whether answers show actual conceptual depth.',
      },
      {
        name: 'Communication Clarity & Structure',
        scoreKey: 'communicationScore',
        avgScore: avgCommScore,
        rubric: ['Answer relevance to question asked', 'Clarity of thought & logical flow', 'Conciseness & focus'],
        description: 'Evaluates structure and clarity. Guardrails ensure accents, grammar, or STT slips are never penalized.',
      },
      {
        name: 'Requirement & Skill Overlap',
        scoreKey: 'resumeAlignment',
        avgScore: null,
        rubric: ['Required skills matched vs missing', 'Preferred skills matched', 'Deterministic overlap score'],
        description: 'Computed deterministically from candidate resume and job requirements, not left to LLM guesswork.',
      },
      {
        name: 'Security & Proctoring Audit',
        scoreKey: 'events',
        avgScore: null,
        rubric: ['Tab switch & page focus detection', 'Camera & microphone presence', 'Fullscreen & connection audits'],
        description: 'Audits presence and attention during the interview session without invasive emotion or facial analysis.',
      },
    ],
    stats: {
      totalEvaluated: completedInterviews.length,
      avgOverallScore,
      avgTechScore,
      avgCommScore,
      commonStrengths,
    },
  };

  // 6. Recruiter Pre-Advancement Checklist candidates
  const candidateChecklistList = allApplications
    .filter((a) => ['SHORTLISTED', 'INTERVIEW_COMPLETED', 'APPLIED', 'SCREENING'].includes(a.status))
    .slice(0, 10)
    .map((app) => {
      const interview = app.interviews[0];
      const parsed = app.resume?.parsedData;
      const sr = app.screeningResult;
      const report = interview?.report;

      const hasScreening = sr?.status === 'COMPLETED';
      const requiredSkills = app.jobRequiredSkills || [];
      const candidateSkills = parsed?.skills || app.candidate.skills || [];
      const matchedRequired = requiredSkills.filter((s) => candidateSkills.some((cs) => cs.toLowerCase() === s.toLowerCase()));
      const missingRequired = requiredSkills.filter((s) => !candidateSkills.some((cs) => cs.toLowerCase() === s.toLowerCase()));

      const hasInterviewCompleted = interview?.status === 'COMPLETED';
      const hasReport = report?.status === 'COMPLETED';
      const tabSwitches = interview?.events?.filter((e) => e.type === 'TAB_SWITCH').length || 0;
      const hasProctoringFlag = tabSwitches > 2;

      const hasExperienceData = (parsed?.totalExperienceYears ?? null) != null || (parsed?.experience?.length || 0) > 0;
      const hasEducationData =
        (app.candidate.educations?.length || 0) > 0 || !!parsed?.degree || (parsed?.education?.length || 0) > 0;

      const checks = [
        {
          id: 'screening',
          name: 'AI Screening',
          readyLabel: 'Complete',
          detail: hasScreening ? `Score: ${Math.round(sr.overallScore)}/100` : 'Screening not run yet',
          status: hasScreening ? 'passed' : 'warning',
        },
        {
          id: 'skills',
          name: 'Skills Match',
          readyLabel: 'Verified',
          detail: `${matchedRequired.length}/${requiredSkills.length} required skills matched${missingRequired.length > 0 ? ` (missing: ${missingRequired.slice(0, 2).join(', ')})` : ''}`,
          status: missingRequired.length === 0 ? 'passed' : matchedRequired.length > 0 ? 'warning' : 'failed',
        },
        {
          id: 'experience',
          name: 'Experience/Education',
          readyLabel: 'Verified',
          detail: `${parsed?.totalExperienceYears ?? 0} yrs experience · ${app.candidate.educations?.[0]?.degree || parsed?.degree || 'Degree not listed'}`,
          status: hasExperienceData && hasEducationData ? 'passed' : 'warning',
        },
        {
          id: 'interview',
          name: 'AI Interview',
          readyLabel: 'Complete',
          detail: hasInterviewCompleted ? 'Interview session completed' : 'Interview not completed yet',
          status: hasInterviewCompleted ? 'passed' : 'warning',
        },
        {
          id: 'interview_report',
          name: 'Interview Report',
          readyLabel: 'Ready',
          detail: hasReport
            ? `Overall: ${Math.round(report.overallScore)}/100 (Tech: ${Math.round(report.technicalScore || 0)}, Comm: ${Math.round(report.communicationScore || 0)})`
            : hasInterviewCompleted
              ? 'Report generating...'
              : 'Awaiting interview',
          status: hasReport ? 'passed' : 'warning',
        },
        {
          id: 'proctoring',
          name: 'Security Audit',
          readyLabel: 'Complete',
          detail: interview ? `${interview.events?.length || 0} audit events (${tabSwitches} tab switch${tabSwitches === 1 ? '' : 'es'})` : 'No interview session yet',
          status: !interview ? 'warning' : hasProctoringFlag ? 'warning' : 'passed',
        },
        {
          id: 'resume',
          name: 'Resume',
          readyLabel: 'Available',
          detail: app.resume?.fileName ? `${app.resume.fileName} attached` : 'Resume available',
          status: 'passed',
        },
      ];

      const passedCount = checks.filter((c) => c.status === 'passed').length;

      return {
        candidateId: app.candidate.id,
        candidateName: app.candidate.fullName,
        applicationId: app.id,
        jobId: app.jobId,
        jobTitle: app.jobTitle,
        applicationStatus: app.status,
        checks,
        passedCount,
        totalChecks: checks.length,
        readyToAdvance: passedCount >= 5,
        targetCandidateUrl: `/company/jobs/${app.jobId}/candidates/${app.candidate.id}`,
        targetInterviewUrl: interview ? `/company/jobs/${app.jobId}/interviews/${interview.id}` : null,
      };
    });

  return {
    company: {
      id: company.id,
      name: company.name,
      logoUrl: company.logoUrl,
    },
    openJobsCount: openJobs.length,
    totalJobsCount: jobs.length,
    totalApplications,
    interviewsTodayCount: interviewsToday.length,
    scheduledTodayCount,
    completedTodayCount,
    completedInterviewsCount: completedInterviews.length,
    jobsSummary,
    pipeline,
    needsAttention,
    recentCompleted,
    evaluationOverview,
    candidateChecklistList,
  };
}

