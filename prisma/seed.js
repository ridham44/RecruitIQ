// Demo/test data for exercising the AI screening pipeline end-to-end.
//
// Deliberately does NOT call OpenRouter: seed data must be reproducible
// (same output every run, no API key required, no cost) so `npm run
// db:seed` works for anyone cloning the repo. Resume text and parsedData
// below are hand-authored to be realistic and internally consistent with
// each other — the actual AI screening/ranking still runs for real when the
// demo company clicks "Run AI Screening" in the app, which is the point of
// this dataset.
//
// Gender is collected as profile/demo data ONLY. It is never read by the
// screening pipeline (see src/server/ai/candidate-matcher.service.js) —
// this seed exists specifically to test that the AI ranks candidates on
// qualifications alone, regardless of the gender distribution below.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Demo@1234';

const COMPANY_EMAIL = 'company@ravantratech.demo';

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
integrating REST APIs, and managing complex UI state with Redux. Comfortable owning a feature
end-to-end from design handoff to deployment.

SKILLS
React, JavaScript (ES6+), Redux, Redux Toolkit, TypeScript, REST API integration, HTML5, CSS3,
Git, Jest, React Testing Library, Webpack basics

EXPERIENCE
Frontend Developer — Tech Nova Solutions, Ahmedabad (Jan 2023 – Present, 2.5 years)
- Built and maintained a multi-tenant admin dashboard in React + TypeScript used by 40+ enterprise clients
- Integrated REST APIs for billing, user management, and analytics modules
- Migrated a large class-component codebase to functional components + hooks
- Introduced Jest + React Testing Library, raising test coverage from 12% to 61%
- Managed global app state with Redux Toolkit, cutting prop-drilling related bugs significantly

PROJECTS
E-commerce Admin Panel — React, Redux Toolkit, TypeScript, REST API
Real-time Chat Application — React, Socket.io, Node.js

EDUCATION
B.Tech in Computer Science and Technology — Institute of Technology, Nirma University (CPI: 8.7)

CERTIFICATIONS
Meta Front-End Developer Professional Certificate`,
    parsedData: {
      name: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      phone: '+91-9820011122',
      skills: ['React', 'JavaScript', 'Redux', 'Redux Toolkit', 'TypeScript', 'REST API', 'HTML5', 'CSS3', 'Git', 'Jest', 'React Testing Library'],
      experience: [
        { company: 'Tech Nova Solutions', role: 'Frontend Developer', duration: 'Jan 2023 - Present (2.5 years)' },
      ],
      education: [{ degree: 'B.Tech', field: 'Computer Science and Technology' }],
      projects: ['E-commerce Admin Panel (React, Redux Toolkit, TypeScript, REST API)', 'Real-time Chat Application (React, Socket.io, Node.js)'],
      certifications: ['Meta Front-End Developer Professional Certificate'],
      totalExperienceYears: 2.5,
      university: 'Nirma University',
      college: 'Institute of Technology, Nirma University',
      degree: 'B.Tech in Computer Science and Technology',
      spi: 8.7,
      gender: '',
    },
  },
  {
    email: 'ananya.iyer@example.com',
    fullName: 'Ananya Iyer',
    gender: 'FEMALE',
    phone: '+91-9825566778',
    location: 'Ahmedabad, Gujarat',
    headline: 'React Developer',
    skills: ['React', 'JavaScript', 'REST API', 'Node.js', 'MongoDB', 'Git', 'HTML', 'CSS'],
    university: 'Gujarat University',
    college: "St. Xavier's College",
    degree: 'BCA (Bachelor of Computer Applications)',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 7.9,
    resumeFileName: 'ananya_iyer_resume.pdf',
    resumeText: `Ananya Iyer
ananya.iyer@example.com | +91-9825566778 | Ahmedabad

I'm a web developer who has spent the last 3 years at PixelForge Web Studio building things people
actually use. Started out doing mostly WordPress and jQuery fixes, moved fully into React about two
years ago and haven't looked back.

WHAT I'VE BUILT
At PixelForge I built a portfolio-builder SaaS product from scratch using React on the frontend,
talking to a Node.js + Express backend, with MongoDB for storage — users can drag-and-drop sections,
preview live, and publish to a subdomain. I also handled most of the REST API integration work for
our bigger client dashboards (auth flows, paginated data tables, file uploads).

Before that I built an inventory management system for a local retail chain — again React on top,
Node/Express REST API underneath, with role-based views for staff vs. managers.

I'm comfortable across the stack but my strength is really the React side — component architecture,
performance (I've profiled and fixed a few gnarly re-render issues), and making sure the UI doesn't
fall apart when the API is slow or returns something unexpected.

TECH I USE REGULARLY: React, JavaScript, Node.js, Express, MongoDB, REST APIs, Git, HTML/CSS

EDUCATION
BCA (Bachelor of Computer Applications) — St. Xavier's College, Gujarat University, CGPA 7.9

CERTIFICATIONS
freeCodeCamp — Front End Development Libraries`,
    parsedData: {
      name: 'Ananya Iyer',
      email: 'ananya.iyer@example.com',
      phone: '+91-9825566778',
      skills: ['React', 'JavaScript', 'Node.js', 'Express', 'MongoDB', 'REST API', 'Git', 'HTML', 'CSS'],
      experience: [
        { company: 'PixelForge Web Studio', role: 'Web/React Developer', duration: '3 years' },
      ],
      education: [{ degree: 'BCA', field: 'Computer Applications' }],
      projects: ['Portfolio-builder SaaS (React, Node.js, Express, MongoDB)', 'Inventory management system (React, Node/Express REST API)'],
      certifications: ['freeCodeCamp - Front End Development Libraries'],
      totalExperienceYears: 3,
      university: 'Gujarat University',
      college: "St. Xavier's College",
      degree: 'BCA (Bachelor of Computer Applications)',
      spi: 7.9,
      gender: '',
    },
  },
  {
    email: 'ridham.patel@example.com',
    fullName: 'Ridham Patel',
    gender: 'MALE',
    phone: '+91-9898123456',
    location: 'Ahmedabad, Gujarat',
    headline: 'Junior Web Developer',
    skills: ['React', 'JavaScript', 'HTML', 'CSS', 'Git'],
    university: 'Gujarat Technological University',
    college: 'LJ Institute of Engineering & Technology',
    degree: 'B.Tech in Information Technology',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 7.4,
    resumeFileName: 'ridham_patel_resume.pdf',
    resumeText: `Ridham Patel
Junior Web Developer
ridham.patel@example.com | +91-9898123456 | Ahmedabad, Gujarat

Objective: Web developer with hands-on React experience looking to grow into a stronger frontend role.

Skills: React, JavaScript, HTML, CSS, Git, basic REST API integration, responsive design

Experience:
Junior Web Developer, CodeCraft Studio (1 year 2 months)
- Built reusable React components for internal company websites
- Integrated a few third-party REST APIs (weather, maps) into client projects
- Fixed bugs and did minor feature work on an existing React codebase
- Worked with a senior developer to learn state management basics

Projects:
- Personal blog site built with React
- To-do list app using React and browser local storage

Education:
B.Tech in Information Technology, LJ Institute of Engineering & Technology (GTU), CPI: 7.4

Certifications: None currently`,
    parsedData: {
      name: 'Ridham Patel',
      email: 'ridham.patel@example.com',
      phone: '+91-9898123456',
      skills: ['React', 'JavaScript', 'HTML', 'CSS', 'Git'],
      experience: [{ company: 'CodeCraft Studio', role: 'Junior Web Developer', duration: '1 year 2 months' }],
      education: [{ degree: 'B.Tech', field: 'Information Technology' }],
      projects: ['Personal blog site (React)', 'To-do list app (React, local storage)'],
      certifications: [],
      totalExperienceYears: 1.2,
      university: 'Gujarat Technological University',
      college: 'LJ Institute of Engineering & Technology',
      degree: 'B.Tech in Information Technology',
      spi: 7.4,
      gender: '',
    },
  },
  {
    email: 'sneha.verma@example.com',
    fullName: 'Sneha Verma',
    gender: 'FEMALE',
    phone: '+91-9812233445',
    location: 'Ahmedabad, Gujarat',
    headline: 'Marketing Associate',
    skills: ['MS Excel', 'Communication', 'Market Research', 'HTML'],
    university: 'Gujarat University',
    college: 'K.S. School of Business Management',
    degree: 'MBA (Marketing)',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 8.5,
    resumeFileName: 'sneha_verma_resume.pdf',
    resumeText: `SNEHA VERMA
MBA (Marketing) | Marketing Associate
Email: sneha.verma@example.com | Phone: +91-9812233445 | Ahmedabad, Gujarat

PROFESSIONAL SUMMARY
Results-driven marketing professional with an MBA in Marketing and 1.5 years of experience in
retail marketing, market research, and campaign coordination. Strong communicator with a knack for
translating customer insights into actionable strategy. Currently exploring opportunities to expand
into digital/technical marketing roles.

WORK EXPERIENCE
Marketing Associate — Bright Retail Co (1.5 years)
- Coordinated seasonal marketing campaigns across 12 retail outlets
- Conducted market research surveys and competitor analysis
- Managed social media content calendar
- Basic exposure to the company website CMS; picked up a little HTML and JavaScript to make small
  edits to landing pages, though this is not a core skill area

EDUCATION
MBA (Marketing) — K.S. School of Business Management, Gujarat University, CGPA 8.5

SKILLS
MS Excel, Market Research, Communication, Presentation, basic HTML, a little JavaScript

CERTIFICATIONS
Google Digital Marketing Certificate`,
    parsedData: {
      name: 'Sneha Verma',
      email: 'sneha.verma@example.com',
      phone: '+91-9812233445',
      skills: ['MS Excel', 'Market Research', 'Communication', 'Presentation', 'HTML', 'JavaScript'],
      experience: [{ company: 'Bright Retail Co', role: 'Marketing Associate', duration: '1.5 years' }],
      education: [{ degree: 'MBA', field: 'Marketing' }],
      projects: [],
      certifications: ['Google Digital Marketing Certificate'],
      totalExperienceYears: 1.5,
      university: 'Gujarat University',
      college: 'K.S. School of Business Management',
      degree: 'MBA (Marketing)',
      spi: 8.5,
      gender: '',
    },
  },
  {
    email: 'kavya.nair@example.com',
    fullName: 'Kavya Nair',
    gender: 'FEMALE',
    phone: '+91-9876011223',
    location: 'Ahmedabad, Gujarat',
    headline: 'React Developer',
    skills: ['React', 'JavaScript', 'Redux', 'REST API', 'Git', 'HTML5', 'CSS3', 'Bootstrap'],
    university: null,
    college: 'Government Polytechnic, Ahmedabad',
    degree: 'Diploma in Computer Engineering',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 7.6,
    resumeFileName: 'kavya_nair_resume.pdf',
    resumeText: `KAVYA NAIR
React Developer — 3 years experience
kavya.nair@example.com | +91-9876011223

EXPERIENCE
WebSprint Technologies — React Developer (3 years)
Led the migration of a legacy jQuery application to React, cutting page load time by 40%. Built
multiple REST-API-driven admin dashboards from scratch. Owned the frontend architecture for two
major client products. Deep hands-on experience with React, Redux, and REST API integration daily.

PROJECTS
- Hospital Management System frontend — React, Redux, REST API
- Real Estate Listing Platform — React, REST API, Bootstrap
- Chrome extension for productivity tracking — JavaScript, React

SKILLS
React, JavaScript (ES6+), Redux, REST API, Git, HTML5, CSS3, Bootstrap

EDUCATION
Diploma in Computer Engineering — Government Polytechnic, Ahmedabad, SPI: 7.6

CERTIFICATIONS
Udemy — "React: The Complete Guide"`,
    parsedData: {
      name: 'Kavya Nair',
      email: 'kavya.nair@example.com',
      phone: '+91-9876011223',
      skills: ['React', 'JavaScript', 'Redux', 'REST API', 'Git', 'HTML5', 'CSS3', 'Bootstrap'],
      experience: [{ company: 'WebSprint Technologies', role: 'React Developer', duration: '3 years' }],
      education: [{ degree: 'Diploma', field: 'Computer Engineering' }],
      projects: [
        'Hospital Management System frontend (React, Redux, REST API)',
        'Real Estate Listing Platform (React, REST API, Bootstrap)',
        'Chrome extension for productivity tracking (JavaScript, React)',
      ],
      certifications: ['Udemy - "React: The Complete Guide"'],
      totalExperienceYears: 3,
      university: '',
      college: 'Government Polytechnic, Ahmedabad',
      degree: 'Diploma in Computer Engineering',
      spi: 7.6,
      gender: '',
    },
  },
  {
    email: 'riya.mehta@example.com',
    fullName: 'Riya Mehta',
    gender: 'FEMALE',
    phone: '+91-9909887766',
    location: 'Ahmedabad, Gujarat',
    headline: 'B.Tech Student (CSE)',
    skills: ['C', 'C++', 'DBMS', 'Operating Systems', 'HTML'],
    university: 'Nirma University',
    college: 'Institute of Technology, Nirma University',
    degree: 'B.Tech in Computer Science and Technology',
    academicStatus: 'ONGOING',
    currentSemester: 8,
    latestSpi: 9.1,
    resumeFileName: 'riya_mehta_resume.pdf',
    resumeText: `RIYA MEHTA
B.Tech Computer Science and Technology (Final Year)
riya.mehta@example.com | +91-9909887766 | Ahmedabad

EDUCATION
B.Tech in Computer Science and Technology — Institute of Technology, Nirma University
Currently in 8th Semester | SPI: 9.1 (highest in cohort)
Relevant Coursework: Data Structures & Algorithms, Database Management Systems, Operating Systems,
Computer Networks, Software Engineering, Theory of Computation

ACADEMIC PROJECTS
- Library Management System (Java Swing desktop application, MySQL backend) — college mini-project
- DBMS coursework project: Normalized relational schema design and query optimization for a college
  ERP system (SQL only, no frontend)

TECHNICAL SKILLS
C, C++, Java (academic), SQL, DBMS concepts, Operating Systems concepts, basic HTML, "have read about
JavaScript basics but haven't built anything with it yet"

ACHIEVEMENTS
- Consistent top-5 rank in department across all semesters
- NPTEL certification: Data Structures and Algorithms (Elite + Silver)

Note: Actively looking to build practical web development experience; strong CS fundamentals from
coursework but limited hands-on project experience outside the classroom.`,
    parsedData: {
      name: 'Riya Mehta',
      email: 'riya.mehta@example.com',
      phone: '+91-9909887766',
      skills: ['C', 'C++', 'Java', 'SQL', 'DBMS', 'Operating Systems', 'HTML'],
      experience: [],
      education: [{ degree: 'B.Tech', field: 'Computer Science and Technology' }],
      projects: ['Library Management System (Java Swing, MySQL)', 'DBMS coursework project (SQL schema design)'],
      certifications: ['NPTEL - Data Structures and Algorithms (Elite + Silver)'],
      totalExperienceYears: 0,
      university: 'Nirma University',
      college: 'Institute of Technology, Nirma University',
      degree: 'B.Tech in Computer Science and Technology',
      spi: 9.1,
      gender: '',
    },
  },
  {
    email: 'ishaan.kapoor@example.com',
    fullName: 'Ishaan Kapoor',
    gender: 'MALE',
    phone: '+91-9723344556',
    location: 'Ahmedabad, Gujarat',
    headline: 'Frontend Developer (Fresher)',
    skills: ['React', 'JavaScript', 'Redux', 'TypeScript', 'REST API', 'HTML', 'CSS', 'Git'],
    university: 'Gujarat Technological University',
    college: 'Silver Oak College of Engineering & Technology',
    degree: 'B.Tech in Computer Engineering',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 8.0,
    resumeFileName: 'ishaan_kapoor_resume.pdf',
    resumeText: `ISHAAN KAPOOR
Aspiring Frontend Developer | React Enthusiast
ishaan.kapoor@example.com | +91-9723344556 | Ahmedabad, Gujarat
GitHub: github.com/ishaankapoor-dev (sample)

ABOUT ME
Recent Computer Engineering graduate who taught myself modern frontend development by building real
projects. Comfortable with React, Redux, and TypeScript, and I integrate REST APIs in almost
everything I build. Looking for my first full-time React role.

INTERNSHIP
Frontend Intern, small startup (3 months)
- Built a React admin panel screen with Redux for state management
- Worked with the team's existing REST API to display and filter data tables

PROJECTS (the bulk of my hands-on experience)
- Netflix Clone — React, TMDB REST API, responsive design
- Kanban Board App — React, Redux, drag-and-drop, TypeScript
- Weather Dashboard — React, REST API (OpenWeather), geolocation
All three are deployed and linked on my GitHub with clean, componentized code.

SKILLS
React, JavaScript, Redux, TypeScript, REST API integration, HTML, CSS, Git

EDUCATION
B.Tech in Computer Engineering — Silver Oak College of Engineering & Technology (GTU), CPI: 8.0
(Graduated 5 months ago)

CERTIFICATIONS
Coursera — "Front-End Web Development with React" (The Hong Kong University of Science and Technology)`,
    parsedData: {
      name: 'Ishaan Kapoor',
      email: 'ishaan.kapoor@example.com',
      phone: '+91-9723344556',
      skills: ['React', 'JavaScript', 'Redux', 'TypeScript', 'REST API', 'HTML', 'CSS', 'Git'],
      experience: [{ company: 'Startup (Internship)', role: 'Frontend Intern', duration: '3 months' }],
      education: [{ degree: 'B.Tech', field: 'Computer Engineering' }],
      projects: [
        'Netflix Clone (React, TMDB REST API)',
        'Kanban Board App (React, Redux, TypeScript, drag-and-drop)',
        'Weather Dashboard (React, REST API)',
      ],
      certifications: ['Coursera - "Front-End Web Development with React" (HKUST)'],
      totalExperienceYears: 0.25,
      university: 'Gujarat Technological University',
      college: 'Silver Oak College of Engineering & Technology',
      degree: 'B.Tech in Computer Engineering',
      spi: 8.0,
      gender: '',
    },
  },
  {
    email: 'karan.desai@example.com',
    fullName: 'Karan Desai',
    gender: 'MALE',
    phone: '+91-9601122334',
    location: 'Ahmedabad, Gujarat',
    headline: 'Backend Developer',
    skills: ['Node.js', 'Express', 'MongoDB', 'PostgreSQL', 'REST API', 'Docker', 'HTML', 'CSS'],
    university: 'Gujarat Technological University',
    college: 'L.D. College of Engineering',
    degree: 'B.Tech in Computer Engineering',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 8.2,
    resumeFileName: 'karan_desai_resume.pdf',
    resumeText: `Karan Desai
Backend Developer
karan.desai@example.com | +91-9601122334 | Ahmedabad

EXPERIENCE
Backend Developer, DataForge Systems (2 years)
- Designed and built REST APIs and microservices using Node.js and Express
- Modeled data in both MongoDB and PostgreSQL depending on service needs
- Containerized services with Docker and set up CI pipelines
- Occasionally paired with the frontend team but have not owned frontend features myself

PROJECTS
- E-commerce backend API — Node.js, Express, MongoDB
- Authentication microservice — Node.js, JWT, PostgreSQL, Docker
- Small React dashboard prototype — built a basic read-only React screen to visualize API metrics for
  an internal demo (limited scope, first real attempt at React)

SKILLS
Node.js, Express, MongoDB, PostgreSQL, REST API design, Docker, HTML, CSS, some exposure to React

EDUCATION
B.Tech in Computer Engineering — L.D. College of Engineering (GTU), CPI: 8.2

CERTIFICATIONS
AWS Certified Cloud Practitioner`,
    parsedData: {
      name: 'Karan Desai',
      email: 'karan.desai@example.com',
      phone: '+91-9601122334',
      skills: ['Node.js', 'Express', 'MongoDB', 'PostgreSQL', 'REST API', 'Docker', 'HTML', 'CSS', 'React'],
      experience: [{ company: 'DataForge Systems', role: 'Backend Developer', duration: '2 years' }],
      education: [{ degree: 'B.Tech', field: 'Computer Engineering' }],
      projects: [
        'E-commerce backend API (Node.js, Express, MongoDB)',
        'Authentication microservice (Node.js, JWT, PostgreSQL, Docker)',
        'Small React dashboard prototype (limited scope)',
      ],
      certifications: ['AWS Certified Cloud Practitioner'],
      totalExperienceYears: 2,
      university: 'Gujarat Technological University',
      college: 'L.D. College of Engineering',
      degree: 'B.Tech in Computer Engineering',
      spi: 8.2,
      gender: '',
    },
  },
  {
    email: 'divya.joshi@example.com',
    fullName: 'Divya Joshi',
    gender: 'FEMALE',
    phone: '+91-9714455667',
    location: 'Ahmedabad, Gujarat',
    headline: 'Frontend Developer (Fresher)',
    skills: ['React', 'JavaScript', 'Redux', 'REST API', 'HTML', 'CSS', 'Tailwind CSS', 'Git', 'Firebase'],
    university: 'Gujarat Technological University',
    college: 'Vishwakarma Government Engineering College',
    degree: 'B.Tech in Information Technology',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 8.3,
    resumeFileName: 'divya_joshi_resume.pdf',
    resumeText: `DIVYA JOSHI
divya.joshi@example.com | +91-9714455667 | Ahmedabad, Gujarat

Hi! I'm a recent IT graduate who's passionate about building clean, usable React interfaces. I don't
have a full-time job yet, but I've poured that time into building three complete, deployed
applications instead of toy tutorials.

PROJECTS
🎓 EduSpark — Full e-learning platform
React + Firebase Authentication + Firestore. Students can enroll in courses, track progress, and
instructors can upload content. Deployed on Vercel, ~200 lines of custom hooks for auth state.

🍳 Recipe Finder
React + REST API (Spoonacular). Search, filter by dietary restriction, save favorites to
localStorage. Focused on accessibility (keyboard navigation, ARIA labels).

💰 Expense Tracker
React + Redux + Chart.js. Full CRUD, category-wise spending charts, CSV export. This is the project
I'm proudest of — it's the most "production-like" of the three.

All three are on GitHub with READMEs, live demo links, and reasonably clean commit history.

SKILLS: React, JavaScript (ES6+), Redux, REST API integration, HTML, CSS, Tailwind CSS, Firebase, Git

EXPERIENCE: None professional yet — see Projects above for hands-on work.

EDUCATION
B.Tech in Information Technology — Vishwakarma Government Engineering College (GTU), CPI: 8.3

CERTIFICATIONS
Meta React Native Specialization (Coursera)`,
    parsedData: {
      name: 'Divya Joshi',
      email: 'divya.joshi@example.com',
      phone: '+91-9714455667',
      skills: ['React', 'JavaScript', 'Redux', 'REST API', 'HTML', 'CSS', 'Tailwind CSS', 'Firebase', 'Git'],
      experience: [],
      education: [{ degree: 'B.Tech', field: 'Information Technology' }],
      projects: [
        'EduSpark e-learning platform (React, Firebase Auth, Firestore)',
        'Recipe Finder (React, REST API)',
        'Expense Tracker (React, Redux, Chart.js)',
      ],
      certifications: ['Meta React Native Specialization (Coursera)'],
      totalExperienceYears: 0,
      university: 'Gujarat Technological University',
      college: 'Vishwakarma Government Engineering College',
      degree: 'B.Tech in Information Technology',
      spi: 8.3,
      gender: '',
    },
  },
  {
    email: 'meera.pillai@example.com',
    fullName: 'Meera Pillai',
    gender: 'FEMALE',
    phone: '+91-9922334455',
    location: 'Ahmedabad, Gujarat',
    headline: 'Android Developer',
    skills: ['Java', 'Kotlin', 'Android', 'Spring Boot', 'MySQL', 'HTML'],
    university: 'Gujarat Technological University',
    college: 'Government Engineering College',
    degree: 'B.Tech in Computer Engineering',
    academicStatus: 'COMPLETED',
    currentSemester: null,
    latestSpi: 8.9,
    resumeFileName: 'meera_pillai_resume.pdf',
    resumeText: `MEERA PILLAI
Software Engineer — Android & Backend
meera.pillai@example.com | +91-9922334455 | Ahmedabad, Gujarat

ACADEMIC EXCELLENCE
B.Tech in Computer Engineering — Government Engineering College (GTU) — CPI: 8.9 (Department Gold
Medalist, 2nd Rank)

PROFESSIONAL EXPERIENCE
Android Developer — MobileWave Apps (2 years)
- Built and shipped 4 native Android applications using Kotlin, reaching 100K+ combined downloads
- Implemented MVVM architecture, Room database, and Retrofit for networking
- Led a small team of 2 junior developers on a fintech Android app

COMPETITIVE PROGRAMMING
Codeforces: Specialist rank (peak rating 1520+)
Solved 800+ problems across LeetCode and Codeforces. Regular participant in Smart India Hackathon and
inter-college coding competitions (2x finalist).

PROJECTS
- E-commerce Android App — Kotlin, MVVM, Room, Retrofit
- Spring Boot REST API — built for a college capstone project, Java + Spring Boot + MySQL
- Various DSA problem-solving repositories on GitHub

TECHNICAL SKILLS
Java, Kotlin, Android SDK, Spring Boot, MySQL, Data Structures & Algorithms, Git, basic HTML

CERTIFICATIONS
Oracle Certified Associate: Java SE 8 Programmer
Multiple Data Structures & Algorithms course certificates (Coursera, Udemy)

Note: Primarily an Android/backend engineer looking to explore new opportunities; has not built
production React or modern JavaScript frontend applications.`,
    parsedData: {
      name: 'Meera Pillai',
      email: 'meera.pillai@example.com',
      phone: '+91-9922334455',
      skills: ['Java', 'Kotlin', 'Android', 'Spring Boot', 'MySQL', 'Data Structures & Algorithms', 'Git', 'HTML'],
      experience: [{ company: 'MobileWave Apps', role: 'Android Developer', duration: '2 years' }],
      education: [{ degree: 'B.Tech', field: 'Computer Engineering' }],
      projects: ['E-commerce Android App (Kotlin, MVVM, Room, Retrofit)', 'Spring Boot REST API (Java, Spring Boot, MySQL)'],
      certifications: ['Oracle Certified Associate: Java SE 8 Programmer', 'Multiple DSA course certificates'],
      totalExperienceYears: 2,
      university: 'Gujarat Technological University',
      college: 'Government Engineering College',
      degree: 'B.Tech in Computer Engineering',
      spi: 8.9,
      gender: '',
    },
  },
];

async function main() {
  console.log('Seeding demo data for Ravantra Technologies...\n');

  // Idempotent: wipe any previous run's demo users first (cascades to
  // Company/Candidate/Job/Resume/Application/ScreeningResult via onDelete:
  // Cascade), so `npm run db:seed` can be re-run safely.
  const demoEmails = [COMPANY_EMAIL, ...CANDIDATES.map((c) => c.email)];
  await prisma.user.deleteMany({ where: { email: { in: demoEmails } } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const companyUser = await prisma.user.create({
    data: {
      email: COMPANY_EMAIL,
      passwordHash,
      role: 'COMPANY',
      company: {
        create: {
          name: 'Ravantra Technologies',
          location: 'Ahmedabad, Gujarat, India',
          industry: 'Software Services',
          description: 'Demo company for testing RecruitIQ AI candidate screening.',
        },
      },
    },
    include: { company: true },
  });
  console.log(`Created demo company: Ravantra Technologies (${COMPANY_EMAIL})`);

  const job = await prisma.job.create({
    data: {
      companyId: companyUser.company.id,
      createdBy: companyUser.id,
      title: 'React.js Developer',
      description: `Ravantra Technologies is hiring a React.js Developer to join our Ahmedabad-based product
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
- Basic Node.js backend exposure
- Prior experience in a product company environment

Education: Open to candidates from Computer Science, Information Technology, Computer Engineering,
or equivalent practical experience — degree background matters less than demonstrated React/JS
ability.`,
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
  console.log(`Created job: React.js Developer @ Ravantra Technologies (${job.id})\n`);

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

    await prisma.application.create({
      data: {
        candidateId: user.candidate.id,
        jobId: job.id,
        resumeId: resume.id,
        status: 'APPLIED',
      },
    });

    console.log(`  + ${c.fullName} (${c.gender}) — applied with resume ${resume.id}`);
  }

  console.log(`\nSeeded ${CANDIDATES.length} candidates and applications.`);
  console.log('\n--- Demo credentials (all use the same password) ---');
  console.log(`Password: ${DEMO_PASSWORD}`);
  console.log(`Company:  ${COMPANY_EMAIL}`);
  CANDIDATES.forEach((c) => console.log(`Candidate: ${c.email} (${c.fullName})`));
  console.log('\nLog in as the company, open the React.js Developer job, open its Applications tab,');
  console.log('and click "Run AI Screening" to rank all 10 candidates for real.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
