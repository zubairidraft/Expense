import { buildExportFilename } from './download.js';
import { formatExportNumber } from './formatters.js';

/**
 * Generates and downloads a paginated, print-ready PDF financial report.
 * Uses dynamic import('jspdf') and import('jspdf-autotable').
 */
export async function exportDatasetToPdf(dataset, options = {}) {
  const { meta, filters = [], summary, rows = [], byCategory = [] } = dataset;
  const baseCurrency = meta.baseCurrency || 'USD';

  // Dynamic imports
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  // Initialize PDF document in Landscape mode for clean columnar layout
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36; // 0.5 in margins

  // 1. Header Banner
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, pageWidth, 54, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(meta.appName || 'Expense Pro', margin, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(203, 213, 225);
  doc.text('Authoritative Financial Ledger Report', margin + 140, 34);

  // Workspace & Generated stamp on top right
  doc.setFontSize(9);
  doc.text(`Workspace: ${meta.workspaceName}`, pageWidth - margin, 24, { align: 'right' });
  doc.text(`Generated: ${new Date(meta.generatedAt).toLocaleString()}`, pageWidth - margin, 38, { align: 'right' });

  let currentY = 74;

  // 2. Applied Filters & Period Box
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 42, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`REPORT PERIOD: ${meta.period}`, margin + 12, currentY + 16);

  doc.setFont('helvetica', 'normal');
  const filterDesc =
    filters.length > 0
      ? `Filters Applied: ${filters.map((f) => `${f.label}: ${f.value}`).join('  |  ')}`
      : 'Filters Applied: None (Complete Workspace Activity)';
  doc.text(filterDesc, margin + 12, currentY + 30);

  currentY += 54;

  // 3. KPI Metric Strip (4 Cards)
  const cardWidth = (pageWidth - margin * 2 - 36) / 4;
  const cardHeight = 44;

  const kpis = [
    { label: `Total Inflows (${baseCurrency})`, value: formatExportNumber(summary.totalIncome), color: [22, 163, 74] }, // Green
    { label: `Total Outflows (${baseCurrency})`, value: formatExportNumber(summary.totalExpense), color: [220, 38, 38] }, // Red
    {
      label: `Net Cashflow (${baseCurrency})`,
      value: formatExportNumber(summary.netCashflow),
      color: summary.netCashflow >= 0 ? [37, 99, 235] : [220, 38, 38],
    },
    { label: 'Savings Rate & Total Tx', value: `${summary.savingsRate}%  •  ${summary.transactionCount} Tx`, color: [79, 70, 229] },
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (cardWidth + 12);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, cardX + 10, currentY + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, cardX + 10, currentY + 34);
  });

  currentY += cardHeight + 16;

  // 4. Detailed Transactions AutoTable
  const tableHeaders = [
    'Date',
    'Type',
    'Payee / Description',
    'Category',
    'Account',
    `Debit (${baseCurrency})`,
    `Credit (${baseCurrency})`,
    `Net (${baseCurrency})`,
    'Status',
  ];

  const tableBody = rows.map((r) => [
    r.date,
    r.type.toUpperCase(),
    r.payee,
    r.category,
    r.account,
    r.debit > 0 ? formatExportNumber(r.debit) : '-',
    r.credit > 0 ? formatExportNumber(r.credit) : '-',
    formatExportNumber(r.netAmount),
    r.status.toUpperCase(),
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableBody,
    margin: { left: margin, right: margin, bottom: 40 },
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 4,
      overflow: 'ellipsize',
    },
    columnStyles: {
      0: { cellWidth: 54 },  // Date
      1: { cellWidth: 46 },  // Type
      2: { cellWidth: 160 }, // Payee
      3: { cellWidth: 100 }, // Category
      4: { cellWidth: 100 }, // Account
      5: { cellWidth: 64, halign: 'right' }, // Debit
      6: { cellWidth: 64, halign: 'right' }, // Credit
      7: { cellWidth: 64, halign: 'right' }, // Net
      8: { cellWidth: 52, halign: 'center' }, // Status
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      // Running Footer on each page
      const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);

      doc.text(
        `Expense Pro Financial Ledger • Confidential • Generated ${new Date(meta.generatedAt).toLocaleDateString()}`,
        margin,
        pageHeight - 16
      );

      doc.text(
        `Page ${pageNumber} of ${doc.internal.getNumberOfPages()}`,
        pageWidth - margin,
        pageHeight - 16,
        { align: 'right' }
      );
    },
  });

  // Calculate filename and save
  const filterTags = (filters || []).map((f) => f.value);
  const filename =
    options.filename ||
    buildExportFilename({
      prefix: 'Financial_Report',
      startDate: options.startDate,
      endDate: options.endDate,
      filterTags,
      extension: 'pdf',
    });

  doc.save(filename);
  return filename;
}
