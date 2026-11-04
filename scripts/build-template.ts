import { readFileSync, writeFileSync } from "node:fs";

// Шаблон гарантійного талона вбудовується в код, щоб потрапити у функцію Vercel без читання файлів.
const docx = readFileSync("templates/warranty.docx");
writeFileSync(
  "src/generators/warranty-template.ts",
  `// Згенеровано командою npm run build-template з templates/warranty.docx. Не редагуйте вручну.\nexport const WARRANTY_TEMPLATE_B64 = "${docx.toString("base64")}";\n`,
);
console.log(`warranty-template.ts: ${docx.length} байт`);
