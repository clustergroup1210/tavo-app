const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const typeToSettingMap = {
  EVALUATION: 'notifyEvaluation',
  SELF_EVALUATION: 'notifySelfEvaluation',
  TASK: 'notifyTask',
  VIDEO_COMMENT: 'notifyComment',
  CALENDAR: 'notifyCalendar',
  ANNOUNCEMENT: 'notifyAnnouncement'
};

async function getOrCreateSettings(userId) {
  let settings = await prisma.notificationSetting.findUnique({
    where: { userId }
  });
  
  if (!settings) {
    settings = await prisma.notificationSetting.create({
      data: { userId }
    });
  }
  
  return settings;
}

async function createNotification({ userId, type, title, message, linkUrl }) {
  try {
    const settings = await getOrCreateSettings(userId);
    
    const settingKey = typeToSettingMap[type];
    if (settingKey && settings[settingKey] === false) {
      console.log(`Notification skipped: User ${userId} has ${type} notifications disabled`);
      return null;
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        linkUrl
      }
    });

    if (settings.enableEmail) {
      await sendEmailNotification(userId, { type, title, message, linkUrl });
    }

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

async function sendEmailNotification(userId, { type, title, message, linkUrl }) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true }
    });

    if (!user) return;

    console.log(`[EMAIL MOCK] To: ${user.email}`);
    console.log(`[EMAIL MOCK] Subject: ${title}`);
    console.log(`[EMAIL MOCK] Body: ${message}`);
    if (linkUrl) {
      console.log(`[EMAIL MOCK] Link: ${linkUrl}`);
    }
    console.log('---');
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
}

async function createBulkNotifications(notifications) {
  const results = [];
  for (const notif of notifications) {
    const result = await createNotification(notif);
    if (result) results.push(result);
  }
  return results;
}

module.exports = {
  createNotification,
  createBulkNotifications,
  getOrCreateSettings
};
