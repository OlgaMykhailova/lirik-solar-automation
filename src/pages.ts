const NAME = "Lirik Solar Documents Bot";

const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>` +
      `<style>body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#222}h1{font-size:1.5rem}h2{font-size:1.1rem;margin-top:1.6rem}</style></head><body>${body}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );

export function homePage(): Response {
  return page(
    NAME,
    `<h1>${NAME}</h1>
<p>${NAME} is a private Telegram bot used by Lirik Solar to prepare payment invoices and delivery notes (Word documents) from product names, quantities, USD prices and an exchange rate.</p>
<p>Generated documents are saved to a Google Drive folder owned by the business, using Google Drive access limited to files created by the app. The bot is available only to a fixed list of authorised employees.</p>
<p><a href="/privacy">Privacy Policy</a></p>`,
  );
}

export function privacyPage(contactEmail?: string): Response {
  const contact = contactEmail ? `<p>Contact: <a href="mailto:${contactEmail}">${contactEmail}</a></p>` : "";
  return page(
    `${NAME}: Privacy Policy`,
    `<h1>Privacy Policy</h1>
<p>${NAME} (“the app”) is a private tool operated by Lirik Solar for its own staff. This policy explains what data the app handles.</p>
<h2>Data we process</h2>
<ul>
<li>Telegram user ID of authorised employees, used only to allow or deny access to the bot.</li>
<li>Document details entered into the bot: product names, quantities, prices and exchange rate.</li>
<li>Generated invoices and delivery notes (Word files).</li>
</ul>
<h2>Google user data</h2>
<p>The app requests only the Google Drive scope <code>drive.file</code>. It is used solely to create a folder and to save the generated documents in the Google Drive of the account owner who authorised the app. The app does not read, list or modify any other files in that Drive and does not access other Google data.</p>
<p>The app's use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
<h2>Storage and sharing</h2>
<p>Documents are stored in the owner's Google Drive and shared only with the people the owner chooses. Temporary session data and short-lived copies of documents are kept in a private database for up to 24 hours. We do not sell, rent or share personal data with third parties and do not use it for advertising.</p>
<h2>Retention and deletion</h2>
<p>The owner can delete any document from Google Drive at any time and can revoke the app's access at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</p>
<h2>Contact</h2>
<p>Questions about this policy can be sent to the contact address below.</p>${contact}
<p><small>Last updated: 3 November 2026.</small></p>`,
  );
}
