# LIBRA: SMS + deployment

## 1. Apply the code changes (on your PC, in the libra-backend folder)
1. Copy everything from this bundle into libra-backend (keep the same folder layout).
2. `node apply-patches.mjs libra-patches-2.json`
3. `npm install` then `npm run dev`  (this now builds public/tw.css first, so the Tailwind CDN is gone)
4. Dev SMS still prints in the terminal. To test a real provider, put SMS_PROVIDER + keys in .env.

## 2. Africa's Talking (recommended for Kenya)
1. Create an account, make an app, copy the API key and your username.
2. Sandbox first: AT_SANDBOX=true, AT_USERNAME=sandbox, and test with the Simulator numbers in their dashboard.
3. Live: AT_SANDBOX=false, your real username + key, top up airtime, and request a Sender ID (AT_SENDER_ID) if you want "LIBRA" as the sender.

## 3. Deploy on a VPS (Ubuntu, 1 vCPU / 1-2 GB is plenty)
1. Install Docker: `curl -fsSL https://get.docker.com | sh`
2. Point a DNS A record (e.g. chat.yourdomain.com) at the server's public IP.
3. Open the firewall: 22, 80, 443 (tcp+udp), 3478 (tcp+udp), 49160-49200 (udp).
4. Copy the project to the server (git clone or scp), then: `cp .env.production.example .env` and fill it in.
   TURN_SECRET and JWT_SECRET must be long random strings (`openssl rand -hex 32`).
5. `docker compose up -d --build`
6. Open https://chat.yourdomain.com. HTTPS is automatic, so install-to-home-screen, push and calls now work on phones.
7. Logs: `docker compose logs -f app`

Uploads live in the `uploads` Docker volume. Back it up, or move to S3-compatible storage before you have many users.
