const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

const typeToSettingMap = {
  EVALUATION: 'notifyEvaluation',
  SELF_EVALUATION: 'notifySelfEvaluation',
  TASK: 'notifyTask',
  VIDEO_COMMENT: 'notifyComment',
  CALENDAR: 'notifyCalendar',
  ANNOUNCEMENT: 'notifyAnnouncement'
};

function getSystemDefaults() {
  try {
    const settingsFile = path.join(__dirname, '..', 'data', 'system-settings.json');
    if (fs.existsSync(settingsFile)) {
      const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      return {
        notifyEvaluation: settings.defaultNotifyEvaluation ?? true,
        notifySelfEvaluation: settings.defaultNotifySelfEvaluation ?? true,
        notifyTask: settings.defaultNotifyTask ?? true,
        notifyComment: settings.defaultNotifyComment ?? true,
        notifyCalendar: settings.defaultNotifyCalendar ?? true,
        notifyAnnouncement: settings.defaultNotifyAnnouncement ?? true,
        enableEmail: settings.defaultEnableEmail ?? true,
      };
    }
  } catch (e) {}
  return {};
}

async function getOrCreateSettings(userId) {
  let settings = await prisma.notificationSetting.findUnique({
    where: { userId }
  });
  
  if (!settings) {
    const defaults = getSystemDefaults();
    settings = await prisma.notificationSetting.create({
      data: { userId, ...defaults }
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

    try {
      const { sendPushToUser } = require('./pushService');
      await sendPushToUser(userId, { type, title, message, linkUrl });
    } catch (e) {
      console.error('[notification] push error:', e?.message || e);
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
