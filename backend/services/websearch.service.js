import config from '../config/index.js';

// Lazy accessor: reads globalThis.fetch at call time so the egress monitor's
// process-boundary patch is always effective. The module-scope capture captured
// the ORIGINAL fetch before the monitor patched globalThis.fetch.
function fetchGlobal(...args) { return globalThis.fetch(...args); }
const MAX_RESULTS = 8;

// AbortSignal.timeout polyfill (Node <17.3)
function timeoutSignal(ms) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(new Error('timeout')), ms);
  return ctrl.signal;
}

// SSRF guard: only http(s), reject private/reserved IP ranges and localhost.
function isHttpUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const hostname = u.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local')) return false;
    // basic reserved-range check via DNS-agnostic IP literal check
    const isIp = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(hostname);
    if (isIp) {
      const parts = hostname.split('.').map(Number);
      const [a, b] = parts;
      if (a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || a === 0 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function cleanSnippet(s) {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
}

function dedupe(results) {
  const seen = new Set();
  const out = [];
  for (const r of results) {
    const key = (r.url || r.link || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

// DuckDuckGo html endpoint (no API key required)
async function searchDuckDuckGo(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetchGlobal(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SovereignAIWorkbench/1.0)' },
    signal: timeoutSignal(15000),
  });
  const html = await res.text();
  const results = [];
  const resultRe = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/g;
  let m;
  while ((m = resultRe.exec(html)) && results.length < MAX_RESULTS) {
    let href = m[1].replace(/&amp;/g, '&');
    // DDG wraps redirects
    const uddg = href.match(/uddg=([^&]+)/);
    if (uddg) { try { href = decodeURIComponent(uddg[1]); } catch {} }
    if (!isHttpUrl(href)) continue;
    const title = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
    results.push({ title, url: href, snippet: cleanSnippet(m[3]) });
  }
  // fallback parse if class regex didn't match
  if (results.length === 0) {
    const linkRe = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g;
    while ((m = linkRe.exec(html)) && results.length < MAX_RESULTS) {
      let href = m[1].replace(/&amp;/g, '&');
      const uddg = href.match(/uddg=([^&]+)/);
      if (uddg) { try { href = decodeURIComponent(uddg[1]); } catch {} }
      if (!isHttpUrl(href)) continue;
      results.push({ title: m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim(), url: href, snippet: '' });
    }
  }
  return dedupe(results);
}

async function searchSerpAPI(query) {
  const key = config.websearch.apiKey;
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${key}`;
  const res = await fetchGlobal(url, { signal: timeoutSignal(15000) });
  const data = await res.json();
  return dedupe((data.organic_results || []).slice(0, MAX_RESULTS).map(r => ({
    title: r.title, url: r.link, snippet: cleanSnippet(r.snippet),
  })));
}

async function searchBrave(query) {
  const key = config.websearch.apiKey;
  const res = await fetchGlobal(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${MAX_RESULTS}`, {
    headers: { 'X-Subscription-Token': key, Accept: 'application/json' },
    signal: timeoutSignal(15000),
  });
  const data = await res.json();
  return dedupe((data.web?.results || []).map(r => ({
    title: r.title, url: r.url, snippet: cleanSnippet(r.description),
  })));
}

async function searchTavily(query) {
  const key = config.websearch.apiKey;
  const res = await fetchGlobal('https://api.tavily.com/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, query, max_results: MAX_RESULTS }),
    signal: timeoutSignal(15000),
  });
  const data = await res.json();
  return dedupe((data.results || []).map(r => ({
    title: r.title, url: r.url, snippet: cleanSnippet(r.content),
  })));
}

export async function webSearch(query, { limit = MAX_RESULTS } = {}) {
  const provider = config.websearch.provider || 'duckduckgo';
  let results;
  try {
    switch (provider) {
      case 'serpapi': results = await searchSerpAPI(query); break;
      case 'brave': results = await searchBrave(query); break;
      case 'tavily': results = await searchTavily(query); break;
      default: results = await searchDuckDuckGo(query); break;
    }
  } catch (err) {
    // degrade to DuckDuckGo if a keyed provider fails
    if (provider !== 'duckduckgo') {
      try { results = await searchDuckDuckGo(query); } catch { results = []; }
    } else {
      results = [];
    }
  }

  return results.slice(0, limit).map(r => ({
    title: r.title || 'Untitled',
    url: r.url,
    domain: (() => { try { return new URL(r.url).hostname; } catch { return ''; } })(),
    snippet: r.snippet || '',
    sourceType: 'web',
  }));
}

export { isHttpUrl };
