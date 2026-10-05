# RecruitIQ Demo Login Credentials

All demo accounts use the same password: **`Demo@1234`** (except `ceo@nfs.com` — see below)

---

## Company Accounts

| Field    | Value                          |
|----------|-------------------------------|
| Email    | `company@ravantratech.demo`   |
| Password | `Demo@1234`                   |
| Company  | Ravantra Tech                 |
| Role     | COMPANY                        |

| Field    | Value                          |
|----------|-------------------------------|
| Email    | `company@redflextech.demo`    |
| Password | `Demo@1234`                   |
| Company  | Redflex Tech                  |
| Role     | COMPANY                        |
| Job      | Node.js Developer Intern      |

**Login redirects to → `/company/dashboard`**

---

## Redflex Tech — Node.js Developer Intern

All 6 candidates below (existing demo accounts, see Candidate Accounts table for their login emails) applied to this
job at Redflex Tech, in addition to their existing React.js Developer application at Ravantra Tech. Applications are
in **APPLIED** status (not yet screened) — screen them from the company dashboard to test that flow.

- Dev Solanki
- Arjun Shah
- Kavya Nair
- Riya Mehta
- Ridham Patel
- Priya Sharma

---

## Nfs Agency — Ferrari & McLaren

| Field    | Value                                   |
|----------|-----------------------------------------|
| Email    | `ceo@nfs.com`                           |
| Password | the password set when the agency was created (not `Demo@1234`) |
| Agency   | Nfs                                     |
| Role     | COMPANY (Agency owner)                  |

**Login redirects to → `/company/dashboard`**

Client companies and their Company HR (shown under **Companies** in the agency menu):

| Company | Department       | Company HR | HR email              |
|---------|------------------|------------|-----------------------|
| Ferrari | Scuderia Ferrari | Rachel     | `rachel@ferrari.com`  |
| McLaren | McLaren Racing   | Remsi      | `remsi@mclaren.com`   |

Company HR can only log in after the agency invites them to the portal (company page → Company HR →
**Invite to portal**) and they set a password from the invite link. With `FEATURE_CLIENT_PORTAL=true`
they land on `/client/candidates`.

### Jobs and applicants

4 open jobs, 6 applicants each — all in **APPLIED** status (not yet screened). Each job has strong,
medium and weak fits, so **Run AI Screening** gives a spread of scores. Every applicant has a profile,
education and a downloadable `.docx` CV.

All 24 fake candidates use password **`Demo@1234`** and log in at `/auth/login`. Their emails are on the
`@nfsdemo.example` domain (no real inbox).

**Ferrari — Full Stack Developer – Race Telemetry Platform** (3–7 yrs, Maranello, Hybrid)

| Name          | Email                              | Exp     | Background                     | Expected fit |
|---------------|------------------------------------|---------|--------------------------------|--------------|
| Luca Bianchi  | `luca.bianchi@nfsdemo.example`     | 5.5 yrs | React/Node/TS, WebSockets, AWS | Strong       |
| Aarav Shah    | `aarav.shah@nfsdemo.example`       | 4 yrs   | MERN + TypeScript, PostgreSQL  | Strong       |
| Sofia Romano  | `sofia.romano@nfsdemo.example`     | 3 yrs   | React + TS frontend            | Medium       |
| Neha Kulkarni | `neha.kulkarni@nfsdemo.example`    | 6 yrs   | Java Spring Boot + Angular     | Medium       |
| Marco Conti   | `marco.conti@nfsdemo.example`      | 1 yr    | Junior React                   | Weak         |
| Rohan Gupta   | `rohan.gupta@nfsdemo.example`      | 2.5 yrs | QA automation (Selenium)       | Weak         |

**Ferrari — Data Engineer – Performance Analytics** (2–6 yrs, Maranello, On-site)

| Name           | Email                              | Exp   | Background                      | Expected fit |
|----------------|------------------------------------|-------|---------------------------------|--------------|
| Giulia Ferraro | `giulia.ferraro@nfsdemo.example`   | 4 yrs | Spark, Kafka, AWS, Airflow, dbt | Strong       |
| Vikram Rao     | `vikram.rao@nfsdemo.example`       | 3 yrs | Python, Airflow, BigQuery (GCP) | Strong       |
| Elena Russo    | `elena.russo@nfsdemo.example`      | 2 yrs | Data analyst, SQL, Tableau      | Medium       |
| Arjun Menon    | `arjun.menon@nfsdemo.example`      | 5 yrs | Java backend + Kafka            | Medium       |
| Pooja Reddy    | `pooja.reddy@nfsdemo.example`      | 0 yrs | M.Sc Data Science graduate      | Weak         |
| Daniel Moretti | `daniel.moretti@nfsdemo.example`   | 3 yrs | Mechanical engineer, MATLAB     | Weak         |

**McLaren — Embedded Software Engineer – Vehicle Control Systems** (3–8 yrs, Woking, On-site)

| Name           | Email                              | Exp   | Background                         | Expected fit |
|----------------|------------------------------------|-------|------------------------------------|--------------|
| Oliver Hughes  | `oliver.hughes@nfsdemo.example`    | 6 yrs | Automotive AUTOSAR, CAN, ISO 26262 | Strong       |
| Siddharth Iyer | `siddharth.iyer@nfsdemo.example`   | 4 yrs | C/C++, FreeRTOS, CAN (EV, drones)  | Strong       |
| Emily Clarke   | `emily.clarke@nfsdemo.example`     | 3 yrs | IoT firmware, Zephyr RTOS          | Medium       |
| Thomas Wright  | `thomas.wright@nfsdemo.example`    | 7 yrs | C++/Qt desktop on Linux            | Medium       |
| Harsh Vora     | `harsh.vora@nfsdemo.example`       | 2 yrs | Simulink controls engineer         | Weak         |
| Ananya Das     | `ananya.das@nfsdemo.example`       | 0 yrs | ECE graduate, Arduino projects     | Weak         |

**McLaren — Frontend Developer – Fan Engagement App** (2–5 yrs, London, Hybrid)

| Name            | Email                              | Exp   | Background                         | Expected fit |
|-----------------|------------------------------------|-------|------------------------------------|--------------|
| Chloe Bennett   | `chloe.bennett@nfsdemo.example`    | 4 yrs | Next.js, TS, Tailwind, GraphQL     | Strong       |
| Kabir Malhotra  | `kabir.malhotra@nfsdemo.example`   | 3 yrs | React + TS, some Next.js           | Strong       |
| Isabella Turner | `isabella.turner@nfsdemo.example`  | 2 yrs | Vue.js / Nuxt                      | Medium       |
| Nikhil Jain     | `nikhil.jain@nfsdemo.example`      | 5 yrs | React Native mobile                | Medium       |
| Sam Wilson      | `sam.wilson@nfsdemo.example`       | 1 yr  | WordPress / PHP                    | Weak         |
| Tanvi Shah      | `tanvi.shah@nfsdemo.example`       | 3 yrs | UI/UX designer (Figma)             | Weak         |

"Expected fit" is how the CVs were written, not a stored score — the real score comes from AI screening.

To recreate this data: `node scripts/seed-nfs.mjs` (replaces only these 4 jobs and the
`@nfsdemo.example` candidates).

---

## Candidate Accounts

All candidates use password: `Demo@1234` and login at `/auth/login`.

| Name         | Email                            | Score | Status          | Interview            |
|--------------|----------------------------------|-------|-----------------|----------------------|
| Ridham Patel | `ridham.patel@example.com`       | 91    | SHORTLISTED     | COMPLETED (score 84) |
| Aarav Mehta  | `aarav.mehta@example.com`        | 80    | SHORTLISTED     | Slot available       |
| Riya Mehta   | `riya.mehta@example.com`         | 78    | SHORTLISTED     | COMPLETED (score 64) |
| Priya Sharma | `priya.sharma@example.com`       | 72    | SHORTLISTED     | COMPLETED (score 38) |
| Kavya Nair   | `kavya.nair@example.com`         | 70    | SHORTLISTED     | Slot available       |
| Arjun Shah   | `arjun.shah@example.com`         | 65    | SHORTLISTED     | Slot available       |
| Dev Solanki  | `dev.solanki@example.com`        | 57    | SHORTLISTED     | Slot available       |
| Meera Pillai | `meera.pillai@example.com`       | 22    | REJECTED        | —                    |
| Sneha Joshi  | `sneha.joshi@example.com`        | 28    | REJECTED        | —                    |
| Harsh Patel  | `harsh.patel@example.com`        | 18    | REJECTED        | —                    |

---

## Screening Summary

- Job: React.js Developer at Ravantra Tech
- Shortlisted: 7 (score >= 55)
- Rejected: 3 (score < 45) — Harsh Patel (PHP/jQuery), Sneha Joshi (Python/Django), Meera Pillai (Android/Java)

---

## Completed Interviews

| Candidate    | Overall | Technical | Communication | Verdict     |
|--------------|---------|-----------|---------------|-------------|
| Ridham Patel | 84      | 88        | 79            | Best        |
| Riya Mehta   | 64      | 60        | 68            | Medium      |
| Priya Sharma | 38      | 20        | 55            | Poor        |

View: Company Login → Jobs → React.js Developer → Interviews tab

---

## Future Slots

4 AVAILABLE slots across the next 4 days (10:00–10:30) for: Aarav Mehta, Kavya Nair, Arjun Shah, Dev Solanki.

---

## Auth Fix

- **Problem:** Stale/wrong-role JWTs caused "You do not have permission" on page refreshes.
- **Fix:** `api.js` now clears the stored token automatically on any 401/403 response.
- Security checks (authorize middleware) are unchanged.
