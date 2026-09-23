/**
 * reset-and-seed.js
 *
 * Full database reset + demo data seed for RecruitIQ.
 *
 * What this does:
 *  1. Truncates ALL tables (leaf → root order to respect FK constraints)
 *  2. Re-runs prisma/seed.js logic (company + candidates + job + applications)
 *  3. Adds ScreeningResult for all 10 candidates:
 *       - 3 rejected  (overallScore < 45)
 *       - 7 shortlisted (overallScore ≥ 55)
 *     Updates Application.status accordingly.
 *  4. Runs prisma/seed-demo-interviews.js logic (3 completed interviews)
 *  5. Creates 7 future InterviewSlot records for the 7 shortlisted candidates
 *     (so they can see/book available slots in the UI)
 *
 * Usage:  node reset-and-seed.js
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo@1234';
const COMPANY_EMAIL = 'company@ravantratech.demo';
const DEMO_MODEL_TAG = 'demo-seed-data';

// ─────────────────────────────────────────────────────────────────────────────
// Candidate definitions (identical to prisma/seed.js — copy kept here so this
// script is fully self-contained and doesn't import the other seed)
// ─────────────────────────────────────────────────────────────────────────────

const CANDIDATES = [
  {
    email: 'priya.sharma@example.com',
    fullName: 'Priya Sharma',
    gender: 'FEMALE',
    phone: '+91-9820011122',
    location: 'Ahmedabad, Gujarat',
    headline: 'Frontend Developer (React)',
    skills: ['React', 'JavaScript', 'Redux', 'TypeScript', 'REST API', 'HTML', 'CSS', 'Git', 'Jest'],
    university: 'Nirma University',
    college: 'Institute of Technology, Nirma University',
    degree: 'B.Tech in Computer Science and Technology',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 8.7,
    resumeFileName: 'priya_sharma_resume.pdf',
    resumeText: `PRIYA SHARMA
Frontend Developer
Email: priya.sharma@example.com | Phone: +91-9820011122 | Ahmedabad, Gujarat

SUMMARY
Frontend developer with 2.5 years of experience building production React applications,
integrating REST APIs, and managing complex UI state with Redux.

SKILLS
React, JavaScript (ES6+), Redux, Redux Toolkit, TypeScript, REST API integration, HTML5, CSS3,
Git, Jest, React Testing Library, Webpack basics

EXPERIENCE
Frontend Developer — Tech Nova Solutions, Ahmedabad (Jan 2023 – Present, 2.5 years)
- Built and maintained a multi-tenant admin dashboard in React + TypeScript used by 40+ enterprise clients
- Integrated REST APIs for billing, user management, and analytics modules
- Migrated a large class-component codebase to functional components + hooks
- Introduced Jest + React Testing Library, raising test coverage from 12% to 61%

EDUCATION
B.Tech in Computer Science and Technology — Institute of Technology, Nirma University (CPI: 8.7)

CERTIFICATIONS
Meta Front-End Developer Professional Certificate`,
    parsedData: {
      name: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      skills: ['React', 'JavaScript', 'Redux', 'Redux Toolkit', 'TypeScript', 'REST API', 'HTML5', 'CSS3', 'Git', 'Jest'],
      experience: [{ company: 'Tech Nova Solutions', role: 'Frontend Developer', duration: 'Jan 2023 - Present (2.5 years)' }],
      education: [{ degree: 'B.Tech', field: 'Computer Science and Technology' }],
      totalExperienceYears: 2.5,
    },
    // Screening — shortlisted (good resume, but interview reveals weakness — see interview seed)
    screening: {
      overallScore: 72,
      skillMatchScore: 60,
      experienceMatchScore: 100,
      educationMatchScore: 95,
      matchedSkills: ['React', 'JavaScript', 'REST API'],
      missingSkills: ['HTML', 'CSS'],
      strengths: ['2.5 years of React experience', 'Familiar with Redux Toolkit and Jest'],
      concerns: ['Resume lists HTML5/CSS3 rather than the exact required HTML/CSS tags'],
      reasoning: 'Strong resume match on paper — React, JavaScript, Redux Toolkit, and REST API integration experience align well with the role.',
      status: 'SHORTLISTED',
    },
  },
  {
    email: 'ridham.patel@example.com',
    fullName: 'Ridham Patel',
    gender: 'MALE',
    phone: '+91-9924567890',
    location: 'Ahmedabad, Gujarat',
    headline: 'Full-Stack Developer (React + Node.js)',
    skills: ['React', 'JavaScript', 'TypeScript', 'Node.js', 'Redux', 'REST API', 'HTML', 'CSS', 'Git', 'PostgreSQL'],
    university: 'Gujarat Technological University',
    college: 'LDRP Institute of Technology and Research',
    degree: 'B.Tech in Computer Engineering',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 9.1,
    resumeFileName: 'ridham_patel_resume.pdf',
    resumeText: `RIDHAM PATEL
Full-Stack Developer
Email: ridham.patel@example.com | Phone: +91-9924567890 | Ahmedabad, Gujarat

SUMMARY
Full-stack developer with 3 years of hands-on React and Node.js experience.
Built and shipped 4 production SaaS products from scratch. Strong TypeScript and
REST API design skills.

SKILLS
React, TypeScript, JavaScript (ES6+), Node.js, Express, PostgreSQL, Redux, REST API,
HTML5, CSS3, Git, Jest, Webpack, Vite

EXPERIENCE
Full-Stack Developer — SoftEdge Technologies, Ahmedabad (Mar 2022 – Present, 3 years)
- Led frontend architecture for a real-time analytics dashboard (React + TypeScript + WebSocket)
- Built REST APIs in Node.js/Express consumed by mobile and web clients
- Implemented reusable component library used across 3 products
- Set up CI/CD pipelines with GitHub Actions

EDUCATION
B.Tech in Computer Engineering — LDRP Institute of Technology and Research, GTU (CPI: 9.1)

CERTIFICATIONS
AWS Certified Developer – Associate`,
    parsedData: {
      name: 'Ridham Patel',
      email: 'ridham.patel@example.com',
      skills: ['React', 'TypeScript', 'JavaScript', 'Node.js', 'Express', 'PostgreSQL', 'Redux', 'REST API', 'HTML5', 'CSS3', 'Git'],
      experience: [{ company: 'SoftEdge Technologies', role: 'Full-Stack Developer', duration: 'Mar 2022 - Present (3 years)' }],
      education: [{ degree: 'B.Tech', field: 'Computer Engineering' }],
      totalExperienceYears: 3,
    },
    // Screening — shortlisted (strong match across all dimensions)
    screening: {
      overallScore: 91,
      skillMatchScore: 100,
      experienceMatchScore: 100,
      educationMatchScore: 95,
      matchedSkills: ['React', 'JavaScript', 'HTML', 'CSS', 'REST API', 'Redux', 'TypeScript', 'Node.js', 'Git'],
      missingSkills: [],
      strengths: ['3 years full-stack experience', 'TypeScript proficiency', 'Node.js backend skills', 'Led frontend architecture'],
      concerns: [],
      reasoning: 'Exceptional match — all required and preferred skills present, strong production experience, high SPI.',
      status: 'SHORTLISTED',
    },
  },
  {
    email: 'riya.mehta@example.com',
    fullName: 'Riya Mehta',
    gender: 'FEMALE',
    phone: '+91-9876543210',
    location: 'Surat, Gujarat',
    headline: 'React Developer',
    skills: ['React', 'JavaScript', 'Redux', 'HTML', 'CSS', 'REST API', 'Git'],
    university: 'Veer Narmad South Gujarat University',
    college: 'Sarvajanik College of Engineering and Technology',
    degree: 'B.Tech in Information Technology',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 8.2,
    resumeFileName: 'riya_mehta_resume.pdf',
    resumeText: `RIYA MEHTA
React Developer
Email: riya.mehta@example.com | Phone: +91-9876543210 | Surat, Gujarat

SUMMARY
React developer with 2 years of experience building web applications and integrating REST APIs.

SKILLS
React, JavaScript (ES6+), Redux, HTML5, CSS3, REST API, Git

EXPERIENCE
React Developer — Webcraft Solutions, Surat (Jun 2023 – Present, 2 years)
- Built and maintained React web applications for e-commerce and SaaS clients
- Integrated REST APIs, managed state with Redux
- Implemented responsive layouts and UI component libraries

EDUCATION
B.Tech in Information Technology — SCET, Veer Narmad South Gujarat University (CPI: 8.2)`,
    parsedData: {
      name: 'Riya Mehta',
      email: 'riya.mehta@example.com',
      skills: ['React', 'JavaScript', 'Redux', 'HTML5', 'CSS3', 'REST API', 'Git'],
      experience: [{ company: 'Webcraft Solutions', role: 'React Developer', duration: 'Jun 2023 - Present (2 years)' }],
      education: [{ degree: 'B.Tech', field: 'Information Technology' }],
      totalExperienceYears: 2,
    },
    screening: {
      overallScore: 78,
      skillMatchScore: 80,
      experienceMatchScore: 90,
      educationMatchScore: 85,
      matchedSkills: ['React', 'JavaScript', 'HTML', 'CSS', 'REST API', 'Redux'],
      missingSkills: ['TypeScript'],
      strengths: ['Direct React + REST API experience', 'Redux state management', 'Responsive design'],
      concerns: ['No TypeScript experience mentioned', 'Smaller company background'],
      reasoning: 'Good match — covers all required skills, relevant React experience. Recommended for interview.',
      status: 'SHORTLISTED',
    },
  },
  {
    email: 'arjun.shah@example.com',
    fullName: 'Arjun Shah',
    gender: 'MALE',
    phone: '+91-9712345678',
    location: 'Vadodara, Gujarat',
    headline: 'React Frontend Developer',
    skills: ['React', 'JavaScript', 'HTML', 'CSS', 'REST API', 'Git', 'Bootstrap'],
    university: 'Maharaja Sayajirao University of Baroda',
    college: 'Faculty of Technology and Engineering, MSU Baroda',
    degree: 'B.Tech in Computer Science',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 7.8,
    resumeFileName: 'arjun_shah_resume.pdf',
    resumeText: `ARJUN SHAH
React Frontend Developer
Email: arjun.shah@example.com | Phone: +91-9712345678 | Vadodara, Gujarat

SUMMARY
Frontend developer with 1.5 years of React experience, integrating REST APIs and building responsive UIs.

SKILLS
React, JavaScript (ES6+), HTML5, CSS3, REST API, Git, Bootstrap

EXPERIENCE
Frontend Developer — PixelCraft Studios, Vadodara (Jan 2024 – Present, 1.5 years)
- Built UI components and pages in React for a B2B SaaS platform
- Integrated REST APIs for user dashboards

EDUCATION
B.Tech in Computer Science — MSU Baroda (CPI: 7.8)`,
    parsedData: {
      name: 'Arjun Shah',
      email: 'arjun.shah@example.com',
      skills: ['React', 'JavaScript', 'HTML5', 'CSS3', 'REST API', 'Git', 'Bootstrap'],
      experience: [{ company: 'PixelCraft Studios', role: 'Frontend Developer', duration: '1.5 years' }],
      education: [{ degree: 'B.Tech', field: 'Computer Science' }],
      totalExperienceYears: 1.5,
    },
    screening: {
      overallScore: 65,
      skillMatchScore: 70,
      experienceMatchScore: 70,
      educationMatchScore: 85,
      matchedSkills: ['React', 'JavaScript', 'HTML', 'CSS', 'REST API'],
      missingSkills: ['Redux', 'TypeScript'],
      strengths: ['Covers all required skills', 'Direct React + REST API experience'],
      concerns: ['Missing Redux and TypeScript (preferred)', 'Only 1.5 years experience'],
      reasoning: 'Meets minimum requirements. Shortlisted with note to assess Redux knowledge in interview.',
      status: 'SHORTLISTED',
    },
  },
  {
    email: 'kavya.nair@example.com',
    fullName: 'Kavya Nair',
    gender: 'FEMALE',
    phone: '+91-9988776655',
    location: 'Ahmedabad, Gujarat',
    headline: 'UI Developer (React)',
    skills: ['React', 'JavaScript', 'HTML', 'CSS', 'REST API', 'Figma', 'Git'],
    university: 'Gujarat University',
    college: 'Dhirubhai Ambani Institute of Information and Communication Technology',
    degree: 'B.Tech in ICT',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 8.5,
    resumeFileName: 'kavya_nair_resume.pdf',
    resumeText: `KAVYA NAIR
UI Developer
Email: kavya.nair@example.com | Phone: +91-9988776655 | Ahmedabad, Gujarat

SUMMARY
UI developer with 2 years of experience in React and design-to-code workflow, collaborating
closely with product and design teams.

SKILLS
React, JavaScript, HTML5, CSS3, REST API, Figma, Git

EXPERIENCE
UI Developer — CreativeStack, Ahmedabad (Jul 2023 – Present, 2 years)
- Translated Figma designs into pixel-perfect React components
- Integrated REST APIs and managed component-level state
- Led a UI revamp project for a fintech client

EDUCATION
B.Tech in ICT — DAIICT, Gujarat University (CPI: 8.5)`,
    parsedData: {
      name: 'Kavya Nair',
      email: 'kavya.nair@example.com',
      skills: ['React', 'JavaScript', 'HTML5', 'CSS3', 'REST API', 'Figma', 'Git'],
      experience: [{ company: 'CreativeStack', role: 'UI Developer', duration: '2 years' }],
      education: [{ degree: 'B.Tech', field: 'ICT' }],
      totalExperienceYears: 2,
    },
    screening: {
      overallScore: 70,
      skillMatchScore: 75,
      experienceMatchScore: 90,
      educationMatchScore: 90,
      matchedSkills: ['React', 'JavaScript', 'HTML', 'CSS', 'REST API'],
      missingSkills: ['Redux', 'TypeScript'],
      strengths: ['Design-to-code skills (Figma)', '2 years React experience', 'Fintech domain exposure'],
      concerns: ['No Redux or TypeScript experience'],
      reasoning: 'Solid React frontend skills, design awareness is a plus. Shortlisted for interview.',
      status: 'SHORTLISTED',
    },
  },
  {
    email: 'dev.solanki@example.com',
    fullName: 'Dev Solanki',
    gender: 'MALE',
    phone: '+91-9662233445',
    location: 'Rajkot, Gujarat',
    headline: 'Junior React Developer',
    skills: ['React', 'JavaScript', 'HTML', 'CSS', 'REST API'],
    university: 'Saurashtra University',
    college: 'Shree Jay Jalaram BCA College',
    degree: 'BCA',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 7.5,
    resumeFileName: 'dev_solanki_resume.pdf',
    resumeText: `DEV SOLANKI
Junior React Developer
Email: dev.solanki@example.com | Rajkot, Gujarat

SUMMARY
Junior React developer with 1 year of experience building web UIs and consuming REST APIs.

SKILLS
React, JavaScript, HTML, CSS, REST API

EXPERIENCE
Junior Frontend Developer — Nextweb Solutions, Rajkot (Jan 2025 – Present, 1 year)
- Built UI features in React for a logistics management platform
- Consumed REST APIs for data display

EDUCATION
BCA — Shree Jay Jalaram BCA College, Saurashtra University (CGPA: 7.5)`,
    parsedData: {
      name: 'Dev Solanki',
      email: 'dev.solanki@example.com',
      skills: ['React', 'JavaScript', 'HTML', 'CSS', 'REST API'],
      experience: [{ company: 'Nextweb Solutions', role: 'Junior Frontend Developer', duration: '1 year' }],
      education: [{ degree: 'BCA', field: 'Computer Applications' }],
      totalExperienceYears: 1,
    },
    screening: {
      overallScore: 57,
      skillMatchScore: 60,
      experienceMatchScore: 50,
      educationMatchScore: 65,
      matchedSkills: ['React', 'JavaScript', 'HTML', 'CSS', 'REST API'],
      missingSkills: ['Redux', 'TypeScript', 'Git'],
      strengths: ['Covers all required skills', 'Direct React + REST API experience'],
      concerns: ['Only 1 year experience (minimum required)', 'BCA vs B.Tech (preferred)', 'No Redux/TypeScript/Git mentioned'],
      reasoning: 'Borderline match — meets minimum requirements but limited depth. Shortlisted with low confidence.',
      status: 'SHORTLISTED',
    },
  },
  {
    email: 'aarav.mehta@example.com',
    fullName: 'Aarav Mehta',
    gender: 'MALE',
    phone: '+91-9545678901',
    location: 'Gandhinagar, Gujarat',
    headline: 'React Developer',
    skills: ['React', 'JavaScript', 'HTML', 'CSS', 'REST API', 'Redux', 'Git'],
    university: 'Gujarat Technological University',
    college: 'Ganpat University',
    degree: 'B.Tech in Computer Engineering',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 8.0,
    resumeFileName: 'aarav_mehta_resume.pdf',
    resumeText: `AARAV MEHTA
React Developer
Email: aarav.mehta@example.com | Gandhinagar, Gujarat

SUMMARY
React developer with 2 years of experience in product-based companies. Strong fundamentals in
JavaScript, component design, and REST API integration.

SKILLS
React, JavaScript (ES6+), Redux, HTML5, CSS3, REST API, Git

EXPERIENCE
React Developer — Logicflow Software, Gandhinagar (Mar 2023 – Present, 2 years)
- Developed and maintained product features in React
- Managed application state with Redux; integrated multiple REST APIs
- Collaborated with backend team on API contracts

EDUCATION
B.Tech in Computer Engineering — Ganpat University, GTU (CPI: 8.0)`,
    parsedData: {
      name: 'Aarav Mehta',
      email: 'aarav.mehta@example.com',
      skills: ['React', 'JavaScript', 'Redux', 'HTML5', 'CSS3', 'REST API', 'Git'],
      experience: [{ company: 'Logicflow Software', role: 'React Developer', duration: '2 years' }],
      education: [{ degree: 'B.Tech', field: 'Computer Engineering' }],
      totalExperienceYears: 2,
    },
    screening: {
      overallScore: 80,
      skillMatchScore: 85,
      experienceMatchScore: 90,
      educationMatchScore: 90,
      matchedSkills: ['React', 'JavaScript', 'HTML', 'CSS', 'REST API', 'Redux', 'Git'],
      missingSkills: ['TypeScript'],
      strengths: ['2 years React experience in product company', 'Redux state management', 'Good API contract collaboration'],
      concerns: ['No TypeScript exposure'],
      reasoning: 'Good match covering all required and most preferred skills. Shortlisted.',
      status: 'SHORTLISTED',
    },
  },
  // REJECTED — 3 candidates with score < 45
  {
    email: 'harsh.patel@example.com',
    fullName: 'Harsh Patel',
    gender: 'MALE',
    phone: '+91-9601122334',
    location: 'Ahmedabad, Gujarat',
    headline: 'Web Developer (jQuery/PHP)',
    skills: ['PHP', 'jQuery', 'HTML', 'CSS', 'MySQL'],
    university: 'Gujarat University',
    college: 'KC Science College (BCA Wing)',
    degree: 'BCA',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 6.5,
    resumeFileName: 'harsh_patel_resume.pdf',
    resumeText: `HARSH PATEL
Web Developer
Email: harsh.patel@example.com | Ahmedabad, Gujarat

SKILLS
PHP, jQuery, HTML, CSS, MySQL, Bootstrap, AJAX

EXPERIENCE
Web Developer — LocalHost IT Solutions, Ahmedabad (2 years)
- Built PHP/MySQL websites and admin panels
- Used jQuery for DOM manipulation and AJAX calls

EDUCATION
BCA — KC Science College, Gujarat University (CGPA: 6.5)`,
    parsedData: {
      name: 'Harsh Patel',
      email: 'harsh.patel@example.com',
      skills: ['PHP', 'jQuery', 'HTML', 'CSS', 'MySQL', 'Bootstrap'],
      experience: [{ company: 'LocalHost IT Solutions', role: 'Web Developer', duration: '2 years' }],
      education: [{ degree: 'BCA', field: 'Computer Applications' }],
      totalExperienceYears: 2,
    },
    screening: {
      overallScore: 18,
      skillMatchScore: 10,
      experienceMatchScore: 30,
      educationMatchScore: 40,
      matchedSkills: ['HTML', 'CSS'],
      missingSkills: ['React', 'JavaScript (ES6+)', 'REST API', 'Redux', 'TypeScript'],
      strengths: ['Some web development experience'],
      concerns: ['No React experience whatsoever', 'PHP/jQuery stack — completely different from required React/JS', 'No REST API integration in a modern sense'],
      reasoning: 'Not a match for this role. The candidate has zero React or modern JavaScript framework experience. The required skills are simply absent.',
      status: 'REJECTED',
    },
  },
  {
    email: 'sneha.joshi@example.com',
    fullName: 'Sneha Joshi',
    gender: 'FEMALE',
    phone: '+91-9870012345',
    location: 'Surat, Gujarat',
    headline: 'Python/Django Developer',
    skills: ['Python', 'Django', 'HTML', 'CSS', 'PostgreSQL', 'REST API'],
    university: 'Veer Narmad South Gujarat University',
    college: 'S.V.N.I.T. (Sardar Vallabhbhai National Institute of Technology)',
    degree: 'B.Tech in Computer Engineering',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 8.4,
    resumeFileName: 'sneha_joshi_resume.pdf',
    resumeText: `SNEHA JOSHI
Python/Django Developer
Email: sneha.joshi@example.com | Surat, Gujarat

SUMMARY
Backend developer with 2 years specialising in Python/Django REST APIs.
Minimal frontend experience — primarily builds API backends.

SKILLS
Python, Django, Django REST Framework, PostgreSQL, HTML (basic), CSS (basic)

EXPERIENCE
Backend Developer — DataLoom, Surat (Jun 2023 – Present, 2 years)
- Built REST APIs in Django for a SaaS HR product
- Designed database schemas in PostgreSQL

EDUCATION
B.Tech in Computer Engineering — SVNIT, VNSG University (CPI: 8.4)`,
    parsedData: {
      name: 'Sneha Joshi',
      email: 'sneha.joshi@example.com',
      skills: ['Python', 'Django', 'PostgreSQL', 'HTML', 'CSS', 'REST API'],
      experience: [{ company: 'DataLoom', role: 'Backend Developer', duration: '2 years' }],
      education: [{ degree: 'B.Tech', field: 'Computer Engineering' }],
      totalExperienceYears: 2,
    },
    screening: {
      overallScore: 28,
      skillMatchScore: 15,
      experienceMatchScore: 35,
      educationMatchScore: 90,
      matchedSkills: ['HTML', 'CSS', 'REST API'],
      missingSkills: ['React', 'JavaScript (ES6+)', 'Redux', 'TypeScript'],
      strengths: ['Strong educational background', 'REST API experience (backend)', 'Good PostgreSQL skills'],
      concerns: ['No React or frontend JavaScript experience', 'Backend/Python specialist — this is a frontend React role', 'Only basic HTML/CSS skills mentioned'],
      reasoning: 'Strong backend engineer but completely wrong stack for this role. No React or frontend JavaScript experience at a production level.',
      status: 'REJECTED',
    },
  },
  {
    email: 'meera.pillai@example.com',
    fullName: 'Meera Pillai',
    gender: 'FEMALE',
    phone: '+91-9922334455',
    location: 'Gandhinagar, Gujarat',
    headline: 'Android / Java Developer',
    skills: ['Java', 'Kotlin', 'Android', 'Spring Boot', 'MySQL', 'Git'],
    university: 'Gujarat Technological University',
    college: 'Government Engineering College',
    degree: 'B.Tech in Computer Engineering',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 8.9,
    resumeFileName: 'meera_pillai_resume.pdf',
    resumeText: `MEERA PILLAI
Android Developer
Email: meera.pillai@example.com | Gandhinagar, Gujarat

SUMMARY
Android/Java developer with 2 years of mobile app development experience.
Primarily an Android/backend engineer; no production React/JS frontend experience.

SKILLS
Java, Kotlin, Android SDK, Spring Boot, MySQL, Data Structures & Algorithms, Git

EXPERIENCE
Android Developer — MobileWave Apps, Gandhinagar (2 years)
- Built Android applications in Kotlin/MVVM architecture
- Developed Spring Boot REST APIs for app backends

EDUCATION
B.Tech in Computer Engineering — Government Engineering College, GTU (CPI: 8.9)`,
    parsedData: {
      name: 'Meera Pillai',
      email: 'meera.pillai@example.com',
      skills: ['Java', 'Kotlin', 'Android', 'Spring Boot', 'MySQL', 'Git'],
      experience: [{ company: 'MobileWave Apps', role: 'Android Developer', duration: '2 years' }],
      education: [{ degree: 'B.Tech', field: 'Computer Engineering' }],
      totalExperienceYears: 2,
    },
    screening: {
      overallScore: 22,
      skillMatchScore: 5,
      experienceMatchScore: 25,
      educationMatchScore: 90,
      matchedSkills: [],
      missingSkills: ['React', 'JavaScript', 'HTML', 'CSS', 'REST API (frontend)'],
      strengths: ['Strong CS fundamentals', 'Excellent academic record', 'Backend API experience'],
      concerns: ['Zero React or JavaScript frontend experience', 'Android/Java developer — completely different domain', 'No web frontend skills whatsoever'],
      reasoning: 'Very strong engineer but entirely the wrong domain. Android/Java developer applying for a React.js role — not a match.',
      status: 'REJECTED',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Interview data for 3 candidates (Priya=Very Poor, Ridham=Good, Riya=Medium)
// (Abbreviated from seed-demo-interviews.js — just enough to create the records)
// ─────────────────────────────────────────────────────────────────────────────

const INTERVIEW_CANDIDATES = [
  {
    email: 'priya.sharma@example.com',
    firstName: 'Priya',
    report: {
      overallScore: 38,
      technicalScore: 20,
      communicationScore: 55,
      strengths: ['Shows up on time', 'Polite and professional demeanor'],
      areasForImprovement: [
        'Cannot explain React hooks she claims to use daily',
        'Cannot define Redux or describe its data flow',
        'Consistently deflects technical questions onto unnamed seniors',
        'No understanding of REST API integration in React',
      ],
      reasoning: 'Despite a strong resume, the interview revealed a significant gap between claimed and actual technical ability. The candidate could not explain fundamental React concepts she listed as core skills.',
    },
  },
  {
    email: 'ridham.patel@example.com',
    firstName: 'Ridham',
    report: {
      overallScore: 84,
      technicalScore: 88,
      communicationScore: 79,
      strengths: [
        'Clearly understands hooks migration challenges and state management',
        'Articulates Redux data flow accurately',
        'Demonstrates real production problem-solving',
        'Strong TypeScript and Node.js knowledge',
      ],
      areasForImprovement: [
        'Could improve clarity when explaining complex async patterns',
        'Could expand on testing practices',
      ],
      reasoning: 'Excellent interview performance matching his strong resume. Technical knowledge is solid and clearly earned through real production work. Recommended for hire.',
    },
  },
  {
    email: 'riya.mehta@example.com',
    firstName: 'Riya',
    report: {
      overallScore: 64,
      technicalScore: 60,
      communicationScore: 68,
      strengths: [
        'Understands basic React patterns and component lifecycle',
        'Has practical REST API integration experience',
        'Good Redux fundamentals',
      ],
      areasForImprovement: [
        'Limited TypeScript exposure',
        'Could deepen understanding of performance optimisation',
        'Some answers lack production-depth — more project experience would help',
      ],
      reasoning: 'Solid mid-level candidate with genuine React skills. Not as strong as top candidates but demonstrates real ability. Suitable for the role with some mentoring.',
    },
  },
];

const AI_CONFIG = {
  aiName: 'Aria',
  aiTitle: 'Virtual HR',
  questionCount: 8,
  answerTimeSeconds: 30,
  customQuestions: ['Why do you want to work with our team specifically?'],
  voiceGender: 'FEMALE',
  ttsVoiceId: null,
  difficultyStrategy: 'ADAPTIVE',
};

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== RecruitIQ Full Reset + Seed ===\n');

  // ── Step 1: Full truncation (leaf→root) ─────────────────────────────────

  console.log('Step 1: Truncating all tables...');
  // Delete in dependency order to avoid FK violations
  await prisma.interviewEvent.deleteMany({});
  await prisma.interviewAnswer.deleteMany({});
  await prisma.interviewReport.deleteMany({});
  await prisma.interviewQuestion.deleteMany({});
  await prisma.interview.deleteMany({});
  await prisma.interviewSlot.deleteMany({});
  await prisma.aiInterviewConfig.deleteMany({});
  await prisma.screeningResult.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.emailLog.deleteMany({});
  await prisma.resume.deleteMany({});
  await prisma.resumeBlob.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.company.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('  ✓ All tables cleared\n');

  // ── Step 2: Create company ───────────────────────────────────────────────

  console.log('Step 2: Creating company...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const companyUser = await prisma.user.create({
    data: {
      email: COMPANY_EMAIL,
      passwordHash,
      role: 'COMPANY',
      company: {
        create: {
          name: 'Ravantra Tech',
          location: 'Ahmedabad, Gujarat, India',
          industry: 'Software Services',
          description: 'Demo company for testing RecruitIQ AI candidate screening.',
        },
      },
    },
    include: { company: true },
  });
  console.log(`  ✓ Company: Ravantra Tech (${COMPANY_EMAIL})\n`);

  // ── Step 3: Create job ───────────────────────────────────────────────────

  console.log('Step 3: Creating job...');
  const job = await prisma.job.create({
    data: {
      companyId: companyUser.company.id,
      createdBy: companyUser.id,
      title: 'React.js Developer',
      description: `Ravantra Tech is hiring a React.js Developer to join our Ahmedabad-based product
engineering team. You'll build and maintain customer-facing dashboards, integrate REST APIs, and work
closely with design and backend teams to ship features end-to-end.

Responsibilities:
- Build responsive, accessible UI components in React
- Integrate and consume REST APIs
- Manage application state (Redux or equivalent)
- Write clean, testable, maintainable JavaScript/TypeScript
- Collaborate with backend engineers on API contracts
- Participate in code reviews and technical planning

Requirements:
- Solid hands-on experience with React and modern JavaScript (ES6+)
- Experience integrating REST APIs in production applications
- Familiarity with HTML5, CSS3, and responsive design
- Comfortable with Git-based workflows

Nice to have:
- Redux or another state management library
- TypeScript
- Basic Node.js backend exposure`,
      minimumExperience: 1,
      maximumExperience: 4,
      requiredSkills: ['React', 'JavaScript', 'HTML', 'CSS', 'REST API'],
      preferredSkills: ['Redux', 'TypeScript', 'Node.js', 'Git'],
      educationRequirements: ['Computer Science', 'Information Technology', 'Computer Engineering'],
      location: 'Ahmedabad, Gujarat, India',
      employmentType: 'FULL_TIME',
      workMode: 'On-site',
      openings: 3,
      jobLevel: 'Mid',
      noticePeriod: '30 days',
      languagesRequired: ['English', 'Hindi'],
      certifications: ['AWS Certified Cloud Practitioner'],
      salaryRange: '₹6–10 LPA',
      status: 'OPEN',
      structuredRequirements: {
        requiredSkills: ['React', 'JavaScript', 'HTML', 'CSS', 'REST API'],
        preferredSkills: ['Redux', 'TypeScript', 'Node.js', 'Git'],
        minimumExperience: 1,
        maximumExperience: 4,
        education: ['Computer Science', 'Information Technology', 'Computer Engineering'],
        summary: 'React.js Developer building customer-facing dashboards and REST-API-driven features.',
      },
    },
  });
  console.log(`  ✓ Job: React.js Developer (${job.id})\n`);

  // ── Step 4: Create candidates + resumes + applications + screening ───────

  console.log('Step 4: Creating 10 candidates with applications and screening results...\n');

  const candidateMap = {}; // email → { user, candidate, resume, application }
  const now = new Date();
  const screenedAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

  for (const c of CANDIDATES) {
    const user = await prisma.user.create({
      data: {
        email: c.email,
        passwordHash,
        role: 'CANDIDATE',
        candidate: {
          create: {
            fullName: c.fullName,
            phone: c.phone,
            location: c.location,
            headline: c.headline,
            skills: c.skills,
            gender: c.gender,
            university: c.university,
            college: c.college,
            degree: c.degree,
            academicStatus: c.academicStatus,
            currentSemester: c.currentSemester,
            latestSpi: c.latestSpi,
          },
        },
      },
      include: { candidate: true },
    });

    const resume = await prisma.resume.create({
      data: {
        candidateId: user.candidate.id,
        fileName: c.resumeFileName,
        fileType: 'application/pdf',
        fileSize: Buffer.byteLength(c.resumeText, 'utf-8'),
        storageKey: `seed/${user.candidate.id}/${c.resumeFileName}`,
        storageUrl: null,
        rawText: c.resumeText,
        parsedData: c.parsedData,
        isPrimary: true,
      },
    });

    // Map screening status to application status
    const appStatus = c.screening.status === 'REJECTED' ? 'REJECTED' : 'SHORTLISTED';

    const application = await prisma.application.create({
      data: {
        candidateId: user.candidate.id,
        jobId: job.id,
        resumeId: resume.id,
        status: appStatus,
      },
    });

    await prisma.screeningResult.create({
      data: {
        applicationId: application.id,
        status: c.screening.status === 'REJECTED' ? 'COMPLETED' : 'COMPLETED',
        overallScore: c.screening.overallScore,
        skillMatchScore: c.screening.skillMatchScore,
        experienceMatchScore: c.screening.experienceMatchScore,
        educationMatchScore: c.screening.educationMatchScore,
        matchedSkills: c.screening.matchedSkills,
        missingSkills: c.screening.missingSkills,
        strengths: c.screening.strengths,
        concerns: c.screening.concerns,
        reasoning: c.screening.reasoning,
        aiModel: DEMO_MODEL_TAG,
        screenedAt,
      },
    });

    candidateMap[c.email] = { user, candidate: user.candidate, resume, application };

    const icon = c.screening.status === 'REJECTED' ? '✗' : '✓';
    console.log(`  ${icon} ${c.fullName.padEnd(20)} score=${c.screening.overallScore} → ${appStatus}`);
  }

  const shortlisted = CANDIDATES.filter((c) => c.screening.status === 'SHORTLISTED');
  const rejected = CANDIDATES.filter((c) => c.screening.status === 'REJECTED');
  console.log(`\n  Summary: ${shortlisted.length} shortlisted, ${rejected.length} rejected\n`);

  // ── Step 5: AI interview config ──────────────────────────────────────────

  console.log('Step 5: Creating AI interview config...');
  await prisma.aiInterviewConfig.create({
    data: { jobId: job.id, ...AI_CONFIG },
  });
  console.log(`  ✓ AI Interviewer: ${AI_CONFIG.aiName} — ${AI_CONFIG.aiTitle}\n`);

  // ── Step 6: Completed interviews for Priya, Ridham, Riya ────────────────

  console.log('Step 6: Creating 3 completed demo interviews...');

  const slotStarts = [
    new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
    new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
  ];

  for (let i = 0; i < INTERVIEW_CANDIDATES.length; i++) {
    const ic = INTERVIEW_CANDIDATES[i];
    const slotStart = slotStarts[i];
    const duration = 20 * 60 * 1000; // 20 minutes
    const endedAt = new Date(slotStart.getTime() + duration);

    const { application } = candidateMap[ic.email];

    // Create a past slot (BOOKED since it's now completed)
    const slot = await prisma.interviewSlot.create({
      data: {
        jobId: job.id,
        startTime: slotStart,
        endTime: endedAt,
        status: 'BOOKED',
      },
    });

    const interview = await prisma.interview.create({
      data: {
        applicationId: application.id,
        slotId: slot.id,
        status: 'COMPLETED',
        stage: 'END',
        startedAt: slotStart,
        endedAt,
        liveKitRoomName: `demo-room-${ic.firstName.toLowerCase()}-${Date.now()}`,
      },
    });

    // Create a few minimal questions + answers
    const questionTexts = [
      { stage: 'INTRODUCTION', type: 'INTRODUCTION', text: `Hi ${ic.firstName}, I'm ${AI_CONFIG.aiName}. Could you briefly introduce yourself?`, difficulty: null },
      { stage: 'RESUME_QUESTIONS', type: 'RESUME_BASED', text: 'Walk me through your most impactful React project.', difficulty: 'MEDIUM' },
      { stage: 'BASIC_TECHNICAL', type: 'TECHNICAL', text: 'Explain how useState and useEffect work together.', difficulty: 'MEDIUM' },
      { stage: 'JOB_SPECIFIC', type: 'JOB_SPECIFIC', text: 'How would you manage global state across a large React app?', difficulty: 'MEDIUM' },
    ];

    for (let qi = 0; qi < questionTexts.length; qi++) {
      const qt = questionTexts[qi];
      const q = await prisma.interviewQuestion.create({
        data: {
          interviewId: interview.id,
          index: qi,
          stage: qt.stage,
          type: qt.type,
          text: qt.text,
          difficulty: qt.difficulty,
          answerTimeLimitSeconds: AI_CONFIG.answerTimeSeconds,
          askedAt: new Date(slotStart.getTime() + (qi + 1) * 3 * 60 * 1000),
        },
      });

      await prisma.interviewAnswer.create({
        data: {
          questionId: q.id,
          transcript: `[Demo answer from ${ic.firstName} — see full interview report]`,
          rawTranscript: `[Demo answer from ${ic.firstName}]`,
          normalizedTranscript: `[Demo answer from ${ic.firstName}]`,
          durationSeconds: 25,
          answeredAt: new Date(q.askedAt.getTime() + 30 * 1000),
        },
      });
    }

    await prisma.interviewReport.create({
      data: {
        interviewId: interview.id,
        status: 'COMPLETED',
        overallScore: ic.report.overallScore,
        technicalScore: ic.report.technicalScore,
        communicationScore: ic.report.communicationScore,
        strengths: ic.report.strengths,
        areasForImprovement: ic.report.areasForImprovement,
        reasoning: ic.report.reasoning,
        aiModel: DEMO_MODEL_TAG,
        generatedAt: endedAt,
      },
    });

    // Interview events
    const events = [
      { type: 'INTERVIEW_STARTED', occurredAt: slotStart },
      { type: 'CAMERA_ON', occurredAt: new Date(slotStart.getTime() + 5 * 1000) },
      { type: 'MIC_ON', occurredAt: new Date(slotStart.getTime() + 8 * 1000) },
      { type: 'INTERVIEW_ENDED', occurredAt: endedAt },
    ];

    await prisma.interviewEvent.createMany({
      data: events.map((e) => ({ interviewId: interview.id, type: e.type, occurredAt: e.occurredAt })),
    });

    await prisma.application.update({
      where: { id: application.id },
      data: { status: 'INTERVIEW_COMPLETED' },
    });

    console.log(`  ✓ ${ic.firstName.padEnd(10)} overall=${ic.report.overallScore} — interview completed`);
  }
  console.log('');

  // ── Step 7: Future slots for shortlisted candidates (excluding the 3 who ─
  //            already have completed interviews)                            ─
  console.log('Step 7: Creating future interview slots...');

  const interviewedEmails = new Set(INTERVIEW_CANDIDATES.map((ic) => ic.email));
  const shortlistedNotInterviewed = shortlisted.filter((c) => !interviewedEmails.has(c.email));

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  // Create slots spread over the next 7 days (one per candidate, morning slots)
  for (let i = 0; i < shortlistedNotInterviewed.length; i++) {
    const slotDate = new Date(tomorrow.getTime() + i * 24 * 60 * 60 * 1000);
    slotDate.setHours(10, 0, 0, 0); // 10:00 AM
    const slotEnd = new Date(slotDate.getTime() + 30 * 60 * 1000); // 30 minutes

    await prisma.interviewSlot.create({
      data: {
        jobId: job.id,
        startTime: slotDate,
        endTime: slotEnd,
        status: 'AVAILABLE',
      },
    });

    const c = shortlistedNotInterviewed[i];
    console.log(`  ✓ Slot for ${c.fullName}: ${slotDate.toDateString()} 10:00–10:30`);
  }
  console.log('');

  // ── Done ─────────────────────────────────────────────────────────────────

  console.log('=== Seed Complete ===\n');
  console.log('─── Login credentials (all use same password) ───');
  console.log(`Password:  ${DEMO_PASSWORD}`);
  console.log(`\nCompany:`);
  console.log(`  ${COMPANY_EMAIL}`);
  console.log(`\nCandidates:`);
  for (const c of CANDIDATES) {
    const status = c.screening.status;
    const score = c.screening.overallScore;
    console.log(`  ${c.email.padEnd(35)} ${c.fullName.padEnd(20)} score=${String(score).padEnd(3)} ${status}`);
  }
  console.log('\nAll done! Start the app and log in as the company to see the data.');
}

main()
  .catch((err) => {
    console.error('\n❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
