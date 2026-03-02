/**
 * @fileOverview Server-side DOCX generation engine.
 * 
 * Handles high-fidelity legal document generation for the Ministry of Justice.
 * Uses manual construction to ensure perfect alignment, typography, and official margins.
 */

import fs from "fs";
import path from "path";
import { format } from 'date-fns';
import type { CorrespondenceFile, InternalDraft } from '@/lib/types';
import { initializeAdmin } from '@/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  VerticalAlign
} from 'docx';

/**
 * Strips HTML tags for clean text injection while preserving basic list structures.
 */
function cleanContent(html: string): string {
  if (!html) return '';
  return html
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong>/gi, '').replace(/<\/strong>/gi, '')
    .replace(/<em>/gi, '').replace(/<\/em>/gi, '')
    .replace(/<u>/gi, '').replace(/<\/u>/gi, '')
    .replace(/<ul[^>]*>/gi, '').replace(/<\/ul>/gi, '')
    .replace(/<ol[^>]*>/gi, '').replace(/<\/ol>/gi, '')
    .replace(/<li[^>]*>/gi, '• ').replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Generates a Word document buffer with official Ghanaian header specifications.
 */
export async function generateLegalDocBuffer(draft: InternalDraft, file: CorrespondenceFile, type: 'letter' | 'memo'): Promise<Buffer> {
  // Path Discovery: Using the specific path provided by the user.
  const rootPath = process.cwd();
  const searchPaths = [
    path.join(rootPath, 'server', 'docx', 'templates', 'coat-of-arms.png'),
    path.join(rootPath, 'src', 'server', 'docx', 'templates', 'coat-of-arms.png'),
    path.join(rootPath, 'templates', 'coat-of-arms.png'),
    path.join(rootPath, 'public', 'templates', 'coat-of-arms.png'),
    path.join(rootPath, 'public', 'coat-of-arms.png'),
  ];
  
  let coatOfArmsBuffer: Buffer | null = null;
  let foundPath = "";

  for (const p of searchPaths) {
    try {
      if (fs.existsSync(p)) {
        coatOfArmsBuffer = fs.readFileSync(p);
        foundPath = p;
        break;
      }
    } catch (e) {
      // Continue searching next path
    }
  }

  if (!coatOfArmsBuffer) {
    console.warn("COAT OF ARMS NOT FOUND. Checked paths:", searchPaths);
  } else {
    console.log("Coat of Arms loaded successfully from:", foundPath);
  }

  const now = format(new Date(), 'do MMMM yyyy');

  // Fetch Attorney Rank for Memo FROM field
  let attorneyRank = "STATE ATTORNEY";
  if (file.assignedTo) {
    try {
      const firestore = getFirestore(initializeAdmin());
      const attorneySnap = await firestore.collection('attorneys').where('fullName', '==', file.assignedTo).limit(1).get();
      if (!attorneySnap.empty) {
        attorneyRank = attorneySnap.docs[0].data().rank || "STATE ATTORNEY";
      }
    } catch (e) {
      console.warn("Could not fetch attorney rank, using default.");
    }
  }

  const sections = [];

  // 1. Column Ratios Configuration
  const col1Width = type === 'memo' ? 15 : 25;
  const col2Width = type === 'memo' ? 70 : 40;
  const col3Width = type === 'memo' ? 15 : 35;
  
  const titleCellMargins = type === 'memo' 
    ? { left: 200, right: 200 } 
    : { left: 250, right: 250 };
  
  const rightBlockChildren = [];
  if (type === 'letter') {
    rightBlockChildren.push(
      new Paragraph({ 
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: "P. O. Box MB 60, Ministries, Accra", bold: true, size: 22, font: "Calibri" })], 
        spacing: { before: 0, after: 0 } 
      }),
      new Paragraph({ 
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: "Digital Address: GA-110-0587", bold: true, size: 22, font: "Calibri" })], 
        spacing: { before: 0, after: 0 } 
      }),
      new Paragraph({ 
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: "Kindly quote this number and date on all correspondence", italics: true, size: 14, font: "Calibri" })], 
        spacing: { before: 0, after: 0 } 
      }),
      new Paragraph({ 
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: `My Ref. No. ${file.fileNumber}`, size: 14, font: "Calibri" })], 
        spacing: { before: 0, after: 0 } 
      }),
      new Paragraph({ 
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: `Your Ref. No. ${file.suitNumber || ""}`, size: 14, font: "Calibri" })], 
        spacing: { before: 0, after: 0 } 
      })
    );
    rightBlockChildren.push(new Paragraph({ spacing: { before: 240, after: 0 } }));
    rightBlockChildren.push(
      new Paragraph({ 
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: `Date: ${now}`, bold: true, size: 20, font: "Calibri" })] 
      })
    );
  } else {
    rightBlockChildren.push(
      new Paragraph({ 
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: file.fileNumber, bold: true, size: 24, font: "Calibri" })] 
      })
    );
  }

  // 2. Official Header Table
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: col1Width, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            margins: { right: 300 },
            borders: {
              right: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
            },
            children: [
              coatOfArmsBuffer ? 
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new ImageRun({ data: coatOfArmsBuffer, transformation: { width: 128, height: 105 } })],
                }) :
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "GHANA", bold: true, size: 24 })] }),
            ],
          }),
          new TableCell({
            width: { size: col2Width, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            margins: titleCellMargins,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "OFFICE OF THE ATTORNEY-GENERAL AND MINISTRY OF JUSTICE", bold: true, size: 26, font: "Book Antiqua" }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: col3Width, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.TOP,
            children: rightBlockChildren,
          }),
        ],
      }),
    ],
  });

  sections.push(headerTable);

  if (type === 'letter') {
    const activeIndent = { left: 720, right: 720 };
    sections.push(new Paragraph({ spacing: { before: 800 }, indent: activeIndent }));
    sections.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: draft.title.toUpperCase(), bold: true, size: 24, font: "Times New Roman", underline: {} })],
      spacing: { after: 400 },
      indent: activeIndent
    }));

    cleanContent(draft.content).split('\n\n').forEach(p => {
      if (!p.trim()) return;
      sections.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: activeIndent,
          children: [new TextRun({ text: p.trim(), font: "Times New Roman", size: 24 })],
          spacing: { after: 200, line: 360 }
        })
      );
    });

    sections.push(
      new Paragraph({ 
        spacing: { before: 800 }, 
        indent: activeIndent,
        children: [new TextRun({ text: "...........................................................", font: "Times New Roman" })] 
      }),
      new Paragraph({ 
        indent: activeIndent,
        children: [new TextRun({ text: (file.assignedTo || "STATE ATTORNEY").toUpperCase(), bold: true, size: 24, font: "Times New Roman" })] 
      })
    );

  } else {
    sections.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: "MEMORANDUM", bold: true, size: 28, font: "Times New Roman", underline: {} })],
      spacing: { before: 400, after: 400 }
    }));

    const memoLabels = [
      { label: "TO: ", val: "THE RECIPIENT" },
      { label: "FROM: ", val: attorneyRank.toUpperCase() },
      { label: "SUBJECT: ", val: draft.title.toUpperCase() },
      { label: "DATE: ", val: now }
    ];

    memoLabels.forEach((m, idx) => {
      const isLast = idx === memoLabels.length - 1;
      sections.push(new Paragraph({
        spacing: { line: 360, before: 0, after: isLast ? 200 : 0 },
        border: isLast ? { bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 6 } } : undefined,
        children: [
          new TextRun({ text: m.label, bold: true, font: "Times New Roman", size: 24 }),
          new TextRun({ text: m.val, font: "Times New Roman", size: 24 })
        ]
      }));
    });
    
    cleanContent(draft.content).split('\n\n').forEach(p => {
      if (!p.trim()) return;
      sections.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [new TextRun({ text: p.trim(), font: "Times New Roman", size: 24 })],
          spacing: { after: 200, line: 360 }
        })
      );
    });

    sections.push(
      new Paragraph({ 
        spacing: { before: 800 }, 
        children: [new TextRun({ text: "...........................................................", font: "Times New Roman" })] 
      }),
      new Paragraph({ 
        children: [new TextRun({ text: (file.assignedTo || "STATE ATTORNEY").toUpperCase(), bold: true, size: 24, font: "Times New Roman" })] 
      })
    );
  }

  const doc = new Document({
    sections: [{
      properties: { 
        page: { 
          margin: { 
            top: 720, bottom: 720, 
            left: type === 'memo' ? 1440 : 720, 
            right: type === 'memo' ? 1440 : 720 
          } 
        } 
      },
      children: sections,
    }],
  });

  return await Packer.toBuffer(doc);
}
