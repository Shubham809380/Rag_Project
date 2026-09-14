// Safe arithmetic expression evaluator. No eval().
// Supports + - * / ^ % ( ) and parentheses, plus basic math functions.

const FUNCS = {
  sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log, log10: Math.log10,
  min: (...a) => Math.min(...a), max: (...a) => Math.max(...a),
  pi: () => Math.PI, e: () => Math.E,
};

export function safeCalculate(expression) {
  try {
    const tokens = tokenize(expression);
    if (!tokens) return { success: false, error: 'Invalid expression' };
    const parser = new Parser(tokens);
    const value = parser.parseExpression();
    if (!Number.isFinite(value)) return { success: false, error: 'Result is not a finite number' };
    return { success: true, result: round(value) };
  } catch (err) {
    return { success: false, error: err.message || 'Calculation failed' };
  }
}

function tokenize(expr) {
  // strip commas
  const s = String(expr).replace(/,/g, ' ');
  const re = /\s*(\d+\.?\d*|\.\d+|[A-Za-z]+|[-+*/^%()])\s*/g;
  const tokens = [];
  let m;
  let last = 0;
  // validate we consume the whole string
  const trimmed = s.replace(/\s+/g, '');
  const consumed = [];
  while ((m = re.exec(s)) !== null) {
    consumed.push(m[1]);
  }
  const joined = consumed.join('');
  // Allowed alphabet: digits, operators, parens, function names
  if (!/^[0-9+\-*/^%().A-Za-z]+$/.test(trimmed)) return null;
  return consumed;
}

function round(n) {
  return Math.round(n * 1e10) / 1e10;
}

class Parser {
  constructor(tokens) { this.tokens = tokens; this.pos = 0; }
  peek() { return this.tokens[this.pos]; }
  next() { return this.tokens[this.pos++]; }
  expect(val) {
    const t = this.next();
    if (t !== val) throw new Error(`Expected ${val}`);
  }
  parseExpression() { return this.parseTerm(); }
  parseTerm() {
    let left = this.parseFactor();
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.next();
      const right = this.parseFactor();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }
  parseFactor() {
    let left = this.parseUnary();
    while (this.peek() === '*' || this.peek() === '/' || this.peek() === '%') {
      const op = this.next();
      const right = this.parseUnary();
      if (op === '*') left = left * right;
      else if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        left = left / right;
      } else left = left % right;
    }
    return left;
  }
  parseUnary() {
    if (this.peek() === '-') { this.next(); return -this.parseUnary(); }
    if (this.peek() === '+') { this.next(); return this.parseUnary(); }
    return this.parsePower();
  }
  parsePower() {
    const base = this.parsePrimary();
    if (this.peek() === '^') { this.next(); const exp = this.parseUnary(); return Math.pow(base, exp); }
    return base;
  }
  parsePrimary() {
    const t = this.peek();
    if (t === undefined) throw new Error('Unexpected end of expression');
    if (t === '(') {
      this.next();
      const v = this.parseExpression();
      this.expect(')');
      return v;
    }
    if (/^\d/.test(t)) { this.next(); return parseFloat(t); }
    if (/^[A-Za-z]/.test(t)) {
      this.next();
      if (this.peek() === '(') {
        if (!FUNCS[t.toLowerCase()]) throw new Error(`Unknown function: ${t}`);
        this.next();
        const args = [];
        if (this.peek() !== ')') {
          args.push(this.parseExpression());
          while (this.peek() === ',') { this.next(); args.push(this.parseExpression()); }
        }
        this.expect(')');
        return FUNCS[t.toLowerCase()](...args);
      }
      if (FUNCS[t.toLowerCase()]) return FUNCS[t.toLowerCase()]();
      throw new Error(`Unknown constant: ${t}`);
    }
    throw new Error(`Unexpected token: ${t}`);
  }
}
