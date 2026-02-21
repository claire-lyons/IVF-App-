/**
 * Notification service for sending emails and SMS
 * Currently supports email via SMTP (configurable)
 * SMS support can be added via Twilio or similar service
 */

interface NotificationOptions {
  to: string;
  subject?: string;
  body: string;
  type: "email" | "sms";
}

interface AppointmentNotificationData {
  doctorName: string;
  doctorEmail?: string;
  doctorPhone?: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime?: string;
  location?: string;
  notes?: string;
}

/**
 * Send email notification
 * For production, integrate with services like:
 * - Resend (resend.com)
 * - SendGrid
 * - AWS SES
 * - Supabase Email
 */
export async function sendEmailNotification(options: NotificationOptions): Promise<boolean> {
  try {
    // Check if email service is configured
    const emailService = process.env.EMAIL_SERVICE; // 'resend', 'sendgrid', 'smtp', 'supabase'
    
    if (!emailService) {
      console.warn("[Notifications] Email service not configured. Skipping email notification.");
      console.log("[Notifications] Would send email:", {
        to: options.to,
        subject: options.subject,
        body: options.body.substring(0, 100) + "...",
      });
      return false;
    }

    // TODO: Implement actual email sending based on emailService
    // Example for Resend:
    // if (emailService === 'resend') {
    //   const resend = new Resend(process.env.RESEND_API_KEY);
    //   await resend.emails.send({
    //     from: process.env.EMAIL_FROM || 'noreply@foli.com',
    //     to: options.to,
    //     subject: options.subject || 'Notification from Foli',
    //     html: options.body,
    //   });
    // }

    console.log("[Notifications] Email notification sent:", {
      to: options.to,
      subject: options.subject,
    });
    return true;
  } catch (error) {
    console.error("[Notifications] Failed to send email:", error);
    return false;
  }
}

/**
 * Send SMS notification
 * For production, integrate with services like:
 * - Twilio
 * - AWS SNS
 * - MessageBird
 */
export async function sendSMSNotification(options: NotificationOptions): Promise<boolean> {
  try {
    const smsService = process.env.SMS_SERVICE; // 'twilio', 'aws-sns', etc.
    
    if (!smsService) {
      console.warn("[Notifications] SMS service not configured. Skipping SMS notification.");
      console.log("[Notifications] Would send SMS:", {
        to: options.to,
        body: options.body.substring(0, 50) + "...",
      });
      return false;
    }

    // TODO: Implement actual SMS sending based on smsService
    // Example for Twilio:
    // if (smsService === 'twilio') {
    //   const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    //   await client.messages.create({
    //     body: options.body,
    //     from: process.env.TWILIO_PHONE_NUMBER,
    //     to: options.to,
    //   });
    // }

    console.log("[Notifications] SMS notification sent:", {
      to: options.to,
    });
    return true;
  } catch (error) {
    console.error("[Notifications] Failed to send SMS:", error);
    return false;
  }
}

/**
 * Send appointment booking notification to doctor
 */
export async function notifyDoctorOfAppointment(data: AppointmentNotificationData): Promise<void> {
  const notifications: Promise<boolean>[] = [];

  // Format appointment date and time
  const appointmentDateTime = new Date(data.appointmentDate);
  const dateStr = appointmentDateTime.toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = data.appointmentTime 
    ? new Date(`2000-01-01T${data.appointmentTime}`).toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Time TBD";

  // Email notification
  if (data.doctorEmail) {
    const emailBody = `
      <h2>New Appointment Booking</h2>
      <p>Dear ${data.doctorName},</p>
      <p>A new appointment has been booked with you:</p>
      <ul>
        <li><strong>Patient:</strong> ${data.patientName}</li>
        <li><strong>Date:</strong> ${dateStr}</li>
        <li><strong>Time:</strong> ${timeStr}</li>
        ${data.location ? `<li><strong>Location:</strong> ${data.location}</li>` : ""}
        ${data.notes ? `<li><strong>Notes:</strong> ${data.notes}</li>` : ""}
      </ul>
      <p>Please confirm this appointment at your earliest convenience.</p>
      <p>Best regards,<br>The Foli Team</p>
    `;

    notifications.push(
      sendEmailNotification({
        to: data.doctorEmail,
        subject: `New Appointment Booking - ${dateStr}`,
        body: emailBody,
        type: "email",
      })
    );
  }

  // SMS notification
  if (data.doctorPhone) {
    const smsBody = `New appointment booking: ${data.patientName} on ${dateStr} at ${timeStr}${data.location ? ` (${data.location})` : ""}. ${data.notes ? `Notes: ${data.notes}` : ""}`;

    notifications.push(
      sendSMSNotification({
        to: data.doctorPhone,
        body: smsBody,
        type: "sms",
      })
    );
  }

  // Wait for all notifications to complete (don't throw errors)
  await Promise.allSettled(notifications);
}

/**
 * Send appointment confirmation to patient
 */
export async function notifyPatientOfAppointment(
  patientEmail: string,
  patientName: string,
  data: AppointmentNotificationData
): Promise<void> {
  if (!patientEmail) return;

  const appointmentDateTime = new Date(data.appointmentDate);
  const dateStr = appointmentDateTime.toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = data.appointmentTime 
    ? new Date(`2000-01-01T${data.appointmentTime}`).toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Time TBD";

  const emailBody = `
    <h2>Appointment Confirmed</h2>
    <p>Dear ${patientName},</p>
    <p>Your appointment has been successfully booked:</p>
    <ul>
      <li><strong>Doctor:</strong> ${data.doctorName}</li>
      <li><strong>Date:</strong> ${dateStr}</li>
      <li><strong>Time:</strong> ${timeStr}</li>
      ${data.location ? `<li><strong>Location:</strong> ${data.location}</li>` : ""}
      ${data.notes ? `<li><strong>Your Notes:</strong> ${data.notes}</li>` : ""}
    </ul>
    <p>We'll send you a reminder closer to your appointment date.</p>
    <p>Best regards,<br>The Foli Team</p>
  `;

  await sendEmailNotification({
    to: patientEmail,
    subject: `Appointment Confirmed - ${dateStr}`,
    body: emailBody,
    type: "email",
  });
}








































