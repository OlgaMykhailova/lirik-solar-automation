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
Прямі завантаження файлів у Telegram для цього бота зависають (504), тому `.docx` кладеться на Google Диск власника, а в чат приходять кнопки «Відкрити» / «Завантажити». Файли бачать лише ті, кому дано доступ до папки. Без налаштувань Google бот використовує запасну доставку (тимчасове посилання на 15 хвилин), а причину пише в підписі до файлу.

Є два способи, `OAuth` має пріоритет:

### Спосіб 1. OAuth (без скрипта)
Бот сам створює папку «Рахунки та накладні» (доступ `drive.file`: бачить лише створені ним файли). Після першого документа поділіться цією папкою на Диску з потрібними поштами.
1. [Google Cloud Console](https://console.cloud.google.com/): проєкт → **APIs & Services → Library** → **Google Drive API** → Enable.
2. **Google Auth Platform → Branding**: *App name*, *User support email*, *Developer contact*, *Application home page* `https://<проєкт>.vercel.app/`, *Privacy policy link* `https://<проєкт>.vercel.app/privacy`. **Save**.
3. **Data Access → Add or remove scopes** → `https://www.googleapis.com/auth/drive.file` → Update → Save.
4. **Audience → External → Publish app** (*In production*; інакше токен діє лише 7 днів).
5. **Clients → Create client → Web application**, у *Authorized redirect URIs* додайте `https://developers.google.com/oauthplayground`. Збережіть Client ID і Client secret.
6. [OAuth Playground](https://developers.google.com/oauthplayground): шестірня → **Use your own OAuth credentials** → Client ID/secret → Step 1 введіть `https://www.googleapis.com/auth/drive.file` → Authorize APIs (акаунт, на Диску якого мають лежати файли) → Step 2 **Exchange authorization code for tokens** → скопіюйте **Refresh token**.
7. У Vercel додайте `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` і (за бажанням) `CONTACT_EMAIL` (показується на сторінці `/privacy`), потім Redeploy.

### Спосіб 2. Google Apps Script
Див. [apps-script/Code.gs](apps-script/Code.gs): розгортається від імені власника Диска, у Vercel потрібні `GOOGLE_SCRIPT_URL` і `GOOGLE_SCRIPT_SECRET`. Спрацює, лише якщо акаунт не блокує Apps Script.
