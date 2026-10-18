const auth = await getAuthContext(request, env);
if (!auth || !auth.userId) return { success: false, error: 'Sign in before sending a request.' };
const kind = payload.kind === 'feature' ? 'Feature request' : 'Support request';
const subject = typeof payload.subject === 'string' ? payload.subject.trim().slice(0, 120) : '';
const message = typeof payload.message === 'string' ? payload.message.trim() : '';
if (!subject || !message) return { success: false, error: 'Add a subject and message before sending.' };
if ([...message].length > 5000) return { success: false, error: 'The message must be 5,000 characters or fewer.' };
try {
  const result = await sendEmail(env).send({
    from: 'noreply@mail.overskill.app',
    to: 'support@flogenixai.com',
    subject: '[ChoreReward] ' + kind + ': ' + subject,
    text: kind + '\n\n' + message + '\n\nApp user ID: ' + auth.userId + '\nReceived at: ' + new Date().toISOString()
  });
  if (!result || !result.accepted) return { success: false, error: 'The email service did not accept this message. Please try again.' };
  return { success: true, accepted: true };
} catch (error) {
  return { success: false, error: error instanceof Error ? error.message : 'The message could not be sent.' };
}