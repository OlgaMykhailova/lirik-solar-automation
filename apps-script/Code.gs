// Розгортання: Web app, Execute as — Me, Who has access — Anyone.
// Потрібні: служба Drive API v3 (Services → + → Drive API) і файл appsscript.json з цього каталогу.
// Скрипт бачить лише файли, створені ним самим (scope drive.file), тому папку створює сам: запустіть setup() один раз.
const SECRET = "ВСТАВТЕ_ДОВГИЙ_ВИПАДКОВИЙ_РЯДОК";
const FOLDER_NAME = "Рахунки та накладні";
const MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function folderId_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty("FOLDER_ID");
  if (!id) {
    id = Drive.Files.create({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }).id;
    props.setProperty("FOLDER_ID", id);
  }
  return id;
}

// Запустіть один раз вручну: створить папку, адреса з'явиться в журналі виконання.
function setup() {
  Logger.log("https://drive.google.com/drive/folders/" + folderId_());
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return reply({ ok: false, error: "forbidden" });
    const blob = Utilities.newBlob(Utilities.base64Decode(d.data), MIME, d.name);
    const file = Drive.Files.create({ name: d.name, parents: [folderId_()] }, blob);
    return reply({ ok: true, id: file.id, url: "https://drive.google.com/file/d/" + file.id + "/view" });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
