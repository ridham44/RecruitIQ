// "Start here" demo page (/start) + scripts/seed-demo.mjs.
// Fixed demo accounts on the non-routable .demo domain, so no real inbox
// ever receives their emails. The password is never stored here: it comes
// from DEMO_PASSWORD on the server and is only shown while DEMO_PAGE is on.

export const DEMO_EMAIL_DOMAIN = 'recruitiq.demo';
export const DEMO_AGENCY_NAME = 'Demo Talent Agency';
export const DEMO_AGENCY_SLUG = 'demo-agency';
export const DEMO_COMPANY_NAME = 'Demo Software Pvt Ltd';
export const DEMO_JOB_TITLE = 'Frontend Developer (Demo)';

export const DEMO_ACCOUNTS = [
  {
    key: 'admin',
    role: 'ADMIN',
    label: 'Portal Admin',
    email: `admin@${DEMO_EMAIL_DOMAIN}`,
    fullName: 'Demo Portal Admin',
    canDo: ['Add and manage agencies', 'Suspend or reactivate an agency', 'See all users'],
  },
  {
    key: 'agency',
    role: 'COMPANY',
    label: 'Agency owner',
    email: `agency@${DEMO_EMAIL_DOMAIN}`,
    fullName: 'Demo Agency Owner',
    canDo: [
      'Post jobs and share the careers page',
      'AI screening, shortlist / reject',
      'Set up the AI interview, read reports',
      'Final score and Submit to company',
      'Manage companies, Company HR and agency recruiters',
    ],
  },
  {
    key: 'recruiter',
    role: 'RECRUITER',
    label: 'Agency recruiter',
    email: `recruiter@${DEMO_EMAIL_DOMAIN}`,
    fullName: 'Demo Recruiter',
    canDo: ['Works only on assigned jobs and companies', 'Only the permissions the agency owner ticked'],
  },
  {
    key: 'hr',
    role: 'CLIENT_HR',
    label: 'Company HR',
    email: `hr@${DEMO_EMAIL_DOMAIN}`,
    fullName: 'Demo Company HR',
    canDo: ['See candidates the agency sent', 'Scores, interview summary and CV (view only)'],
  },
  {
    key: 'candidate',
    role: 'CANDIDATE',
    label: 'Candidate',
    email: `candidate@${DEMO_EMAIL_DOMAIN}`,
    fullName: 'Demo Candidate',
    canDo: ['Profile and CV', 'Find jobs and apply', 'Track applications, take the AI interview'],
  },
];
