import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function renderResumePdf(resumeData: any, template: string = 'simple'): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let y = 800; // start near top
  const margin = 50;

  // Header - Name
  page.drawText(resumeData.personal_name || 'Your Name', {
    x: margin,
    y: y,
    size: 24,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= 30;

  // Header - Contact
  const contact = [];
  if (resumeData.contact_details) contact.push(resumeData.contact_details);
  
  if (contact.length > 0) {
    page.drawText(contact.join(' | '), {
      x: margin,
      y: y,
      size: 10,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }
  y -= 40;

  // Sections helper
  const drawSection = (title: string, content: string | null) => {
    if (!content) return;
    page.drawText(title.toUpperCase(), {
      x: margin,
      y: y,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    y -= 20;
    
    // Naive text wrapping (could be improved)
    const lines = content.split('\n');
    for (const line of lines) {
      page.drawText(line, {
        x: margin,
        y: y,
        size: 10,
        font: font,
        color: rgb(0, 0, 0),
      });
      y -= 15;
    }
    y -= 15;
  };

  drawSection('Target Role', resumeData.target_role);
  drawSection('Skills', resumeData.skills);
  drawSection('Experience', resumeData.experience_details);
  drawSection('Education', resumeData.education);
  drawSection('Certificates', resumeData.certificates);
  drawSection('Availability', resumeData.availability);
  drawSection('References', resumeData.references || 'Available on request');

  return await pdfDoc.save();
}
