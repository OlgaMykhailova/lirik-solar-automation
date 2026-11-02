// Розгорніть як веб-застосунок: Execute as — Me, Who has access — Anyone.
// SECRET має збігатися зі змінною GOOGLE_SCRIPT_SECRET у Vercel.
const SECRET = "ВСТАВТЕ_ДОВГИЙ_ВИПАДКОВИЙ_РЯДОК";
const FOLDER_ID = "ВСТАВТЕ_ID_ПАПКИ";

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return reply({ ok: false, error: "forbidden" });
    const mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const blob = Utilities.newBlob(Utilities.base64Decode(d.data), mime, d.name);
    const file = DriveApp.getFolderById(FOLDER_ID).createFile(blob);
    return reply({ ok: true, id: file.getId(), url: file.getUrl() });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
