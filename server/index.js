const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const authGoogleRoutes = require('./routes/authGoogle');
const teamRoutes = require('./routes/teams');
const playerRoutes = require('./routes/players');
const evaluationRoutes = require('./routes/evaluations');
const userRoutes = require('./routes/users');
const invitationRoutes = require('./routes/invitations');
const appealRoutes = require('./routes/appeals');
const videoRoutes = require('./routes/videos');
const organizationRoutes = require('./routes/organizations');
const adminRoutes = require('./routes/admin');
const goalRoutes = require('./routes/goals');
const calendarRoutes = require('./routes/calendar');
const eventLocationRoutes = require('./routes/eventLocations');
const announcementRoutes = require('./routes/announcements');
const teamCategoryRoutes = require('./routes/teamCategories');
const joinRequestRoutes = require('./routes/joinRequests');
const notificationRoutes = require('./routes/notifications');
const playerDashboardRoutes = require('./routes/playerDashboard');
const transferRoutes = require('./routes/transfers');
const coachAssignmentRoutes = require('./routes/coachAssignments');
const videoCommentRoutes = require('./routes/videoComments');
const taskRoutes = require('./routes/tasks');
const evaluationMatrixRoutes = require('./routes/evaluationMatrix');
const evaluationTemplateRoutes = require('./routes/evaluationTemplate');
const mentoringRoutes = require('./routes/mentoring');
const teamInvitationRoutes = require('./routes/teamInvitations');
const pushRoutes = require('./routes/push');

const app = express();
app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === 'production';
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "*"],
      connectSrc: ["'self'", "*"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  } : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 10 * 60 * 1000,
  },
}));
app.use(passport.initialize());
app.use(passport.session());
app.use('/uploads/logos', express.static(path.join(__dirname, '../uploads')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/auth', authGoogleRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/appeals', appealRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/event-locations', eventLocationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/team-categories', teamCategoryRoutes);
app.use('/api/join-requests', joinRequestRoutes);
app.use('/api/team-registration-requests', require('./routes/teamRegistrationRequests'));
app.use('/api/notifications', notificationRoutes);
app.use('/api/player-dashboard', playerDashboardRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/coach-assignments', coachAssignmentRoutes);
app.use('/api/video-comments', videoCommentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/evaluation-matrix', evaluationMatrixRoutes);
app.use('/api/evaluation-templates', evaluationTemplateRoutes);
app.use('/api/mentoring', mentoringRoutes);
app.use('/api/team-invitations', teamInvitationRoutes);
app.use('/api/push', pushRoutes);

app.get('/healthz', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// クライアントビルドが存在すれば配信（本番EC2想定）。
// Vite dev サーバーを別に動かす開発時は client/dist が無いのでスキップされる。
const fs = require('fs');
const clientDistPath = path.join(__dirname, '../client/dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');
if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(clientIndexPath);
  });
  console.log(`📦 Serving client build from ${clientDistPath}`);
} else {
  console.log(`ℹ️  No client build found at ${clientDistPath} (skipping static serving)`);
}

const logger = require('./lib/logger');
const prisma = require('./lib/prisma');
const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected');
    logger.info('database.connected', { provider: 'postgresql' });
  } catch (error) {
    console.error('❌ PostgreSQL connection failed', error);
    logger.error('database.connection_failed', { message: error?.message });
    // 本番では起動失敗とする。開発では警告のみ（RDS/ローカルDB未到達でもUI開発を継続できるように）
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️  Continuing without DB (NODE_ENV != production). API calls touching the DB will error.');
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info('server.started', { port: Number(PORT), env: process.env.NODE_ENV || 'development' });
  });

  const shutdown = async (signal) => {
    logger.info('server.shutdown', { signal });
    server.close(() => {});
    try { await prisma.$disconnect(); } catch (_) {}
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();

process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', { reason: reason && reason.message ? reason.message : String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', { message: err.message, stack: err.stack });
});
