import PDFDocument from "pdfkit";
import type { Cycle, Medication, Symptom, TestResult, Milestone, Appointment, Event } from "@shared/schema";

export interface CycleSummary {
  cycle: Cycle;
  medications: Medication[];
  symptoms: Symptom[];
  testResults: TestResult[];
  milestones: Milestone[];
  appointments: Appointment[];
  events: Event[];
}

  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    });
  };

  const formatDateTime = (date: string | Date | null | undefined): string => {
    if (!date) return "N/A";
  return new Date(date).toLocaleString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    });
  };

const capitalize = (value?: string | null): string => {
  if (!value) return "N/A";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const sanitizeText = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\0/g, ""); // Remove null bytes that can break PDF
};

// Helper function to clean symptom notes of numeric severity references
const cleanSymptomNotes = (notes: string | null | undefined): string => {
  if (!notes) return "";
  // Remove all patterns containing numbers with "/5" - be very aggressive
  return notes
    .replace(/\s*\(\d+\/5\)/gi, "") // Remove (2/5) patterns
    .replace(/\s*\(\d+\/\s*5\)/gi, "") // Remove (2/ 5) patterns with spaces
    .replace(/\s*\d+\/5\s*/gi, "") // Remove 2/5 patterns
    .replace(/\s*\d+\/\s*5\s*/gi, "") // Remove 2/ 5 patterns with spaces
    .replace(/\s*severity:\s*\d+\/5/gi, "") // Remove "severity: 2/5" patterns
    .replace(/\s*severity:\s*\d+\/\s*5/gi, "") // Remove "severity: 2/ 5" patterns
    .replace(/\s*\(\d+\/5\s*severity\)/gi, "") // Remove "(2/5 severity)" patterns
    .replace(/\s*\(\d+\/\s*5\s*severity\)/gi, "") // Remove "(2/ 5 severity)" patterns
    .replace(/\s*\(\d+\/5\)/gi, "") // Remove (2/5) patterns again (catch any missed)
    .replace(/\b\d+\/5\b/gi, "") // Remove any standalone "2/5" as a word
    .replace(/\s+/g, " ") // Normalize multiple spaces to single space
    .trim();
};

// Helper function to format symptom value - returns "Yes" if value exists, "-" otherwise
const formatSymptomValue = (value: number | string | null | undefined): string => {
  // Handle null/undefined
  if (value === null || value === undefined) return "-";
  
  // Convert to number if it's a string
  const numValue = typeof value === "string" ? parseInt(value, 10) : value;
  
  // Check if value exists and is greater than 0 (symptoms are stored as 1-5)
  // Also check if it's not NaN (in case string conversion failed)
  return (!isNaN(numValue) && numValue > 0) ? "Yes" : "-";
};

export function generateCycleSummaryHTML(summary: CycleSummary, userName?: string): string {
  const { cycle, medications, symptoms, testResults, milestones, appointments, events } = summary;

  const cycleDuration =
    cycle.endDate && cycle.startDate
      ? Math.floor(
          (new Date(cycle.endDate).getTime() - new Date(cycle.startDate).getTime()) / (1000 * 60 * 60 * 24),
        ) + 1
    : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cycle Summary Report - Foli</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f7f7f7;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #b7bea0;
    }
    .header h1 {
      color: #404040;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header .subtitle {
      color: #808080;
      font-size: 14px;
    }
    .section {
      margin-bottom: 40px;
    }
    .section-title {
      font-size: 20px;
      color: #404040;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e0e0e0;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 20px;
    }
    .info-item {
      padding: 15px;
      background: #f7f7f7;
      border-radius: 8px;
    }
    .info-label {
      font-size: 12px;
      color: #808080;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .info-value {
      font-size: 16px;
      color: #404040;
      font-weight: 500;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    th {
      background: #f7f7f7;
      font-weight: 600;
      color: #404040;
      font-size: 14px;
    }
    td {
      font-size: 14px;
      color: #333;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-active {
      background: #d4edda;
      color: #155724;
    }
    .badge-completed {
      background: #d1ecf1;
      color: #0c5460;
    }
    .badge-cancelled {
      background: #f8d7da;
      color: #721c24;
    }
    .badge-pending {
      background: #fff3cd;
      color: #856404;
    }
    .badge-in-progress {
      background: #cfe2ff;
      color: #084298;
    }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: #808080;
      font-style: italic;
    }
    .notes {
      background: #f7f7f7;
      padding: 15px;
      border-radius: 8px;
      margin-top: 10px;
      font-size: 14px;
      color: #404040;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .container {
        box-shadow: none;
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Treatment Cycle Summary Report</h1>
      <div class="subtitle">Generated on ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      ${userName ? `<div class="subtitle" style="margin-top: 5px;">Patient: ${userName}</div>` : ''}
    </div>

    <!-- Cycle Overview -->
    <div class="section">
      <h2 class="section-title">Cycle Overview</h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Cycle Type</div>
          <div class="info-value">${cycle.type.toUpperCase()}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Status</div>
          <div class="info-value">
            <span class="badge badge-${cycle.status}">${cycle.status.charAt(0).toUpperCase() + cycle.status.slice(1)}</span>
          </div>
        </div>
        <div class="info-item">
          <div class="info-label">Start Date</div>
          <div class="info-value">${formatDate(cycle.startDate)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">End Date</div>
          <div class="info-value">${cycle.endDate ? formatDate(cycle.endDate) : 'Ongoing'}</div>
        </div>
        ${cycleDuration ? `
        <div class="info-item">
          <div class="info-label">Duration</div>
          <div class="info-value">${cycleDuration} days</div>
        </div>
        ` : ''}
        ${cycle.result ? `
        <div class="info-item">
          <div class="info-label">Result</div>
          <div class="info-value">${cycle.result.charAt(0).toUpperCase() + cycle.result.slice(1)}</div>
        </div>
        ` : ''}
        ${cycle.clinic ? `
        <div class="info-item">
          <div class="info-label">Clinic</div>
          <div class="info-value">${cycle.clinic}</div>
        </div>
        ` : ''}
        ${cycle.doctor ? `
        <div class="info-item">
          <div class="info-label">Doctor</div>
          <div class="info-value">${cycle.doctor}</div>
        </div>
        ` : ''}
      </div>
      ${cycle.notes ? `
      <div class="notes">
        <strong>Cycle Notes:</strong><br>
        ${cycle.notes}
      </div>
      ` : ''}
    </div>

    <!-- Milestones -->
    <div class="section">
      <h2 class="section-title">Treatment Milestones</h2>
      ${milestones.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Milestone</th>
            <th>Expected Date</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${milestones.map(m => `
          <tr>
            <td><strong>${m.title}</strong></td>
            <td>${formatDate(m.date)}</td>
            <td>${m.startDate ? formatDate(m.startDate) : '-'}</td>
            <td>${m.endDate ? formatDate(m.endDate) : '-'}</td>
            <td><span class="badge badge-${m.status}">${m.status.charAt(0).toUpperCase() + m.status.slice(1)}</span></td>
          </tr>
          ${m.notes ? `<tr><td colspan="5" style="padding-left: 30px; color: #808080; font-size: 12px;">Note: ${m.notes}</td></tr>` : ''}
          `).join('')}
        </tbody>
      </table>
      ` : '<div class="empty-state">No milestones recorded</div>'}
    </div>

    <!-- Medications -->
    <div class="section">
      <h2 class="section-title">Medications</h2>
      ${medications.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Medication</th>
            <th>Dosage</th>
            <th>Frequency</th>
            <th>Time</th>
            <th>Start Date</th>
            <th>End Date</th>
          </tr>
        </thead>
        <tbody>
          ${medications.map(m => `
          <tr>
            <td><strong>${m.name}</strong></td>
            <td>${m.dosage}</td>
            <td>${m.frequency}</td>
            <td>${m.time || '-'}</td>
            <td>${formatDate(m.startDate)}</td>
            <td>${m.endDate ? formatDate(m.endDate) : 'Ongoing'}</td>
          </tr>
          ${m.sideEffects ? `<tr><td colspan="6" style="padding-left: 30px; color: #808080; font-size: 12px;">Side Effects: ${m.sideEffects}</td></tr>` : ''}
          ${m.notes ? `<tr><td colspan="6" style="padding-left: 30px; color: #808080; font-size: 12px;">Note: ${m.notes}</td></tr>` : ''}
          `).join('')}
        </tbody>
      </table>
      ` : '<div class="empty-state">No medications recorded</div>'}
    </div>

    <!-- Test Results -->
    <div class="section">
      <h2 class="section-title">Test Results</h2>
      ${testResults.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Test Type</th>
            <th>Name</th>
            <th>Value</th>
            <th>Unit</th>
            <th>Reference Range</th>
          </tr>
        </thead>
        <tbody>
          ${testResults.map(t => `
          <tr>
            <td>${formatDate(t.date)}</td>
            <td>${t.type}</td>
            <td><strong>${t.name}</strong></td>
            <td>${t.value || '-'}</td>
            <td>${t.unit || '-'}</td>
            <td>${t.referenceRange || '-'}</td>
          </tr>
          ${t.notes ? `<tr><td colspan="6" style="padding-left: 30px; color: #808080; font-size: 12px;">Note: ${t.notes}</td></tr>` : ''}
          `).join('')}
        </tbody>
      </table>
      ` : '<div class="empty-state">No test results recorded</div>'}
    </div>

    <!-- Symptoms -->
    <div class="section">
      <h2 class="section-title">Symptoms Log</h2>
      ${symptoms.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Mood</th>
            <th>Bloating</th>
            <th>Fatigue</th>
            <th>Nausea</th>
            <th>Headache</th>
            <th>Mood Swings</th>
          </tr>
        </thead>
        <tbody>
          ${symptoms.map(s => `
          <tr>
            <td>${formatDate(s.date)}</td>
            <td>${s.mood || '-'}</td>
            <td>${formatSymptomValue(s.bloating)}</td>
            <td>${formatSymptomValue(s.fatigue)}</td>
            <td>${formatSymptomValue(s.nausea)}</td>
            <td>${formatSymptomValue(s.headache)}</td>
            <td>${formatSymptomValue(s.moodSwings)}</td>
          </tr>
          ${s.notes ? `<tr><td colspan="7" style="padding-left: 30px; color: #808080; font-size: 12px;">Note: ${cleanSymptomNotes(s.notes)}</td></tr>` : ''}
          `).join('')}
        </tbody>
      </table>
      ` : '<div class="empty-state">No symptoms recorded</div>'}
    </div>

    <!-- Appointments -->
    <div class="section">
      <h2 class="section-title">Appointments</h2>
      ${appointments.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Type</th>
            <th>Title</th>
            <th>Location</th>
            <th>Doctor</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${appointments.map(a => `
          <tr>
            <td>${formatDateTime(a.date)}</td>
            <td>${a.type}</td>
            <td><strong>${a.title}</strong></td>
            <td>${a.location || '-'}</td>
            <td>${a.doctorName || '-'}</td>
            <td><span class="badge badge-${a.completed ? 'completed' : 'pending'}">${a.completed ? 'Completed' : 'Scheduled'}</span></td>
          </tr>
          ${a.notes ? `<tr><td colspan="6" style="padding-left: 30px; color: #808080; font-size: 12px;">Note: ${a.notes}</td></tr>` : ''}
          `).join('')}
        </tbody>
      </table>
      ` : '<div class="empty-state">No appointments recorded</div>'}
    </div>

    <!-- Events -->
    <div class="section">
      <h2 class="section-title">Events & Notes</h2>
      ${events.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Event Type</th>
            <th>Title</th>
            <th>Phase</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          ${events.map(e => `
          <tr>
            <td>${formatDate(e.date)}</td>
            <td>${e.eventType}</td>
            <td><strong>${e.title}</strong></td>
            <td>${e.phase || '-'}</td>
            <td>${e.outcome ? e.outcome.charAt(0).toUpperCase() + e.outcome.slice(1) : '-'}</td>
          </tr>
          ${e.description ? `<tr><td colspan="5" style="padding-left: 30px; color: #808080; font-size: 12px;">${e.description}</td></tr>` : ''}
          ${e.doctorNotes ? `<tr><td colspan="5" style="padding-left: 30px; color: #0c5460; font-size: 12px;"><strong>Doctor Notes:</strong> ${e.doctorNotes}</td></tr>` : ''}
          ${e.personalNotes ? `<tr><td colspan="5" style="padding-left: 30px; color: #856404; font-size: 12px;"><strong>Personal Notes:</strong> ${e.personalNotes}</td></tr>` : ''}
          `).join('')}
        </tbody>
      </table>
      ` : '<div class="empty-state">No events recorded</div>'}
    </div>

    <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e0e0e0; text-align: center; color: #808080; font-size: 12px;">
      <p>This report was generated by Foli - Your fertility journey companion</p>
      <p style="margin-top: 5px;">For medical advice, please consult your healthcare provider</p>
    </div>
  </div>
</body>
</html>`;
}

const toCsvValue = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export function generateCycleSummaryCSV(summary: CycleSummary, userName?: string): string {
  const { cycle, medications, symptoms, testResults, milestones, appointments, events } = summary;
  const lines: string[] = [];

  const pushRow = (...cells: (string | number | null | undefined)[]) => {
    lines.push(cells.map(toCsvValue).join(","));
  };

  pushRow("Treatment Cycle Summary Report");
  pushRow("Generated On", formatDateTime(new Date()));
  if (userName) {
    pushRow("Patient", userName);
  }
  lines.push("");

  pushRow("Cycle Overview");
  pushRow("Field", "Value");
  pushRow("Cycle Type", cycle.type?.toUpperCase() || "N/A");
  pushRow("Status", capitalize(cycle.status));
  pushRow("Start Date", formatDate(cycle.startDate));
  pushRow("End Date", cycle.endDate ? formatDate(cycle.endDate) : "Ongoing");
  if (cycle.result) pushRow("Result", capitalize(cycle.result));
  if (cycle.clinic) pushRow("Clinic", cycle.clinic);
  if (cycle.doctor) pushRow("Doctor", cycle.doctor);
  if (cycle.notes) pushRow("Notes", cycle.notes);
  lines.push("");

  pushRow("Milestones");
  if (milestones.length) {
    pushRow("Title", "Expected Date", "Start Date", "End Date", "Status", "Notes");
    milestones.forEach((m) =>
      pushRow(
        m.title,
        formatDate(m.date),
        m.startDate ? formatDate(m.startDate) : "-",
        m.endDate ? formatDate(m.endDate) : "-",
        capitalize(m.status),
        m.notes || "",
      ),
    );
  } else {
    pushRow("No milestones recorded");
  }
  lines.push("");

  pushRow("Medications");
  if (medications.length) {
    pushRow("Name", "Dosage", "Frequency", "Time", "Start Date", "End Date", "Notes");
    medications.forEach((m) =>
      pushRow(
        m.name,
        m.dosage,
        m.frequency,
        m.time || "-",
        formatDate(m.startDate),
        m.endDate ? formatDate(m.endDate) : "Ongoing",
        m.notes || m.sideEffects || "",
      ),
    );
  } else {
    pushRow("No medications recorded");
  }
  lines.push("");

  pushRow("Test Results");
  if (testResults.length) {
    pushRow("Date", "Type", "Name", "Value", "Unit", "Reference Range", "Notes");
    testResults.forEach((t) =>
      pushRow(
        formatDate(t.date),
        t.type,
        t.name,
        t.value || "",
        t.unit || "",
        t.referenceRange || "",
        t.notes || "",
      ),
    );
  } else {
    pushRow("No test results recorded");
  }
  lines.push("");

  pushRow("Symptoms");
  if (symptoms.length) {
    pushRow("Date", "Mood", "Bloating", "Fatigue", "Nausea", "Headache", "Mood Swings", "Notes");
    symptoms.forEach((s) =>
      pushRow(
        formatDate(s.date),
        s.mood || "",
        formatSymptomValue(s.bloating) === "Yes" ? "Yes" : "-",
        formatSymptomValue(s.fatigue) === "Yes" ? "Yes" : "-",
        formatSymptomValue(s.nausea) === "Yes" ? "Yes" : "-",
        formatSymptomValue(s.headache) === "Yes" ? "Yes" : "-",
        formatSymptomValue(s.moodSwings) === "Yes" ? "Yes" : "-",
        cleanSymptomNotes(s.notes) || "",
      ),
    );
  } else {
    pushRow("No symptoms recorded");
  }
  lines.push("");

  pushRow("Appointments");
  if (appointments.length) {
    pushRow("Date & Time", "Type", "Title", "Location", "Doctor", "Status", "Notes");
    appointments.forEach((a) =>
      pushRow(
        formatDateTime(a.date),
        a.type,
        a.title,
        a.location || "",
        a.doctorName || "",
        a.completed ? "Completed" : "Scheduled",
        a.notes || "",
      ),
    );
  } else {
    pushRow("No appointments recorded");
  }
  lines.push("");

  pushRow("Events & Notes");
  if (events.length) {
    pushRow("Date", "Type", "Title", "Phase", "Outcome", "Details");
    events.forEach((e) =>
      pushRow(
        formatDate(e.date),
        e.eventType,
        e.title,
        e.phase || "",
        e.outcome ? capitalize(e.outcome) : "",
        [e.description, e.doctorNotes, e.personalNotes].filter(Boolean).join(" | "),
      ),
    );
  } else {
    pushRow("No events recorded");
  }

  return lines.join("\n");
}

export function generateCycleSummaryPDF(summary: CycleSummary, userName?: string): Promise<Buffer> {
  const { cycle, medications, symptoms, testResults, milestones, appointments, events } = summary;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk as Buffer));
      doc.on("end", () => {
        try {
          const finalBuffer = Buffer.concat(buffers);
          if (finalBuffer.length === 0) {
            reject(new Error("PDF buffer is empty after generation"));
            return;
          }
          resolve(finalBuffer);
        } catch (err) {
          reject(err);
        }
      });
      doc.on("error", (err) => {
        reject(new Error(`PDF generation error: ${err instanceof Error ? err.message : String(err)}`));
      });

    const addSectionTitle = (title: string) => {
      doc.moveDown();
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text(title);
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10).fillColor("#111827");
    };

    const addKeyValueRow = (label: string, value: string) => {
      doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
      doc.font("Helvetica").text(value);
    };

    doc.font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#111827")
      .text("Treatment Cycle Summary Report", { align: "center" });
    doc.moveDown(0.25);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#6b7280")
      .text(
        `${formatDateTime(new Date())}${userName ? ` • Patient: ${userName}` : ""}`,
        {
          align: "center",
        },
      );
    doc.moveDown();

    addSectionTitle("Cycle Overview");
    addKeyValueRow("Cycle Type", cycle.type?.toUpperCase() || "N/A");
    addKeyValueRow("Status", capitalize(cycle.status));
    addKeyValueRow("Start Date", formatDate(cycle.startDate));
    addKeyValueRow("End Date", cycle.endDate ? formatDate(cycle.endDate) : "Ongoing");
    if (cycle.result) addKeyValueRow("Result", capitalize(cycle.result));
    if (cycle.clinic) addKeyValueRow("Clinic", cycle.clinic);
    if (cycle.doctor) addKeyValueRow("Doctor", cycle.doctor);
    if (cycle.notes) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Oblique").text(`Notes: ${cycle.notes}`);
    }

    addSectionTitle("Milestones");
    if (!milestones.length) {
      doc.text("No milestones recorded.", { italic: true });
    } else {
      milestones.forEach((m, index) => {
        doc.font("Helvetica-Bold").text(`${index + 1}. ${m.title}`);
        doc.font("Helvetica").text(
          `Expected: ${formatDate(m.date)} • Start: ${m.startDate ? formatDate(m.startDate) : "-"} • End: ${
            m.endDate ? formatDate(m.endDate) : "-"
          } • Status: ${capitalize(m.status)}`,
        );
        if (m.notes) {
          doc.font("Helvetica-Oblique").text(`Notes: ${m.notes}`);
        }
        doc.moveDown(0.4);
      });
    }

    addSectionTitle("Medications");
    if (!medications.length) {
      doc.text("No medications recorded.", { italic: true });
    } else {
      medications.forEach((m, index) => {
        doc.font("Helvetica-Bold").text(`${index + 1}. ${m.name}`);
        doc
          .font("Helvetica")
          .text(
            `Dosage: ${m.dosage} • Frequency: ${m.frequency} • Time: ${m.time || "-"} • Start: ${formatDate(
              m.startDate,
            )} • End: ${m.endDate ? formatDate(m.endDate) : "Ongoing"}`,
          );
        if (m.sideEffects) doc.font("Helvetica-Oblique").text(`Side effects: ${m.sideEffects}`);
        if (m.notes) doc.font("Helvetica-Oblique").text(`Notes: ${m.notes}`);
        doc.moveDown(0.4);
      });
    }

    addSectionTitle("Test Results");
    if (!testResults.length) {
      doc.text("No test results recorded.", { italic: true });
    } else {
      testResults.forEach((t, index) => {
        doc.font("Helvetica-Bold").text(`${index + 1}. ${t.name} (${t.type})`);
        doc
          .font("Helvetica")
          .text(
            `Date: ${formatDate(t.date)} • Value: ${t.value || "-"} ${t.unit || ""} • Reference: ${
              t.referenceRange || "-"
            }`,
          );
        if (t.notes) doc.font("Helvetica-Oblique").text(`Notes: ${t.notes}`);
        doc.moveDown(0.4);
      });
    }

    addSectionTitle("Symptoms");
    if (!symptoms.length) {
      doc.text("No symptoms recorded.", { italic: true });
    } else {
      symptoms.forEach((s, index) => {
        doc.font("Helvetica-Bold").text(`${index + 1}. ${formatDate(s.date)}`);
        doc
          .font("Helvetica")
          .text(
            `Mood: ${s.mood || "-"} • Bloating: ${formatSymptomValue(s.bloating)} • Fatigue: ${
              formatSymptomValue(s.fatigue)
            }`,
          );
        doc
          .font("Helvetica")
          .text(
            `Nausea: ${formatSymptomValue(s.nausea)} • Headache: ${formatSymptomValue(s.headache)} • Mood Swings: ${
              formatSymptomValue(s.moodSwings)
            }`,
          );
        if (s.notes) doc.font("Helvetica-Oblique").text(`Notes: ${cleanSymptomNotes(s.notes)}`);
        doc.moveDown(0.4);
      });
    }

    addSectionTitle("Appointments");
    if (!appointments.length) {
      doc.text("No appointments recorded.", { italic: true });
    } else {
      appointments.forEach((a, index) => {
        doc.font("Helvetica-Bold").text(`${index + 1}. ${a.title}`);
        doc
          .font("Helvetica")
          .text(
            `When: ${formatDateTime(a.date)} • Type: ${a.type} • Location: ${a.location || "-"} • Doctor: ${
              a.doctorName || "-"
            }`,
          );
        doc.text(`Status: ${a.completed ? "Completed" : "Scheduled"}`);
        if (a.notes) doc.font("Helvetica-Oblique").text(`Notes: ${a.notes}`);
        doc.moveDown(0.4);
      });
    }

    addSectionTitle("Events & Notes");
    if (!events.length) {
      doc.text("No events recorded.", { italic: true });
    } else {
      events.forEach((e, index) => {
        doc.font("Helvetica-Bold").text(`${index + 1}. ${e.title} (${formatDate(e.date)})`);
        doc
          .font("Helvetica")
          .text(
            `Type: ${e.eventType} • Phase: ${e.phase || "-"} • Outcome: ${e.outcome ? capitalize(e.outcome) : "-"}`,
          );
        if (e.description) doc.font("Helvetica").text(`Details: ${e.description}`);
        if (e.doctorNotes) doc.font("Helvetica-Oblique").text(`Doctor notes: ${e.doctorNotes}`);
        if (e.personalNotes) doc.font("Helvetica-Oblique").text(`Personal notes: ${e.personalNotes}`);
        doc.moveDown(0.4);
      });
    }

      doc.moveDown();
      doc
        .font("Helvetica-Oblique")
        .fontSize(9)
        .fillColor("#6b7280")
        .text(
          "This report was generated by Foli to support clinical discussions. Please consult your healthcare provider for medical advice.",
          {
            align: "center",
          },
        );

      doc.end();
    } catch (err) {
      reject(new Error(`PDF generation failed: ${err instanceof Error ? err.message : String(err)}`));
    }
  });
}



