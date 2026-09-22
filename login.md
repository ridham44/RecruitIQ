# RecruitIQ Demo Login Credentials

All accounts use the same password: **`Demo@1234`**

---

## Company Account

| Field    | Value                          |
|----------|-------------------------------|
| Email    | `company@ravantratech.demo`   |
| Password | `Demo@1234`                   |
| Company  | Ravantra Tech                 |
| Role     | COMPANY                        |

**Login redirects to → `/company/dashboard`**

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
