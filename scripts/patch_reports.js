const fs = require('fs');
const path = require('path');

const filePath = path.resolve('frontend/src/components/Reports.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Replace exportCsv logic
const csvStart = code.indexOf('const blob = new Blob(');
const csvEnd = code.indexOf('setNotice("CSV report exported successfully. You can open this file in Excel or Sheets.");') + 'setNotice("CSV report exported successfully. You can open this file in Excel or Sheets.");'.length;

if (csvStart !== -1 && csvEnd !== -1) {
  const replacement = 'const res = await exportCsvFile(\n      lines.join("\\r\\n"),\n      `stock-report-${reportType.toLowerCase()}-${today}.csv`,\n      `Stock Report - ${reportType}`\n    );\n    setNotice(res.message);';
  code = code.slice(0, csvStart) + replacement + code.slice(csvEnd);
}

// Replace exportPdf
code = code.replace('const exportPdf = () => {', 'const exportPdf = async () => {');

const pdfSaveStart = code.indexOf('doc.save(`stock-report-${reportType.toLowerCase()}-${today}.pdf`);');
if (pdfSaveStart !== -1) {
  const pdfSaveEnd = code.indexOf('setNotice("PDF report exported successfully.");', pdfSaveStart) + 'setNotice("PDF report exported successfully.");'.length;
  const pdfReplacement = 'const res = await exportPdfFile(\n      doc,\n      `stock-report-${reportType.toLowerCase()}-${today}.pdf`,\n      selectedLabel\n    );\n    setNotice(res.message);';
  code = code.slice(0, pdfSaveStart) + pdfReplacement + code.slice(pdfSaveEnd);
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully patched Reports.tsx');
