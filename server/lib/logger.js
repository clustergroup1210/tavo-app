const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;
const useJson = process.env.NODE_ENV === 'production' || process.env.LOG_FORMAT === 'json';
const service = process.env.LOG_SERVICE || 'tavo-app';

function emit(level, msg, meta) {
  if (LEVELS[level] < minLevel) return;
  const record = {
    ts: new Date().toISOString(),
    level,
    service,
    msg,
    ...(meta && typeof meta === 'object' ? meta : {}),
  };
  const line = useJson ? JSON.stringify(record) : `[${record.ts}] ${level.toUpperCase()} ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`;
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

module.exports = {
  debug: (msg, meta) => emit('debug', msg, meta),
  info: (msg, meta) => emit('info', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  error: (msg, meta) => emit('error', msg, meta),
};
