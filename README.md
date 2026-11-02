# lirik-solar-automation

Telegram-бот: генерує рахунок на оплату або видаткову накладну (.docx) для ФОП Несходовський / ФОП Дриженко.
Стек: TypeScript, grammY (вебхук), docx, Upstash Redis, Vercel.

## Нумерація
`ДД-ММ-N`, N щодня починається з 10 (1–9 вільні для ручних документів). Лічильник окремий для кожного ФОП і типу документа. Дата за Києвом.

## Налаштування
1. Створіть бота в @BotFather, отримайте токен.
2. Vercel: імпортуйте цей репозиторій, у Storage/Marketplace підключіть Upstash Redis.
3. Vercel → Settings → Environment Variables: `BOT_TOKEN`, `WEBHOOK_SECRET` (довільний довгий рядок), `ALLOWED_USER_IDS` (Telegram ID через кому). Змінні Redis додаються автоматично.
4. Після деплою зареєструйте вебхук (локально, `.env` за зразком `.env.example`):
   `npm run set-webhook -- https://<проєкт>.vercel.app/api/webhook`

## Розробка
`npm test` — тести, `npm run typecheck` — типи, `npm run sample` — тестові .docx у `out/`.
