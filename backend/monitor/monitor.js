import http from 'http';
import https from 'https';
import net from 'net';
import dns from 'dns';
import { createRequire } from 'module';
import sovereign from '../config/sovereign.js';
import logger from '../utils/logger.js';

const require = createRequire(import.meta.url);
const LOG = 'SovereignMonitor';

// ─────────────────────────────────────────────────────────────────────────────
// SovereignMonitor
//
// * Intercepts outbound http/https/fetch, net.connect, and DNS resolution.
// * Classifies destinations as internal (loopback/private) or external.
// * In 'deny' mode, external destinations are BLOCKED at the process boundary.
// * Records real telemetry (not fabricated): every attempt, call, probe.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// IPv4/6 private, loopback and link-local classification using real IP parsing.
// A hostname is NEVER classified by string prefix (the old /^(fc|fd)/ regex could
// let an external host like "fc-server.example.net" slip past the egress guard).
function isPrivateIPv4(ip) {
  const p = ip.split('.');
  if (p.length !== 4) return false;
  const a = +p[0], b = +p[1];
  if (a === 0) return true;                                        // 0.0.0.0/8
  if (a === 127) return true;                                       // loopback
  if (a === 10) return true;                                        // 10/8
  if (a === 172 && b >= 16 && b <= 31) return true;                 // 172.16/12
  if (a === 192 && b === 168) return true;                          // 192.168/16
  if (a === 169 && b === 254) return true;                          // link-local
  return false;
}

function isPrivateIPv6(ip) {
  const h = String(ip).toLowerCase().split('%')[0];                 // strip zone id
  if (h === '::1' || h === '::' || h === '0:0:0:0:0:0:0:1') return 'loopback';
  if (h.startsWith('fc') || h.startsWith('fd')) return 'private';   // fc00::/7 ULA
  if (h.startsWith('fe80') || h.startsWith('fec0')) return 'private'; // link/local site-local
  return false;
}

export function classifyHost(host) {
  let raw = String(host || '').toLowerCase();
  // Strip [IPv6] brackets (optionally with :port after the bracket).
  const bracketed = raw.match(/^\[([^\]]+)\]/);
  if (bracketed) raw = bracketed[1];
  else if (/^[^:]+:\d+$/.test(raw) && !raw.includes('::')) raw = raw.slice(0, raw.lastIndexOf(':')); // host:port
  const h = raw.split('%')[0];                                        // strip IPv6 zone id
  if (!h) return 'internal';
  if (h === 'localhost' || h.endsWith('.localhost')) return 'loopback';
  const ipVer = net.isIP(h);
  if (ipVer === 4) return isPrivateIPv4(h) ? (h.startsWith('127') ? 'loopback' : 'private') : 'external';
  if (ipVer === 6) {
    // IPv4-mapped IPv6 literal (::ffff:a.b.c.d) → classify by the embedded IPv4.
    const mapped = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped) {
      const ip4 = mapped[1];
      return isPrivateIPv4(ip4) ? (ip4.startsWith('127') ? 'loopback' : 'private') : 'external';
    }
    const v6 = isPrivateIPv6(h);
    if (v6) return v6;
    return 'external';
  }
  // Not an IP literal → a real hostname. External by default (deny mode blocks
  // it). DNS rebinding is neutralised because external hostname lookups are
  // themselves blocked before resolution in deny mode.
  return 'external';
}

class SovereignMonitor {
  constructor() {
    this.state = {
      mode: sovereign.mode,
      egressMode: sovereign.network.egressMode,
      gateway: sovereign.provider.baseUrl,
      startedAt: Date.now(),
      counters: {
        externalApiCalls: 0,
        externalDnsRequests: 0,
        blockedEgress: 0,
        localModelCalls: 0,
        cloudModelCalls: 0,
        localDbCalls: 0,
        totalEgressAttempts: 0,
        probes: 0,
      },
      probes: { internetConnected: null, lastProbeAt: null, latencyMs: null, disabled: !sovereign.network.probeEnabled },
      recentEvents: [],
    };
    this.patched = false;
    this.db = null;
    this._orig = {
      fetch: null,
      httpRequest: http.request,
      httpsRequest: https.request,
      connect: net.connect,
      createConnection: net.createConnection,
      lookup: dns.lookup, resolve: dns.resolve, resolve4: dns.resolve4, resolve6: dns.resolve6, lookupService: dns.lookupService,
    };
  }

  _db() {
    if (!this.db) {
      try { this.db = (require('../storage/sovereignDB.js')).getSovereignDB(); }
      catch { this.db = { recordSovereignty: () => {} }; }
    }
    return this.db;
  }

  pushEvent(event) {
    this.state.recentEvents.unshift({ ...event, at: new Date().toISOString() });
    if (this.state.recentEvents.length > 200) this.state.recentEvents.length = 200;
    try { this._db().recordSovereignty(event); } catch { /* non-fatal */ }
  }

  _record({ type, destination = '', provider = '', success = true, blocked = false, detail = {} }) {
    const c = this.state.counters;
    if (type === 'egress_attempt') {
      c.totalEgressAttempts++;
      if (blocked) c.blockedEgress++;
      else c.externalApiCalls++;
    } else if (type === 'dns_request') {
      c.externalDnsRequests++;
      if (blocked) c.blockedEgress++;
    } else if (type === 'local_model') {
      c.localModelCalls++;
    } else if (type === 'cloud_model') {
      c.cloudModelCalls++;
    } else if (type === 'local_db') {
      c.localDbCalls++;
    }
    if (type === 'egress_attempt' || type === 'dns_request') {
      this.pushEvent({ eventType: blocked ? 'egress_block' : 'egress_attempt', destination, provider, success, detail });
      if (blocked) logger.warn(LOG, `EGRESS BLOCKED → ${destination}`, { detail });
    } else if (type === 'probe') {
      this.pushEvent({ eventType: 'probe', destination, provider, success: success !== false, detail });
    } else if (type === 'local_model') {
      this.pushEvent({ eventType: 'local_model', destination: sovereign.provider.baseUrl, provider, success: success !== false, detail });
    }
  }

  // ── process-boundary egress guard ──────────────────────────────────────
  init() {
    if (this.patched) return;
    const deny = this.state.egressMode === 'deny';

    const guardHost = (host, what) => {
      const cls = classifyHost(host);
      if (cls === 'external') {
        const allow = sovereign.network.externalAllowlist.includes(String(host).toLowerCase());
        if (!allow) {
          this._record({ type: 'egress_attempt', destination: host, blocked: deny, detail: { what } });
          if (deny) {
            const err = new Error(`Sovereign egress guard: outbound ${what} to external host "${host}" is DENIED in air-gapped mode.`);
            err.code = 'SOVEREIGN_EGRESS_DENIED';
            err.sovereignBlocked = true;
            throw err;
          }
        }
      }
    };

    // fetch (used by the local provider + all modern libs)
    const origFetch = globalThis.fetch;
    this._orig.fetch = origFetch;
    if (origFetch) {
      globalThis.fetch = async (input, init) => {
        let host = '';
        try {
          const url = typeof input === 'string' ? new URL(input) : input?.url ? new URL(input.url) : (input instanceof URL ? input : new URL(String(input?.pathname || ''), 'http://x'));
          host = url.hostname;
        } catch { host = String(input?.hostname || ''); }
        guardHost(host, 'fetch');
        return origFetch(input, init);
      };
    }

    // http/https.request
    const guardReq = (wrapped, kind) => function (urlOrOptions, ...rest) {
      let host = '';
      if (typeof urlOrOptions === 'string') { try { host = new URL(urlOrOptions).hostname; } catch {} }
      else if (urlOrOptions?.hostname) host = urlOrOptions.hostname;
      else if (urlOrOptions?.host) host = urlOrOptions.host;
      else if (urlOrOptions?.href) { try { host = new URL(urlOrOptions.href).hostname; } catch {} }
      guardHost(host, `${kind} request`);
      return wrapped.call(this, urlOrOptions, ...rest);
    };
    http.request = guardReq(http.request, 'http');
    https.request = guardReq(https.request, 'https');

    // net.connect / createConnection
    const guardNet = (wrapped) => function (options, ...rest) {
      let host = '';
      if (typeof options === 'object' && options?.host) host = options.host;
      else if (typeof options === 'string') host = options;
      guardHost(host, 'TCP connect');
      return wrapped.call(this, options, ...rest);
    };
    net.connect = guardNet(net.connect);
    net.createConnection = guardNet(net.createConnection);

    // dns — record external lookups
    const wrapDns = (fn, kind) => function (hostname, ...rest) {
      const cls = classifyHost(hostname);
      if (cls === 'external') {
        this._record({ type: 'dns_request', destination: hostname, blocked: deny, detail: { kind } });
        if (deny) {
          const err = new Error(`Sovereign egress guard: outbound DNS lookup for "${hostname}" is DENIED in air-gapped mode.`);
          err.code = 'SOVEREIGN_EGRESS_DENIED';
          err.sovereignBlocked = true;
          const cb = rest.find(a => typeof a === 'function');
          if (cb) {
            process.nextTick(() => cb(err));
            return;
          }
          throw err;
        }
      }
      return fn.call(this, hostname, ...rest);
    }.bind(this);
    dns.lookup = wrapDns(dns.lookup, 'lookup');
    dns.resolve = wrapDns(dns.resolve, 'resolve');
    dns.resolve4 = wrapDns(dns.resolve4, 'resolve4');
    dns.resolve6 = wrapDns(dns.resolve6, 'resolve6');
    dns.lookupService = wrapDns(dns.lookupService, 'lookupService');

    // dns.promises — same guard for the promise-flavoured API (separate receiver)
    const pDNS = dns.promises;
    const wrapDnsP = (fn, kind) => async (hostname, ...rest) => {
      if (typeof hostname === 'string') guardHost(hostname, `${kind} (promise)`);
      return fn.call(pDNS, hostname, ...rest);
    };
    pDNS.lookup = wrapDnsP(pDNS.lookup, 'lookup');
    pDNS.resolve = wrapDnsP(pDNS.resolve, 'resolve');
    pDNS.resolve4 = wrapDnsP(pDNS.resolve4, 'resolve4');
    pDNS.resolve6 = wrapDnsP(pDNS.resolve6, 'resolve6');

    this.patched = true;
    logger.info(LOG, `Egress guard active (mode=${this.state.egressMode})`);
  }

  // Local model activity is recorded by providers.
  recordLocalModelCall({ provider, success = true, detail = {}, durationMs }) {
    this._record({ type: 'local_model', provider, success, detail: { ...detail, durationMs } });
  }
  recordCloudModelCall({ success = true, detail = {} }) {
    this._record({ type: 'cloud_model', provider: 'gemini', success, detail });
  }
  recordDbCall({ ok = true }) {
    this.state.counters.localDbCalls++;
    return ok;
  }

  // REAL connectivity probe via TCP connect with short timeout.
  async probeInternet() {
    if (!sovereign.network.probeEnabled) {
      this.state.probes = { internetConnected: null, disabled: true };
      return this.state.probes;
    }
    const targets = sovereign.network.probeTargets;
    const results = [];
    for (const target of targets) {
      const [host, port] = target.split(':');
      const t0 = Date.now();
      const ok = await new Promise((resolve) => {
        const sock = this._orig.connect({ host, port: parseInt(port, 10) || 53 }, () => { sock.destroy(); resolve(true); });
        sock.on('error', () => { sock.destroy(); resolve(false); });
        sock.setTimeout(sovereign.network.probeTimeoutMs, () => { sock.destroy(); resolve(false); });
      });
      results.push({ target, reachable: ok, latencyMs: Date.now() - t0 });
    }
    const connected = results.some(r => r.reachable);
    this.state.probes = { internetConnected: connected, lastProbeAt: new Date().toISOString(), latencyMs: results.filter(r => r.reachable).reduce((m, r) => Math.min(m, r.latencyMs), 0) || null, targets: results };
    this.state.counters.probes++;
    this._record({ type: 'probe', destination: 'internet', success: connected, detail: { targets: results } });
    return this.state.probes;
  }

  getStatus() {
    return {
      mode: this.state.mode,
      egressMode: this.state.egressMode,
      internetConnectivity: this.state.probes.internetConnected,
      internetDisabled: this.state.probes.disabled || undefined,
      lastProbeAt: this.state.probes.lastProbeAt,
      gateway: this.state.gateway,
      gatewayOpenAICompat: sovereign.provider.openaiCompat,
      counters: { ...this.state.counters },
      uptimeSec: Math.round((Date.now() - this.state.startedAt) / 1000),
      recentEvents: this.state.recentEvents.slice(0, 50),
      localServices: this.localServices(),
    };
  }

  localServices() {
    const gw = (new URL(sovereign.provider.baseUrl)).port || '11434';
    return [
      { name: 'LLM / Embeddings (local gateway)', endpoint: `127.0.0.1:${gw}`, kind: 'local_inference' },
      { name: 'RAG (SQLite + BM25)', endpoint: '127.0.0.1 (in-process)', kind: 'local_retrieval' },
      { name: 'OCR', endpoint: sovereign.network.egressMode === 'deny' ? 'in-process (local engines)' : 'in-process (local engines)', kind: 'local_ocr' },
      { name: 'Vector DB', endpoint: sovereign.storage.sqlitePath.replace(/\\/g, '/'), kind: 'local_vectorstore' },
      { name: 'Agent runtime / API', endpoint: process.env.PORT ? `127.0.0.1:${process.env.PORT}` : '127.0.0.1:5000', kind: 'local_api' },
    ];
  }
}

let _monitor = null;
export const monitor = () => (_monitor || (_monitor = new SovereignMonitor()));
export default monitor;