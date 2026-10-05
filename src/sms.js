// SMS delivery for login codes. Pick a provider with SMS_PROVIDER in .env:
//   console        - prints the message in the server terminal (development only)
//   africastalking - Africa's Talking (great coverage and prices in Kenya / East Africa)
//   twilio         - Twilio
const env = k => process.env[k];

async function postForm(url, body, headers = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10_000)
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 200)}`);
  return text;
}

const providers = {
  console: async (to, text) => {
    if (env('NODE_ENV') === 'production') throw new Error('SMS_PROVIDER is not configured');
    console.log(`[dev] SMS to ${to}: ${text}`);
  },

  africastalking: async (to, text) => {
    if (!env('AT_USERNAME') || !env('AT_API_KEY')) throw new Error('AT_USERNAME / AT_API_KEY missing');
    const host = env('AT_SANDBOX') === 'true' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com';
    const body = { username: env('AT_USERNAME'), to, message: text };
    if (env('AT_SENDER_ID')) body.from = env('AT_SENDER_ID');
    const res = JSON.parse(await postForm(`https://${host}/version1/messaging`, body, { apiKey: env('AT_API_KEY'), Accept: 'application/json' }));
    const r = res.SMSMessageData?.Recipients?.[0];
    if (!r || !/success/i.test(r.status)) throw new Error(`Africa's Talking: ${r?.status || res.SMSMessageData?.Message || 'no recipient'}`);
  },

  twilio: async (to, text) => {
    const sid = env('TWILIO_SID'), token = env('TWILIO_TOKEN');
    if (!sid || !token || !(env('TWILIO_FROM') || env('TWILIO_MESSAGING_SID'))) throw new Error('TWILIO_SID / TWILIO_TOKEN / TWILIO_FROM missing');
    const body = { To: to, Body: text };
    if (env('TWILIO_MESSAGING_SID')) body.MessagingServiceSid = env('TWILIO_MESSAGING_SID'); else body.From = env('TWILIO_FROM');
    await postForm(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, body,
      { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') });
  }
};

export async function sendSms(to, text) {
  const name = env('SMS_PROVIDER') || 'console';
  const send = providers[name];
  if (!send) throw new Error(`Unknown SMS_PROVIDER "${name}"`);
  await send(to, text);
}
