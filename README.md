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
Прямі завантаження файлів у Telegram для цього бота зависають (504), а сервісні акаунти Google не мають власного сховища на звичайному Диску. Тому `.docx` зберігає невеликий Google Apps Script від імені власника Диска ([apps-script/Code.gs](apps-script/Code.gs)), а в чат приходять кнопки «Відкрити» / «Завантажити». Файли бачать лише ті, кому дано доступ до папки. Без змінних `GOOGLE_SCRIPT_*` бот використовує запасну доставку (тимчасове посилання на 15 хвилин), а причину пише в підписі.

Налаштування:
1. На Диску створіть папку, поділіться нею з потрібними поштами. ID папки це частина адреси після `folders/`.
2. [script.google.com](https://script.google.com/) → **Новий проєкт** → вставте вміст `apps-script/Code.gs`, замініть `SECRET` (довгий випадковий рядок) і `FOLDER_ID`.
3. **Deploy → New deployment** → тип **Web app** → *Execute as*: **Me**, *Who has access*: **Anyone** → Deploy → дозвольте доступ до Диска → скопіюйте **Web app URL** (закінчується на `/exec`).
4. У Vercel додайте `GOOGLE_SCRIPT_URL` (цей URL) і `GOOGLE_SCRIPT_SECRET` (той самий секрет), зробіть Redeploy.
5. Після змін у скрипті потрібне нове розгортання: **Deploy → Manage deployments → ✎ → New version → Deploy**.
