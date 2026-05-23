import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export const exportToTXT = (text: string, filename: string = 'transcription.txt') => {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, filename);
};

export const exportToJSON = (text: string, filename: string = 'transcription.json') => {
  const data = JSON.stringify({ transcription: text }, null, 2);
  const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
  saveAs(blob, filename);
};

export const exportToPDF = (text: string, filename: string = 'transcription.pdf') => {
  const doc = new jsPDF();
  const splitText = doc.splitTextToSize(text, 180);
  
  let y = 15;
  for (let i = 0; i < splitText.length; i++) {
    if (y > 280) {
      doc.addPage();
      y = 15;
    }
    doc.text(splitText[i], 15, y);
    y += 7;
  }
  
  doc.save(filename);
};

export const exportToWord = async (text: string, filename: string = 'transcription.docx') => {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: text.split('\n').map(line => new Paragraph({
          children: [new TextRun(line)],
        })),
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
};
