// Static code guard — a first line of defence before sandbox execution.
// This is layered with the container sandbox; it is NOT sufficient alone.
// Blocked: network, host OS access, reflection, credentials/secret-file reads.

const BLOCKED_IMPORTS = [
  'os', 'sys', 'subprocess', 'socket', 'requests', 'urllib', 'http',
  'ftp', 'telnet', 'socketserver', 'ctypes', 'cffi', 'importlib', 'pkgutil',
  'pathlib', 'shutil', 'pickle', 'marshal', 'tempfile', 'multiprocessing', 'threading',
  'webbrowser', 'getpass', 'keyring', 'shelve', 'dbm', 'winreg', 'pty', 'fcntl',
  'boto3', 'paramiko', 'redis', 'mysql', 'psycopg', 'sqlite3', 'openpyxl.something', 'excel',
  'builtins', 'gc', 'codecs', 'locale',
];

const BLOCKED_PATTERNS = [
  /\b(import|from)\s+(os|subprocess|socket|ctypes|importlib|pathlib)\b/,
  /\b(open|compile|eval|exec)\s*\(/,
  /\b(__import__|import_module)\b/,
  /\.(import_module|__import__)\s*\(/,
  /\b(getenv|environ|popen|system|fork|execv|os\.)\b/,
  /\brequests\.\w+\s*\(/,
  /\b(urllib|urllib3|http\.client|http\.server)\b/,
  /\.(pyc|pyd|so)\b/,
  /#\s*(pragma|shebang)/i,
];

const MAX_CODE_LEN = 20_000;
const MAX_TEST_ASSERTIONS = 400;

export function guardCode(code) {
  const issues = [];
  const text = String(code || '');
  if (!text.trim()) return { ok: false, issues: ['empty code'] };
  if (text.length > MAX_CODE_LEN) issues.push(`code exceeds ${MAX_CODE_LEN} chars`);
  const lowered = text.toLowerCase();
  for (const imp of BLOCKED_IMPORTS) {
    const re = new RegExp(`\\b(?:import|from)\\s+${imp.replace('+', '\\+')}\\b`, 'i');
    if (re.test(text)) issues.push(`blocked import: ${imp}`);
  }
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(text)) issues.push(`blocked pattern: ${p}`);
  }
  if (issues.length) return { ok: false, issues };
  return { ok: true, charCount: text.length };
}

export function guardTests(testCode) {
  const issues = [];
  const text = String(testCode || '');
  const reqRe = /\b(import|from)\s+(pytest|unittest|ctypes|socket|os)\b/;
  if (reqRe.test(text)) issues.push('blocked test import');
  let assertCount = (text.match(/\bassert\b/g) || []).length;
  if (assertCount > MAX_TEST_ASSERTIONS) issues.push(`too many assertions (${assertCount})`);
  return issues.length ? { ok: false, issues } : { ok: true };
}