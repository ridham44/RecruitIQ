# RecruitIQ — Demo logins and data

Demo dataset for the **RecQ agency-link flow**, created by `node scripts/seed-recq-demo.mjs`
(also `node scripts/seed-demo.mjs`). Everything is fictional and every account is on a
non-routable `.demo` domain — no real inbox receives anything.

- **Password for every account:** the `DEMO_PASSWORD` value used when the seed ran. It is not
  written here on purpose — the set includes a **Portal Admin**. Use a strong `DEMO_PASSWORD` on
  any shared or live database, never the default.
- **Sign in:** `/auth/login`. There is **no sign-up** — agencies are added by the Portal Admin.
- **Live product:** `https://recruitiq-eta.vercel.app` · local: `http://localhost:5173`
- Overview of every role and link: **`/live-demo`** (shows the password only when `DEMO_PAGE=true`).

---

## Accounts

| Role | Email | Lands on | Notes |
| --- | --- | --- | --- |
| Portal Admin | `admin@platform.demo` | `/admin/companies` | Adds / suspends agencies, sees all users |
| Agency owner — **Nexora Talent Partners** | `owner@nexora.demo` | `/company/dashboard` | All jobs, companies, recruiters |
| Agency recruiter — Ritika Bansal | `recruiter@nexora.demo` | `/company/dashboard` | Assigned to MERN, Backend, React + client Finlytics (so also sees AI/ML); not the Data Analyst job |
| Company HR — Kunal Shah, **Finlytics Software Pvt Ltd** | `hr@finlytics.demo` | `/client/candidates` | Sees only candidates submitted to them |
| Second agency — **Brightline Staffing** | `owner@brightline.demo` | `/company/dashboard` | Isolation check: never sees Nexora data |

Recruiter permissions: view candidates, review candidates, configure interviews, manage jobs,
submit candidates.

Candidates have **no login** — they use the `/recq` links below.

---

## Candidate links (no login)

| Link | Shows |
| --- | --- |
| `/recq/nexora` | Nexora's 5 open roles + "Not sure which role fits?" resume discovery |
| `/recq/nexora/mern-stack-developer` | One job: upload resume → match → email code → interview |
| `/recq/nexora/backend-nodejs-developer` | Backend Node.js Developer |
| `/recq/nexora/react-developer` | React Developer |
| `/recq/nexora/ai-ml-engineer` | AI/ML Engineer |
| `/recq/nexora/data-analyst-intern` | Data Analyst Intern — interview window opens in 3 days |
| `/recq/nexora/php-laravel-developer` | **Closed** → "no longer accepting applications" |
| `/recq/nexora/qa-automation-engineer` | **Closed** |
| `/recq/brightline` | Brightline's 2 jobs only |
| `/recq/brightline/mern-stack-developer` | Wrong agency + job → rejected |
| `/careers/nexora` | Old careers link → redirects to `/recq/nexora` |

Sample resumes to upload: `/sample-resumes/Kavya_Reddy_FullStack_Resume.docx` (strong, matches
several roles) and `/sample-resumes/Aditya_Rao_Resume.docx` (customer support — stops at the match).
The verification code goes to the email on the resume; with email in console mode (demo) the
verification screen shows a dev code outside production, and the server log prints it.

---

## Jobs — Nexora Talent Partners

| Job | Location · type | Experience | Min. resume match | AI interviewer | Questions · answer time | Interview window | Final threshold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MERN Stack Developer | Pune · Full-time · Hybrid | 2–5 yrs | 65% | Ananya, Senior Technical Recruiter | 6 · 90 s | opened 8 days ago → +14 days | 70 (client: Finlytics) |
| Backend Node.js Developer | Bengaluru · Full-time · On-site | 3–6 yrs | 65% | Vikram, Engineering Manager | 6 · 120 s | none (link valid 7 days) | 70 (client: Finlytics) |
| React Developer | Remote · Contract | 1–3 yrs | 60% | Priya, Virtual HR | 5 · 60 s | opened 8 days ago → +7 days | none (recruiter decides) |
| AI/ML Engineer | Hyderabad · Full-time · Hybrid | 2–5 yrs | 70% | Kavya, ML Lead | 7 · 120 s | opened 8 days ago → +10 days | 75 (client: Finlytics) |
| Data Analyst Intern | Ahmedabad · Internship · On-site | 0–1 yr | 55% | Priya, Campus Recruiter | 4 · 60 s | **opens in 3 days** → +10 days | none |
| PHP Laravel Developer | Pune | — | — | — | — | — | **CLOSED** |
| QA Automation Engineer | Pune | — | — | — | — | — | **CLOSED** |

Every job has its own custom questions, interview instructions, evaluation criteria and focus
skills (Interviews tab). Final score = CV match × 30% + interview × 70%.

Brightline Staffing: **Java Spring Boot Developer** (Chennai) and **DevOps Engineer** (Gurugram).

---

## Candidates (seeded through the real flow)

Each one uploaded a resume → AI match → verified the resume email → applied. The four completed
interviews were run through the real AI interview engine; their dates are spread over the past week.

| Candidate | Email | Applied to | Resume match | Interview | Final | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Priya Sharma | `priya.sharma@mail.demo` | MERN Stack Developer *(via discovery)* | 91 | Completed · 92 | 91.7 | **Submitted to Company HR** (selected) |
| | | React Developer *(same upload)* | 63 | Pending | — | Interview scheduled |
| Arjun Verma | `arjun.verma@mail.demo` | Backend Node.js Developer | 100 | Completed · 90 | 93 | **Qualified** |
| Sneha Kulkarni | `sneha.kulkarni@mail.demo` | React Developer | 82 | Completed · 68 | 72.2 | Interview completed — needs review |
| Karan Malhotra | `karan.malhotra@mail.demo` | Backend Node.js Developer | 76 | Completed · 20 (tab-switch flag) | 36.8 | **Rejected** |
| Fatima Sheikh | `fatima.sheikh@mail.demo` | MERN *(discovery)* + Backend | 90 · 79 | Pending (2 interviews) | — | Interview scheduled |
| Ananya Iyer | `ananya.iyer@mail.demo` | AI/ML Engineer | 100 | Pending | — | Interview scheduled |
| Meera Nair | `meera.nair@mail.demo` | React Developer | 90 | Pending | — | Interview scheduled |
| Rahul Deshmukh | `rahul.deshmukh@mail.demo` | MERN Stack Developer | 84 | Pending | — | Interview scheduled |
| Ishita Banerjee | `ishita.banerjee@mail.demo` | React Developer | 81 | Pending | — | Interview scheduled |
| Vikram Joshi | `vikram.joshi@mail.demo` | MERN Stack Developer | 78 | Pending | — | Interview scheduled |
| Rohit Patil | `rohit.patil@mail.demo` | Data Analyst Intern | 66 | **Not available yet** (window opens in 3 days) | — | Interview scheduled |
| Neha Gupta | `neha.gupta@mail.demo` | Brightline · Java Spring Boot Developer | 84 | Pending | — | Interview scheduled |
| Siddharth Menon | `siddharth.menon@mail.demo` | Brightline · DevOps Engineer | 92 | Pending | — | Interview scheduled |

Match scores come from the AI each time the seed runs, so a re-seed can differ by a few points.

**Live-demo candidate (not seeded):** Kavya Reddy, `kavya.reddy@mail.demo` — upload
`Kavya_Reddy_FullStack_Resume.docx` on `/recq/nexora` → "Find my matches" → MERN, Backend and
React are eligible → one interview link per role.

---

## Recreate the data

```bash
node scripts/seed-recq-demo.mjs --reset   # removes only the .demo demo set, then recreates it (~7 min)
```

The seed refuses a non-local `DATABASE_URL` unless `--yes` is given — use that only for a dedicated
demo database, and back it up first (`node scripts/backup-db.mjs before-demo`). `--reset` also
removes the earlier demo set on the `@recruitiq.demo` domain.
