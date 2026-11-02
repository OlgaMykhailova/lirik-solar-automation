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
   `npm run set-webhook -- https://<проєкт>.vercel.app/`

## Розробка
`npm test` — тести, `npm run typecheck` — типи, `npm run sample` — тестові .docx у `out/`.

## Доставка документів: Google Диск
Прямі завантаження файлів у Telegram для цього бота зависають (504), тому `.docx` кладеться в папку на Google Диску, а в чат приходять кнопки «Відкрити» / «Завантажити». Посилання відкриваються лише для тих, кому дано доступ до папки. Без змінних `GOOGLE_*` бот використовує запасну доставку (тимчасове публічне посилання на 15 хвилин).

Налаштування (сервісний акаунт):
1. Google Cloud Console: проєкт з увімкненим **Google Drive API**, сервісний акаунт і його **JSON-ключ** (можна використати вже наявний).
2. На Диску створіть папку. Дайте доступ **Редактор** адресі сервісного акаунта (`…@….iam.gserviceaccount.com`) і потрібним поштам співробітників.
3. ID папки: відкрийте її, це останній фрагмент адреси `https://drive.google.com/drive/folders/<ID>`.
4. У Vercel → Environment Variables: `GOOGLE_SERVICE_ACCOUNT_JSON` (увесь вміст JSON-файлу) і `GOOGLE_DRIVE_FOLDER_ID`. Потім Redeploy.
