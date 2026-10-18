const auth = await getAuthContext(request, env);
if (!auth || !auth.userId) return { success: false, error: 'Sign in before sending an invitation.' };
const emails = Array.isArray(payload.emails) ? payload.emails : [];
if (emails.length < 1 || emails.length > 5) return { success: false, error: 'Enter between one and five email addresses.' };
const clean = [...new Set(emails.map((value) => typeof value === 'string' ? value.trim().toLowerCase() : '').filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))];
if (clean.length !== emails.length) return { success: false, error: 'One or more email addresses are invalid or duplicated.' };
const message = typeof payload.message === 'string' ? payload.message.trim().slice(0, 3000) : '';
const results = await Promise.all(clean.map(async (email) => {
  try {
    const sent = await sendEmail(env).send({
      from: 'noreply@mail.overskill.app',
      to: email,
      subject: 'A family invitation to try ChoreReward',
      text: (message || 'Our family uses ChoreReward to organize chores and celebrate progress.') + '\n\nOpen ChoreReward: https://chorerewards.overskill.app/'
    });
    return { accepted: !!(sent && sent.accepted) };
  } catch (error) {
    return { accepted: false, error: error instanceof Error ? error.message : 'Email sending failed.' };
  }
}));
const accepted = results.filter((result) => result.accepted).length;
return { success: accepted > 0, accepted, failed: results.length - accepted, error: accepted === 0 ? 'No invitation emails were accepted for sending.' : undefined };