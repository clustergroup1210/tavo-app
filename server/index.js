const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
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
app.use('/uploads/logos', express.static(path.join(__dirname, '../uploads')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
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
app.use('/api/announcements', announcementRoutes);
app.use('/api/team-categories', teamCategoryRoutes);
app.use('/api/join-requests', joinRequestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/player-dashboard', playerDashboardRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/coach-assignments', coachAssignmentRoutes);
app.use('/api/video-comments', videoCommentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/evaluation-matrix', evaluationMatrixRoutes);
app.use('/api/evaluation-templates', evaluationTemplateRoutes);
app.use('/api/mentoring', mentoringRoutes);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
