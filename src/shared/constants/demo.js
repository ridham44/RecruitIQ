// Demo page (/live-demo) + the demo dataset (scripts/seed-recq-demo.mjs,
// also run by scripts/seed-demo.mjs). Build plan P9: the demo is the /recq
// agency-link flow. Fixed accounts on non-routable .demo domains, so no real
// inbox ever receives their emails. The password is never stored here: it
// comes from DEMO_PASSWORD on the server and is only shown while DEMO_PAGE is on.

export const DEMO_EMAIL_DOMAIN = 'nexora.demo';
export const DEMO_AGENCY_NAME = 'Nexora Talent Partners';
export const DEMO_AGENCY_SLUG = 'nexora';
export const DEMO_COMPANY_NAME = 'Finlytics Software Pvt Ltd';
export const DEMO_JOB_TITLE = 'MERN Stack Developer';
export const DEMO_JOB_SLUG = 'mern-stack-developer';
export const DEMO_CLOSED_JOB_SLUG = 'php-laravel-developer';
// A second agency, to show that agencies never see each other's jobs.
export const DEMO_AGENCY_B_NAME = 'Brightline Staffing';
export const DEMO_AGENCY_B_SLUG = 'brightline';
// Sample resumes served from /public/sample-resumes (fictional people).
export const DEMO_SAMPLE_RESUMES = [
  {
    file: 'Kavya_Reddy_FullStack_Resume.docx',
    title: 'Strong full-stack resume',
    description: 'Matches several roles — pick more than one and get one interview per role',
  },
  {
    file: 'Aditya_Rao_Resume.docx',
    title: 'Non-matching resume',
    description: 'Customer-support profile — the application stops at the resume match',
  },
];

export const DEMO_ACCOUNTS = [
  {
    key: 'admin',
    role: 'ADMIN',
    label: 'Portal Admin',
    email: 'admin@platform.demo',
    fullName: 'Portal Admin',
    canDo: ['Add and manage agencies', 'Suspend or reactivate an agency', 'See all users'],
  },
  {
    key: 'agency',
    role: 'COMPANY',
    label: 'Agency owner',
    email: 'owner@nexora.demo',
    fullName: 'Nexora Talent Partners',
    canDo: [
      'Post jobs and share the candidate links',
      'Set the AI interviewer, questions and interview window',
      'See applicants, interview reports and final scores',
      'Submit selected candidates to the company HR',
      'Manage companies, Company HR and agency recruiters',
    ],
  },
  {
    key: 'recruiter',
    role: 'RECRUITER',
    label: 'Agency recruiter',
    email: 'recruiter@nexora.demo',
    fullName: 'Ritika Bansal',
    canDo: ['Works only on assigned jobs and companies', 'Only the permissions the agency owner ticked'],
  },
  {
    key: 'hr',
    role: 'CLIENT_HR',
    label: 'Company HR',
    email: 'hr@finlytics.demo',
    fullName: 'Kunal Shah',
    canDo: ['See candidates the agency sent', 'Scores, interview summary and CV (view only)'],
  },
  {
    key: 'agencyB',
    role: 'COMPANY',
    label: 'Second agency',
    email: 'owner@brightline.demo',
    fullName: 'Brightline Staffing',
    canDo: ['A separate agency with its own jobs', 'Shows that agencies never see each other’s data'],
  },
];
