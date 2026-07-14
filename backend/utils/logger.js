const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL || 'info'];

function formatTimestamp() {
  return new Date().toISOString();
}

function log(level, component, message, data = {}) {
  if (LEVELS[level] < currentLevel) return;
  const timestamp = formatTimestamp();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${component}]`;
  const dataStr = Object.keys(data).length > 0 ? ' ' + JSON.stringify(data) : '';
  const line = `${prefix} ${message}${dataStr}`;

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

const logger = {
  debug: (component, msg, data) => log('debug', component, msg, data),
  info: (component, msg, data) => log('info', component, msg, data),
  warn: (component, msg, data) => log('warn', component, msg, data),
  error: (component, msg, data) => log('error', component, msg, data),

  timing: (component, label, startMs) => {
    const elapsed = Date.now() - startMs;
    log('info', component, `${label} completed in ${elapsed}ms`);
    return elapsed;
  },

  stage: (component, stage, data = {}) => {
    log('info', component, `[STAGE] ${stage}`, data);
  },
};

export default logger;
