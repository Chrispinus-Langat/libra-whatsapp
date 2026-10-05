// Run from the libra-backend folder:  node test-sms.mjs +254700000001
import 'dotenv/config';
import { sendSms } from './src/sms.js';

const to = process.argv[2];
if (!to) { console.log('Usage: node test-sms.mjs +254700000001'); process.exit(1); }
const e = process.env;
console.log('Provider :', e.SMS_PROVIDER || '(not set -> console)');
console.log('Username :', e.AT_USERNAME || '(missing)');
console.log('Key      :', e.AT_API_KEY ? `set (${e.AT_API_KEY.length} characters, starts ${e.AT_API_KEY.slice(0, 4)}...)` : '(missing)');
console.log('Sandbox  :', e.AT_SANDBOX || '(not set -> LIVE)');
console.log('Sender ID:', e.AT_SENDER_ID || '(blank)');
// Step 1: check the username + key pair on their own (no SMS is sent, no airtime used)
try {
  const sandbox = e.AT_SANDBOX === 'true';
  const r = await fetch(`https://api.${sandbox ? 'sandbox.' : ''}africastalking.com/version1/user?username=${encodeURIComponent(e.AT_USERNAME || '')}`,
    { headers: { apiKey: e.AT_API_KEY || '', Accept: 'application/json' } });
  const t = await r.text();
  console.log('\nLogin check:', r.ok ? 'OK - this username and key belong together' : `REJECTED (${r.status}) ${t.slice(0, 120)}`);
  if (r.ok) console.log('Account    :', t.slice(0, 200));
  if (!r.ok) { console.log('\nFix the username/key first, the SMS cannot work until this says OK.'); process.exit(1); }
} catch (err) { console.log('Login check failed:', err.message); }

// Step 2: send the SMS
try {
  await sendSms(to, 'LIBRA test message');
  console.log('\nOK: Africa\'s Talking accepted the message. Check the simulator (sandbox) or your phone (live).');
} catch (err) {
  console.log('\nFAILED:', err.message);
}
