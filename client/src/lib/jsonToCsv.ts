/**
 * JSON to CSV Converter
 * Converts user data JSON to CSV format
 */

interface ExportData {
  exportDate: string;
  version: string;
  data: {
    user: any;
    cycles: any[];
    medications: any[];
    medicationLogs: any[];
    symptoms: any[];
    testResults: any[];
    appointments: any[];
    milestones: any[];
    events: any[];
    forumPosts: any[];
    forumComments: any[];
    chatMessages: any[];
    doctorReviews: any[];
  };
}

// Helper function to escape CSV values
function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Helper function to convert object to CSV row
function objectToCSVRow(obj: any, headers: string[]): string {
  return headers.map(header => escapeCSV(obj[header] || '')).join(',');
}

export function convertJsonToCSV(jsonData: ExportData): string {
  const csvLines: string[] = [];
  const { data } = jsonData;

  // 1. User Profile
  csvLines.push('=== USER PROFILE ===');
  csvLines.push('Field,Value');
  if (data.user) {
    Object.keys(data.user).forEach(key => {
      csvLines.push(`${escapeCSV(key)},${escapeCSV(data.user[key])}`);
    });
  }
  csvLines.push('');

  // 2. Cycles
  if (data.cycles && data.cycles.length > 0) {
    csvLines.push('=== CYCLES ===');
    const cycleHeaders = ['id', 'type', 'status', 'startDate', 'endDate', 'result', 'notes', 'createdAt'];
    csvLines.push(cycleHeaders.join(','));
    data.cycles.forEach(cycle => {
      csvLines.push(objectToCSVRow(cycle, cycleHeaders));
    });
    csvLines.push('');
  }

  // 3. Medications
  if (data.medications && data.medications.length > 0) {
    csvLines.push('=== MEDICATIONS ===');
    const medHeaders = ['id', 'cycleId', 'name', 'dosage', 'unit', 'frequency', 'startDate', 'endDate', 'notes'];
    csvLines.push(medHeaders.join(','));
    data.medications.forEach(med => {
      csvLines.push(objectToCSVRow(med, medHeaders));
    });
    csvLines.push('');
  }

  // 4. Medication Logs
  if (data.medicationLogs && data.medicationLogs.length > 0) {
    csvLines.push('=== MEDICATION LOGS ===');
    const logHeaders = ['id', 'medicationId', 'date', 'time', 'taken', 'notes'];
    csvLines.push(logHeaders.join(','));
    data.medicationLogs.forEach(log => {
      csvLines.push(objectToCSVRow(log, logHeaders));
    });
    csvLines.push('');
  }

  // 5. Symptoms
  if (data.symptoms && data.symptoms.length > 0) {
    csvLines.push('=== SYMPTOMS ===');
    const symptomHeaders = ['id', 'cycleId', 'date', 'type', 'severity', 'description', 'notes'];
    csvLines.push(symptomHeaders.join(','));
    data.symptoms.forEach(symptom => {
      csvLines.push(objectToCSVRow(symptom, symptomHeaders));
    });
    csvLines.push('');
  }

  // 6. Test Results
  if (data.testResults && data.testResults.length > 0) {
    csvLines.push('=== TEST RESULTS ===');
    const testHeaders = ['id', 'cycleId', 'date', 'testType', 'result', 'unit', 'notes'];
    csvLines.push(testHeaders.join(','));
    data.testResults.forEach(test => {
      csvLines.push(objectToCSVRow(test, testHeaders));
    });
    csvLines.push('');
  }

  // 7. Appointments
  if (data.appointments && data.appointments.length > 0) {
    csvLines.push('=== APPOINTMENTS ===');
    const appointmentHeaders = ['id', 'cycleId', 'date', 'time', 'type', 'location', 'notes', 'completed'];
    csvLines.push(appointmentHeaders.join(','));
    data.appointments.forEach(appointment => {
      csvLines.push(objectToCSVRow(appointment, appointmentHeaders));
    });
    csvLines.push('');
  }

  // 8. Milestones
  if (data.milestones && data.milestones.length > 0) {
    csvLines.push('=== MILESTONES ===');
    const milestoneHeaders = ['id', 'cycleId', 'name', 'date', 'status', 'startDate', 'endDate', 'notes'];
    csvLines.push(milestoneHeaders.join(','));
    data.milestones.forEach(milestone => {
      csvLines.push(objectToCSVRow(milestone, milestoneHeaders));
    });
    csvLines.push('');
  }

  // 9. Events
  if (data.events && data.events.length > 0) {
    csvLines.push('=== EVENTS ===');
    const eventHeaders = ['id', 'cycleId', 'eventType', 'title', 'date', 'time', 'description', 'notes'];
    csvLines.push(eventHeaders.join(','));
    data.events.forEach(event => {
      csvLines.push(objectToCSVRow(event, eventHeaders));
    });
    csvLines.push('');
  }

  // 10. Forum Posts
  if (data.forumPosts && data.forumPosts.length > 0) {
    csvLines.push('=== FORUM POSTS ===');
    const postHeaders = ['id', 'title', 'content', 'category', 'createdAt', 'updatedAt'];
    csvLines.push(postHeaders.join(','));
    data.forumPosts.forEach(post => {
      csvLines.push(objectToCSVRow(post, postHeaders));
    });
    csvLines.push('');
  }

  // 11. Forum Comments
  if (data.forumComments && data.forumComments.length > 0) {
    csvLines.push('=== FORUM COMMENTS ===');
    const commentHeaders = ['id', 'postId', 'content', 'createdAt'];
    csvLines.push(commentHeaders.join(','));
    data.forumComments.forEach(comment => {
      csvLines.push(objectToCSVRow(comment, commentHeaders));
    });
    csvLines.push('');
  }

  // 12. Chat Messages
  if (data.chatMessages && data.chatMessages.length > 0) {
    csvLines.push('=== CHAT MESSAGES ===');
    const chatHeaders = ['id', 'content', 'role', 'createdAt'];
    csvLines.push(chatHeaders.join(','));
    data.chatMessages.forEach(message => {
      csvLines.push(objectToCSVRow(message, chatHeaders));
    });
    csvLines.push('');
  }

  // 13. Doctor Reviews
  if (data.doctorReviews && data.doctorReviews.length > 0) {
    csvLines.push('=== DOCTOR REVIEWS ===');
    const reviewHeaders = ['id', 'doctorId', 'rating', 'comment', 'createdAt'];
    csvLines.push(reviewHeaders.join(','));
    data.doctorReviews.forEach(review => {
      csvLines.push(objectToCSVRow(review, reviewHeaders));
    });
  }

  return csvLines.join('\n');
}

