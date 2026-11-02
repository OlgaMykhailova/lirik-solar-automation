import "dotenv/config";

const token = process.env.BOT_TOKEN;
const secret = process.env.WEBHOOK_SECRET;
const url = process.argv[2];
if (!token || !secret || !url) {
  console.error("Використання: BOT_TOKEN і WEBHOOK_SECRET у .env, URL аргументом:\n  npm run set-webhook -- https://<проєкт>.vercel.app/");
  process.exit(1);
}
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message", "callback_query"], drop_pending_updates: true }),
});
console.log(await res.json());
