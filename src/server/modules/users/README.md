# users

The `User` model (Section 6) is the shared identity table behind both
`Company` and `Candidate` profiles. Its lifecycle (create/authenticate) is
owned by the `auth` module (`../auth/auth.service.js`); profile-specific
reads/writes live in `../companies` and `../candidates`. This module is kept
as a placeholder for future cross-role user administration (e.g. an ADMIN
role managing all users) rather than duplicating that logic.
