const express = require('express');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { JWT_SECRET } = require('../middleware/auth');
const { resolveUserCode } = require('../services/userCode');

const router = express.Router();
const prisma = new PrismaClient();

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
  APP_URL,
} = process.env;

const isConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

function resolveAppUrl(req) {
  if (APP_URL) return APP_URL;
  if (process.env.NODE_ENV === 'production') return 'https://app.ta-vo.jp';
  const host = req?.get?.('host');
  const proto = req?.protocol || 'https';
  return host ? `${proto}://${host}` : 'http://localhost:5000';
}

function resolveCallbackUrl(req) {
  if (GOOGLE_CALLBACK_URL) return GOOGLE_CALLBACK_URL;
  return `${resolveAppUrl(req)}/api/auth/google/callback`;
}

if (isConfigured) {
  passport.use(new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        if (!email) {
          return done(new Error('Googleアカウントからメールアドレスを取得できませんでした'));
        }
        const displayName = profile.displayName || email.split('@')[0];
        const avatarUrl = profile.photos?.[0]?.value || null;

        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          const randomPassword = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const userCode = await resolveUserCode(prisma, null);
              user = await prisma.user.create({
                data: {
                  email,
                  password: randomPassword,
                  name: displayName,
                  avatarUrl,
                  userCode,
                },
              });
              break;
            } catch (err) {
              const isUserCodeConflict = err?.code === 'P2002' &&
                (Array.isArray(err.meta?.target)
                  ? err.meta.target.includes('userCode')
                  : String(err.meta?.target || '').includes('userCode'));
              if (isUserCodeConflict && attempt < 4) continue;
              throw err;
            }
          }
        } else if (!user.avatarUrl && avatarUrl) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { avatarUrl },
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}

router.get('/google', (req, res, next) => {
  if (!isConfigured) {
    return res.status(503).json({ error: 'Google OAuth が設定されていません' });
  }
  const callbackURL = resolveCallbackUrl(req);
  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    callbackURL,
    state: true,
  })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  if (!isConfigured) {
    return res.redirect('/login?error=google_not_configured');
  }
  const callbackURL = resolveCallbackUrl(req);
  passport.authenticate('google', { session: false, callbackURL }, async (err, user) => {
    if (err || !user) {
      console.error('Google OAuth callback error:', err?.message || 'no user');
      return res.redirect('/login?error=google_auth_failed');
    }
    try {
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }).catch(() => {});

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('token', token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'none',
        secure: true,
      });
      return res.redirect('/dashboard');
    } catch (e) {
      console.error('Google OAuth post-auth error:', e);
      return res.redirect('/login?error=google_auth_failed');
    }
  })(req, res, next);
});

router.get('/google/status', (req, res) => {
  res.json({ enabled: isConfigured });
});

module.exports = router;
