# LIBRA v2 update

Copy these into your libra-backend folder (same layout):
  src/extras.js   public/v2.js   public/v2.css   public/admin.html   apply-patches.mjs   libra-patches-5.json

Then, in the libra-backend folder:
  node apply-patches.mjs libra-patches-5.json
  (optional) add  ADMIN_PHONES=+254700000000  to .env  to use /admin.html
  restart  npm run dev  and hard-refresh the page (Ctrl+Shift+R)

The server creates its new tables and columns by itself on startup.
