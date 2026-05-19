const WINDOW_MS = 10 * 60 * 1000;
const MAX_REPORTS_PER_WINDOW = 5;
const MAX_BODY_BYTES = 20_000;
const buckets = new Map();

function corsOrigin(request, env) {
  const origin = request.headers.get('origin') || '*';
  const allowed = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!allowed.length || origin === '*') return origin;
  return allowed.includes(origin) ? origin : allowed[0];
}

function json(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });
}

function clean(value, maxLength) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, maxLength);
}

function getClientIp(request) {
  return request.headers.get('cf-connecting-ip') || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || now - bucket.startedAt > WINDOW_MS) {
    buckets.set(ip, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REPORTS_PER_WINDOW;
}

function makeIssueBody(report) {
  const contact = report.contact ? report.contact : 'Not provided';
  const steps = report.steps ? report.steps : 'Not provided';
  return [
    '## Description',
    report.description,
    '',
    '## Steps to reproduce',
    steps,
    '',
    '## Contact',
    contact,
    '',
    '## Technical info',
    `- App version: ${report.appVersion || 'unknown'}`,
    `- Language: ${report.language || 'unknown'}`,
    `- Theme: ${report.theme || 'unknown'}`,
    `- Source: ${report.source || 'unknown'}`,
    `- Platform: ${report.platform || 'unknown'}`,
    `- User agent: ${report.userAgent || 'unknown'}`,
    `- Reported at: ${report.reportedAt || new Date().toISOString()}`,
  ].join('\n');
}

async function createGitHubIssue(env, report) {
  const owner = env.GITHUB_OWNER || 'IvicaSkrobo';
  const repo = env.GITHUB_REPO || 'Bili-Mushroom';
  const labels = (env.GITHUB_LABELS || 'bug,app-report')
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'gljivobook-bug-report-worker',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({
      title: `[Bug] ${report.title}`,
      body: makeIssueBody(report),
      labels,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub issue creation failed: ${response.status} ${details.slice(0, 300)}`);
  }

  return response.json();
}

export default {
  async fetch(request, env) {
    const origin = corsOrigin(request, env);

    if (request.method === 'OPTIONS') {
      return json({ ok: true }, 200, origin);
    }

    if (request.method === 'GET') {
      return json({ ok: true, service: 'gljivobook-bug-report' }, 200, origin);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, origin);
    }

    if (!env.GITHUB_TOKEN) {
      return json({ error: 'Server is missing GITHUB_TOKEN' }, 500, origin);
    }

    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > MAX_BODY_BYTES) {
      return json({ error: 'Report is too large' }, 413, origin);
    }

    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return json({ error: 'Too many reports. Try again later.' }, 429, origin);
    }

    let raw;
    try {
      raw = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400, origin);
    }

    if (clean(raw.trap, 120)) {
      return json({ ok: true }, 200, origin);
    }

    const report = {
      title: clean(raw.title, 120),
      description: clean(raw.description, 3000),
      steps: clean(raw.steps, 2000),
      contact: clean(raw.contact, 160),
      language: clean(raw.language, 12),
      theme: clean(raw.theme, 12),
      source: clean(raw.source, 24),
      appVersion: clean(raw.appVersion, 40),
      userAgent: clean(raw.userAgent, 500),
      platform: clean(raw.platform, 120),
      reportedAt: clean(raw.reportedAt, 80),
    };

    if (report.title.length < 4 || report.description.length < 10) {
      return json({ error: 'Title and description are required' }, 400, origin);
    }

    try {
      const issue = await createGitHubIssue(env, report);
      return json({ ok: true, issueUrl: issue.html_url }, 200, origin);
    } catch (error) {
      console.error(String(error?.message || error));
      return json({ error: 'Report could not be saved. Try again later.' }, 502, origin);
    }
  },
};
