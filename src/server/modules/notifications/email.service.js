import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { emailDriver } from './drivers/index.js';

function layout(bodyHtml) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background:#2a4bd6;padding:20px 24px;">
                <span style="color:#ffffff;font-size:18px;font-weight:bold;">RecruitIQ</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function viewApplicationButton(applicationId) {
  const url = `${env.clientUrl}/candidate/applications/${applicationId}`;
  return `<p style="margin:24px 0;">
    <a href="${url}" style="background:#2a4bd6;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;display:inline-block;">
      View Application
    </a>
  </p>
  <p style="color:#64748b;font-size:12px;">If the button doesn't work, copy this link: ${url}</p>`;
}

// Every send attempt — success or failure — is written to EmailLog, so
// failures are visible/debuggable instead of silently disappearing. Never
// throws: a broken email provider must never fail the request (bulk
// status update, screening, booking) that triggered the notification.
async function sendAndLog({ to, subject, html, type, applicationId }) {
  try {
    await emailDriver.send({ to, subject, html });
    await prisma.emailLog.create({
      data: { applicationId, recipientEmail: to, type, subject, status: 'SENT' },
    });
  } catch (err) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, err.message);
    await prisma.emailLog
      .create({
        data: { applicationId, recipientEmail: to, type, subject, status: 'FAILED', errorMessage: err.message },
      })
      .catch(() => {});
  }
}

// application must include candidate.user, job, job.company.
export async function sendApplicationStatusEmail(application) {
  const to = application.candidate.user.email;
  const candidateName = application.candidate.fullName;
  const jobTitle = application.job.title;
  const companyName = application.job.company.name;

  if (application.status === 'SHORTLISTED') {
    const subject = `You've been shortlisted for ${jobTitle} at ${companyName}`;
    const html = layout(`
      <p>Hi ${candidateName},</p>
      <p>Good news — <strong>${companyName}</strong> has shortlisted your application for
      <strong>${jobTitle}</strong> and would like to move forward to the next stage.</p>
      <p>Log in to RecruitIQ to view your application and schedule your interview.</p>
      ${viewApplicationButton(application.id)}
      <p>— The RecruitIQ team</p>
    `);
    return sendAndLog({ to, subject, html, type: 'APPLICATION_SHORTLISTED', applicationId: application.id });
  }

  if (application.status === 'REJECTED') {
    const subject = `Update on your application for ${jobTitle}`;
    const html = layout(`
      <p>Hi ${candidateName},</p>
      <p>Thank you for applying for <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.
      After careful review, the status of your application has changed and the company will not be
      moving forward with it at this time.</p>
      <p>We appreciate the time you invested in your application and encourage you to apply to other
      roles that match your background.</p>
      ${viewApplicationButton(application.id)}
      <p>— The RecruitIQ team</p>
    `);
    return sendAndLog({ to, subject, html, type: 'APPLICATION_REJECTED', applicationId: application.id });
  }
}

// Build plan P1: invite for an account someone else created (admin-onboarded
// company owner). Not tied to an application, so applicationId stays null.
// Build plan P2: `asRecruiter` switches the wording for recruiter invites.
export async function sendAccountSetupEmail({ to, companyName: rawCompanyName, link, expiresInHours = 72, asRecruiter = false }) {
  // const subject = `Set up your RecruitIQ account for ${rawCompanyName}`;
  const subject = asRecruiter
    ? `You've been invited to join ${rawCompanyName} on RecruitIQ`
    : `Set up your RecruitIQ account for ${rawCompanyName}`;
  const companyName = String(rawCompanyName).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const intro = asRecruiter
    ? `<p><strong>${companyName}</strong> has invited you to join their team on RecruitIQ as a recruiter.
    Choose a password to start working on your assigned jobs.</p>`
    : `<p>A RecruitIQ account has been created for <strong>${companyName}</strong> with this email address.
    Choose a password to start posting jobs and screening candidates.</p>`;
  const html = layout(`
    <p>Hello,</p>
    ${intro}
    <p style="margin:24px 0;">
      <a href="${link}" style="background:#2a4bd6;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;display:inline-block;">
        Set your password
      </a>
    </p>
    <p style="color:#64748b;font-size:12px;">This link works once and expires in ${expiresInHours} hours.
    If the button doesn't work, copy this link: ${link}</p>
    <p>— The RecruitIQ team</p>
  `);
  return sendAndLog({ to, subject, html, type: 'ACCOUNT_SETUP', applicationId: null });
}

// Build plan P4: sent after a careers-portal apply. `link` is a set-password
// link for a new guest account, or null when the email already has an
// account (then the candidate is pointed at the login page instead).
export async function sendCandidateApplicationReceivedEmail({ to, fullName, companyName, jobTitle, link, trackUrl }) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const what = jobTitle ? `your application for <strong>${esc(jobTitle)}</strong>` : 'your CV';
  const subject = jobTitle ? `We received your application for ${jobTitle}` : `We received your CV — ${companyName}`;
  const loginUrl = `${env.clientUrl.split(',')[0].trim()}/auth/login`;
  const action = link
    ? `<p>Set a password to track your application and attend interviews from your RecruitIQ account.</p>
       <p style="margin:24px 0;">
         <a href="${link}" style="background:#2a4bd6;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;display:inline-block;">
           Set your password
         </a>
       </p>
       <p style="color:#64748b;font-size:12px;">This link works once and expires in 72 hours. If the button doesn't work, copy this link: ${link}</p>`
    : `<p>You already have a RecruitIQ account with this email — <a href="${loginUrl}">log in</a> to track it.</p>`;
  const html = layout(`
    <p>Hi ${esc(fullName)},</p>
    <p>Thanks — <strong>${esc(companyName)}</strong> has received ${what}. Our AI is reviewing it now.</p>
    ${trackUrl ? `<p>You can check the status any time: <a href="${trackUrl}">${trackUrl}</a></p>` : ''}
    ${action}
    <p>— The RecruitIQ team</p>
  `);
  return sendAndLog({ to, subject, html, type: 'ACCOUNT_SETUP', applicationId: null });
}

// application/interview/slot as returned by scheduling.service.js's bookSlot.
export async function sendInterviewConfirmationEmail({ application, slot }) {
  const to = application.candidate.user.email;
  const candidateName = application.candidate.fullName;
  const jobTitle = application.job.title;
  const companyName = application.job.company.name;

  const dateLabel = new Date(slot.startTime).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeLabel = `${new Date(slot.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${new Date(
    slot.endTime
  ).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

  const subject = `Interview scheduled: ${jobTitle} at ${companyName}`;
  const html = layout(`
    <p>Hi ${candidateName},</p>
    <p>Your interview for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> is confirmed.</p>
    <p style="background:#f1f5f9;border-radius:8px;padding:12px 16px;margin:16px 0;">
      <strong>Date:</strong> ${dateLabel}<br />
      <strong>Time:</strong> ${timeLabel}
    </p>
    ${viewApplicationButton(application.id)}
    <p>— The RecruitIQ team</p>
  `);
  return sendAndLog({ to, subject, html, type: 'INTERVIEW_CONFIRMATION', applicationId: application.id });
}
