const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM;
const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_KEY;
const MY_CELL = process.env.MY_CELL;
const HOME_ADDRESS = '2917 Hermosa View Drive, Hermosa Beach, CA 90254';

// iCal feed URLs
const FEEDS = [
  {
    name: 'Max',
    emoji: '⚾',
    url: 'https://api.team-manager.gc.com/ics-calendar-documents/user/1a18b434-6d25-49f2-9df9-96370fe6c0fc.ics?teamId=df60ea43-87d8-4715-a7d4-fcf6e1dd66ee&token=1ed19e90bba835abb4f6c8c0897f7a7b133c0f0e14e6912852498e313d0bcaeb'
  },
  {
    name: 'Harper',
    emoji: '🏐',
    url: 'https://api.team-manager.gc.com/ics-calendar-documents/user/1a18b434-6d25-49f2-9df9-96370fe6c0fc.ics?teamId=94414be0-fdab-4156-a5ab-e4844921a3b6&token=562ff00ab17c0167822b9258d98c1861cca35495ccead3661b17ec9c92567abe'
  }
];

// Serve the calendar app
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kids Sports Calendar</title>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #f0f4ff;
    --surface: #ffffff;
    --surface2: #f8f9ff;
    --border: #e2e8ff;
    --text: #1a1f3c;
    --text2: #6b7280;
    --accent: #4f6ef7;
    --accent2: #f97316;
    --green: #22c55e;
    --red: #ef4444;
    --radius: 16px;
    --shadow: 0 4px 24px rgba(79,110,247,0.08);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Nunito Sans', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
  h1,h2,h3,h4 { font-family: 'Nunito', sans-serif; }

  /* Layout */
  .app { display: grid; grid-template-columns: 280px 1fr; min-height: 100vh; }
  .sidebar { background: var(--text); color: #fff; padding: 28px 20px; display: flex; flex-direction: column; gap: 28px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
  .main { padding: 28px; overflow-y: auto; }

  /* Header */
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-icon { width: 40px; height: 40px; background: var(--accent); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
  .logo-text { font-family: 'Nunito', sans-serif; font-weight: 900; font-size: 18px; line-height: 1.1; }
  .logo-text span { color: #a5b4fc; font-size: 11px; font-weight: 600; display: block; letter-spacing: 0.05em; text-transform: uppercase; }

  /* Feed Manager */
  .section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #6b7280; margin-bottom: 10px; }
  .feed-item { background: rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; position: relative; }
  .feed-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .feed-info { flex: 1; min-width: 0; }
  .feed-name { font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .feed-status { font-size: 10px; color: #9ca3af; margin-top: 2px; }
  .feed-del { background: none; border: none; color: #6b7280; cursor: pointer; font-size: 16px; padding: 2px 4px; border-radius: 4px; flex-shrink: 0; }
  .feed-del:hover { color: #ef4444; background: rgba(239,68,68,0.1); }

  /* Add feed form */
  .add-feed { display: flex; flex-direction: column; gap: 8px; }
  .add-feed input { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #fff; padding: 8px 12px; border-radius: 8px; font-family: inherit; font-size: 12px; outline: none; width: 100%; }
  .add-feed input::placeholder { color: #6b7280; }
  .add-feed input:focus { border-color: #a5b4fc; }
  .btn { font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 12px; padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; transition: all 0.15s; letter-spacing: 0.03em; }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:hover { background: #3b5af0; transform: translateY(-1px); }
  .btn-refresh { background: rgba(255,255,255,0.08); color: #a5b4fc; border: 1px solid rgba(165,180,252,0.2); width: 100%; margin-top: 4px; }
  .btn-refresh:hover { background: rgba(165,180,252,0.15); }

  /* Kids filter */
  .kid-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 20px; font-size: 11px; font-family: 'Nunito', sans-serif; font-weight: 700; cursor: pointer; border: 2px solid transparent; transition: all 0.15s; margin: 0 4px 4px 0; }
  .kid-pill.active { opacity: 1; }
  .kid-pill.inactive { opacity: 0.35; }

  /* Main header */
  .main-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: gap; gap: 12px; }
  .month-nav { display: flex; align-items: center; gap: 12px; }
  .month-title { font-family: 'Nunito', sans-serif; font-weight: 900; font-size: 26px; color: var(--text); min-width: 220px; text-align: center; }
  .nav-btn { width: 36px; height: 36px; border-radius: 50%; background: var(--surface); border: 1px solid var(--border); cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; color: var(--text); }
  .nav-btn:hover { background: var(--accent); color: #fff; border-color: var(--accent); }
  .view-tabs { display: flex; gap: 4px; background: var(--surface); border-radius: 10px; padding: 4px; border: 1px solid var(--border); }
  .view-tab { padding: 6px 14px; border-radius: 7px; font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 12px; border: none; cursor: pointer; transition: all 0.15s; letter-spacing: 0.03em; background: transparent; color: var(--text2); }
  .view-tab.active { background: var(--accent); color: #fff; }

  /* Calendar grid */
  .cal-grid { background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); overflow: hidden; box-shadow: var(--shadow); }
  .cal-days-header { display: grid; grid-template-columns: repeat(7, 1fr); background: var(--surface2); border-bottom: 1px solid var(--border); }
  .cal-day-label { text-align: center; padding: 10px; font-size: 11px; font-weight: 700; color: var(--text2); letter-spacing: 0.08em; text-transform: uppercase; }
  .cal-cells { display: grid; grid-template-columns: repeat(7, 1fr); }
  .cal-cell { min-height: 100px; padding: 8px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); transition: background 0.1s; cursor: pointer; }
  .cal-cell:hover { background: #f0f4ff; }
  .cal-cell.empty { background: var(--surface2); cursor: default; }
  .cal-cell.today .day-num { background: var(--accent); color: #fff; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; }
  .cal-cell.selected { background: #eef1ff; outline: 2px solid var(--accent); }
  .day-num { font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 14px; color: var(--text2); margin-bottom: 4px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; }
  .cal-event { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'Nunito', sans-serif; }

  /* Agenda */
  .agenda-group { margin-bottom: 24px; }
  .agenda-date { font-family: 'Nunito', sans-serif; font-weight: 900; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); padding: 8px 0; border-bottom: 2px solid var(--accent); margin-bottom: 10px; }
  .event-card { background: var(--surface); border-radius: 12px; padding: 14px 16px; margin-bottom: 8px; border: 1px solid var(--border); display: flex; align-items: center; gap: 14px; box-shadow: var(--shadow); transition: transform 0.15s; }
  .event-card:hover { transform: translateX(4px); }
  .event-sport-icon { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
  .event-details { flex: 1; }
  .event-title { font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 15px; margin-bottom: 3px; }
  .event-meta { font-size: 12px; color: var(--text2); display: flex; flex-wrap: wrap; gap: 10px; }
  .event-meta span { display: flex; align-items: center; gap: 3px; }
  .event-kid-tag { padding: 3px 8px; border-radius: 20px; font-size: 10px; font-family: 'Nunito', sans-serif; font-weight: 700; flex-shrink: 0; }

  /* Loading / empty states */
  .loading { text-align: center; padding: 60px 20px; color: var(--text2); }
  .loading-spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .empty-state { text-align: center; padding: 60px 20px; color: var(--text2); }
  .empty-icon { font-size: 48px; margin-bottom: 12px; }
  .empty-title { font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 18px; color: var(--text); margin-bottom: 6px; }

  /* Day detail panel */
  .day-panel { background: var(--surface); border-radius: var(--radius); padding: 20px; margin-top: 16px; border: 1px solid var(--border); box-shadow: var(--shadow); animation: slideUp 0.2s ease; }
  @keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .day-panel-title { font-family: 'Nunito', sans-serif; font-weight: 900; font-size: 18px; margin-bottom: 14px; }

  /* Status bar */
  .status-bar { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #9ca3af; padding: 6px 0; }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; }

  /* Responsive */
  @media (max-width: 768px) {
    .app { grid-template-columns: 1fr; }
    .sidebar { height: auto; position: static; }
  }
</style>
</head>
<body>
<div class="app">

  <!-- SIDEBAR -->
  <div class="sidebar">
    <div class="logo">
      <div class="logo-icon">⚾</div>
      <div class="logo-text">
        Team Schedule
        <span>Kids Sports Calendar</span>
      </div>
    </div>

    <!-- Calendar Feeds -->
    <div>
      <div class="section-label">Calendar Feeds</div>
      <div id="feedList"></div>
      <div class="add-feed">
        <input id="feedNameInput" placeholder="Kid's name (e.g. Emma)" />
        <input id="feedUrlInput" placeholder="webcal:// or https:// iCal URL" />
        <input id="feedEmojiInput" placeholder="Sport emoji (e.g. ⚽ 🏀 🏈)" style="width:100%" />
        <button class="btn btn-primary" onclick="addFeed()">+ Add Feed</button>
      </div>
      <button class="btn btn-refresh" onclick="refreshAll()">↻ Refresh All Calendars</button>
      <div class="status-bar" id="statusBar">
        <div class="status-dot" style="background:#22c55e"></div>
        <span id="statusText">Ready</span>
      </div>
    </div>

    <!-- Kids Filter -->
    <div>
      <div class="section-label">Filter by Kid</div>
      <div id="kidFilters"></div>
    </div>

    <!-- Reminders -->
    <div>
      <div class="section-label">📱 SMS Reminders</div>
      <div style="font-size:11px;color:#9ca3af;margin-bottom:10px;line-height:1.5">
        Auto-sends at <strong style="color:#a5b4fc">7:00 AM PT</strong> daily with drive time from home.
      </div>
      <button class="btn btn-primary" style="width:100%;margin-bottom:8px" onclick="sendMorningReminders()">
        Send Today's Reminders Now
      </button>
      <button class="btn" style="width:100%;background:rgba(255,255,255,0.06);color:#a5b4fc;border:1px solid rgba(165,180,252,0.2)" onclick="sendMorningReminders(true)">
        Send Test Reminder
      </button>
      <div id="reminderStatus" style="font-size:11px;margin-top:8px;display:none;font-weight:600"></div>
    </div>

    <!-- Upcoming count -->
    <div style="margin-top:auto">
      <div class="section-label">This Month</div>
      <div style="font-family:'Nunito',sans-serif; font-weight:900; font-size:32px; color:#a5b4fc;" id="eventCount">0</div>
      <div style="font-size:12px; color:#6b7280;">events scheduled</div>
    </div>
  </div>

  <!-- MAIN -->
  <div class="main">
    <div class="main-header">
      <div class="month-nav">
        <button class="nav-btn" onclick="changeMonth(-1)">‹</button>
        <div class="month-title" id="monthTitle"></div>
        <button class="nav-btn" onclick="changeMonth(1)">›</button>
      </div>
      <div class="view-tabs">
        <button class="view-tab active" onclick="setView('calendar', this)">Calendar</button>
        <button class="view-tab" onclick="setView('agenda', this)">Agenda</button>
      </div>
    </div>

    <div id="calendarView">
      <div class="cal-grid">
        <div class="cal-days-header">
          <div class="cal-day-label">Sun</div>
          <div class="cal-day-label">Mon</div>
          <div class="cal-day-label">Tue</div>
          <div class="cal-day-label">Wed</div>
          <div class="cal-day-label">Thu</div>
          <div class="cal-day-label">Fri</div>
          <div class="cal-day-label">Sat</div>
        </div>
        <div class="cal-cells" id="calCells"></div>
      </div>
      <div id="dayPanel"></div>
    </div>

    <div id="agendaView" style="display:none">
      <div id="agendaContent"></div>
    </div>
  </div>
</div>

<script>
// Fetch iCal via our Render server to avoid CORS issues
async function fetchWithProxy(url) {
  const res = await fetch(\`\${SERVER_URL}/fetch-ical?url=\${encodeURIComponent(url)}\`);
  if (!res.ok) throw new Error('Server fetch failed: ' + res.status);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch iCal');
  return data.content;
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const KID_COLORS = ['#4f6ef7','#f97316','#22c55e','#ec4899','#a855f7','#06b6d4','#eab308'];

// --- REMINDER CONFIG ---
const HOME_ADDRESS = '2917 Hermosa View Drive, Hermosa Beach, CA 90254';
const TWILIO_SID = 'AC51c9205043f33ed71754817c12545110';
const TWILIO_TOKEN = '480801b438ee0e6ed74915e3785a1fa6';
const TWILIO_FROM = '+14155238886'; // Twilio WhatsApp Sandbox
const MY_CELL = '+13104285247';
const GOOGLE_MAPS_KEY = 'AIzaSyBgpNcmDoinJjgG46zattiFOBpsI20ZYJw';
const SERVER_URL = 'https://sports-calendar-server.onrender.com';

let currentDate = new Date();
let currentView = 'calendar';
let selectedDay = null;
let allEvents = [];
let feeds = [];
let activeKids = new Set();

// Pre-load calendar feeds
feeds = [
  {
    id: 'gc-1',
    name: 'Max',
    url: 'webcal://api.team-manager.gc.com/ics-calendar-documents/user/1a18b434-6d25-49f2-9df9-96370fe6c0fc.ics?teamId=df60ea43-87d8-4715-a7d4-fcf6e1dd66ee&token=1ed19e90bba835abb4f6c8c0897f7a7b133c0f0e14e6912852498e313d0bcaeb',
    emoji: '⚾',
    color: KID_COLORS[0],
    status: 'pending',
    events: []
  },
  {
    id: 'gc-2',
    name: 'Harper',
    url: 'webcal://api.team-manager.gc.com/ics-calendar-documents/user/1a18b434-6d25-49f2-9df9-96370fe6c0fc.ics?teamId=94414be0-fdab-4156-a5ab-e4844921a3b6&token=562ff00ab17c0167822b9258d98c1861cca35495ccead3661b17ec9c92567abe',
    emoji: '🏐',
    color: KID_COLORS[1],
    status: 'pending',
    events: []
  }
];
activeKids.add('gc-1');
activeKids.add('gc-2');

// --- SPORT EMOJI DETECTION ---
function detectSportEmoji(title) {
  if (!title) return '📅';
  const t = title.toLowerCase();
  if (/baseball|softball|diamond|pitcher|batting|prime synergy/i.test(t)) return '⚾';
  if (/basketball|hoops/i.test(t)) return '🏀';
  if (/soccer|futbol/i.test(t)) return '⚽';
  if (/football|gridiron/i.test(t)) return '🏈';
  if (/hockey|puck/i.test(t)) return '🏒';
  if (/swim|swimming|pool/i.test(t)) return '🏊';
  if (/tennis/i.test(t)) return '🎾';
  if (/volleyball|south bay/i.test(t)) return '🏐';
  if (/lacrosse/i.test(t)) return '🥍';
  if (/gymnastics/i.test(t)) return '🤸';
  if (/track|cross country|run/i.test(t)) return '🏃';
  if (/wrestling/i.test(t)) return '🤼';
  if (/cheer/i.test(t)) return '📣';
  if (/golf/i.test(t)) return '⛳';
  if (/practice|scrimmage|tryout/i.test(t)) return '🏅';
  if (/game|match|vs\\.|@/i.test(t)) return '🏅';
  return '📅';
}

// --- ICS PARSER ---
function parseICS(icsText, feedId) {
  const events = [];
  // Unfold lines (RFC 5545: lines can be continued with CRLF + space/tab)
  const unfolded = icsText.replace(/\\r\\n[ \\t]/g, '').replace(/\\n[ \\t]/g, '');
  const lines = unfolded.split(/\\r\\n|\\n|\\r/);
  let current = null;
  let isUTC = false;
  for (let line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) { current = {}; isUTC = false; }
    else if (line.startsWith('END:VEVENT') && current) {
      if (current.start) {
        current.sportEmoji = detectSportEmoji(current.title);
        events.push({ ...current, feedId });
      }
      current = null;
    } else if (current) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const keyPart = line.substring(0, colonIdx);
      const val = line.substring(colonIdx + 1).trim();
      const k = keyPart.split(';')[0].toUpperCase();
      const params = keyPart.toUpperCase();
      if (k === 'SUMMARY') current.title = val.replace(/\\\\,/g, ',').replace(/\\\\n/g, ' ').replace(/\\\\/g, '');
      else if (k === 'DTSTART') {
        isUTC = params.includes('Z') || val.endsWith('Z');
        const isAllDay = !val.includes('T');
        current.start = parseICSDate(val, isUTC, isAllDay);
        current.allDay = isAllDay;
      }
      else if (k === 'DTEND') {
        current.end = parseICSDate(val, isUTC, current.allDay);
      }
      else if (k === 'LOCATION') current.location = val.replace(/\\\\,/g, ',').replace(/\\\\/g, '');
      else if (k === 'DESCRIPTION') current.description = val.replace(/\\\\n/g, ' ').replace(/\\\\,/g, ',').replace(/\\\\/g, '').substring(0, 120);
    }
  }
  return events;
}

// Pacific Time offset: UTC-8 standard, UTC-7 daylight saving
function getPacificOffset(date) {
  // DST: second Sunday in March to first Sunday in November
  const year = date.getUTCFullYear();
  // Second Sunday in March
  const dstStart = new Date(Date.UTC(year, 2, 1));
  dstStart.setUTCDate(1 + (7 - dstStart.getUTCDay() + 0) % 7 + 7); // second Sunday
  // First Sunday in November
  const dstEnd = new Date(Date.UTC(year, 10, 1));
  dstEnd.setUTCDate(1 + (7 - dstEnd.getUTCDay()) % 7); // first Sunday
  const isDST = date >= dstStart && date < dstEnd;
  return isDST ? -7 : -8; // hours offset
}

function parseICSDate(str, isUTC, isAllDay) {
  if (!str) return null;
  const hasZ = str.endsWith('Z');
  const clean = str.replace(/Z$/, '');
  const y = clean.substr(0,4), mo = clean.substr(4,2), d = clean.substr(6,2);
  if (isAllDay) {
    return new Date(parseInt(y), parseInt(mo)-1, parseInt(d), 12, 0, 0);
  }
  const h = clean.substr(9,2)||'00', mi = clean.substr(11,2)||'00', s = clean.substr(13,2)||'00';
  if (hasZ) {
    // Explicitly UTC — convert to Pacific
    const utcDate = new Date(Date.UTC(parseInt(y), parseInt(mo)-1, parseInt(d), parseInt(h), parseInt(mi), parseInt(s)));
    const ptOffset = getPacificOffset(utcDate);
    return new Date(utcDate.getTime() + ptOffset * 60 * 60 * 1000);
  } else {
    // No Z = already local time, use as-is
    return new Date(parseInt(y), parseInt(mo)-1, parseInt(d), parseInt(h), parseInt(mi), parseInt(s));
  }
}

function formatTime(date, allDay) {
  if (!date || allDay) return allDay ? 'All Day' : '';
  let h = date.getUTCHours(), m = date.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return \`\${h}:\${String(m).padStart(2,'0')} \${ampm} PT\`;
}

function toDateStr(date) {
  // Use UTC methods since all dates are stored as manually-shifted UTC timestamps
  return \`\${date.getUTCFullYear()}-\${String(date.getUTCMonth()+1).padStart(2,'0')}-\${String(date.getUTCDate()).padStart(2,'0')}\`;
}

// --- FEED LOADING ---
async function loadFeed(feed) {
  setStatus(\`Loading \${feed.name}...\`, '#eab308');
  feed.status = 'loading';
  renderFeedList();
  try {
    const url = feed.url.replace('webcal://', 'https://');
    const text = await fetchWithProxy(url);

    feed.events = parseICS(text, feed.id);
    feed.status = 'ok';
    feed.lastFetched = new Date();
    setStatus(\`\${feed.name}: \${feed.events.length} events loaded\`, '#22c55e');
  } catch(e) {
    feed.status = 'error';
    feed.error = e.message;
    setStatus(\`Error loading \${feed.name}: \${e.message}\`, '#ef4444');
  }
  rebuildEvents();
  render();
}

async function refreshAll() {
  for (const feed of feeds) await loadFeed(feed);
}


function rebuildEvents() {
  allEvents = [];
  for (const feed of feeds) {
    if (feed.events) allEvents.push(...feed.events);
  }
}

// --- UI ---
function setStatus(msg, color) {
  document.getElementById('statusText').textContent = msg;
  document.querySelector('.status-dot').style.background = color;
}

function renderFeedList() {
  const el = document.getElementById('feedList');
  el.innerHTML = feeds.map(f => \`
    <div class="feed-item">
      <div class="feed-dot" style="background:\${f.color}"></div>
      <div class="feed-info">
        <div class="feed-name">\${f.emoji} \${f.name}</div>
        <div class="feed-status">\${
          f.status === 'ok' ? \`✓ \${f.events?.length||0} events\` :
          f.status === 'loading' ? '⏳ Loading...' :
          f.status === 'error' ? \`✗ \${f.error||'Error'}\` :
          'Not loaded yet'
        }</div>
      </div>
      <button class="feed-del" onclick="deleteFeed('\${f.id}')">×</button>
    </div>
  \`).join('');
}

function renderKidFilters() {
  const el = document.getElementById('kidFilters');
  el.innerHTML = feeds.map(f => \`
    <span class="kid-pill \${activeKids.has(f.id) ? 'active' : 'inactive'}"
      style="background:\${f.color}22; color:\${f.color}; border-color:\${activeKids.has(f.id) ? f.color : 'transparent'}"
      onclick="toggleKid('\${f.id}')">
      \${f.emoji} \${f.name}
    </span>
  \`).join('');
}

function toggleKid(id) {
  if (activeKids.has(id)) { if (activeKids.size > 1) activeKids.delete(id); }
  else activeKids.add(id);
  render();
}

function deleteFeed(id) {
  feeds = feeds.filter(f => f.id !== id);
  activeKids.delete(id);
  rebuildEvents();
  render();
}

function addFeed() {
  const name = document.getElementById('feedNameInput').value.trim();
  const url = document.getElementById('feedUrlInput').value.trim();
  const emoji = document.getElementById('feedEmojiInput').value.trim() || '🏅';
  if (!name || !url) { alert('Please enter a name and URL.'); return; }
  const id = 'feed-' + Date.now();
  const color = KID_COLORS[feeds.length % KID_COLORS.length];
  feeds.push({ id, name, url, emoji, color, status: 'pending', events: [] });
  activeKids.add(id);
  document.getElementById('feedNameInput').value = '';
  document.getElementById('feedUrlInput').value = '';
  document.getElementById('feedEmojiInput').value = '';
  const feed = feeds.find(f => f.id === id);
  renderFeedList();
  renderKidFilters();
  loadFeed(feed);
}

// --- CALENDAR RENDER ---
function getFilteredEvents() {
  return allEvents.filter(e => activeKids.has(e.feedId) && e.start);
}

function getEventsForDay(dateStr) {
  return getFilteredEvents().filter(e => toDateStr(e.start) === dateStr);
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toDateStr(new Date());

  const cells = document.getElementById('calCells');
  let html = '';

  for (let i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = \`\${year}-\${String(month+1).padStart(2,'0')}-\${String(d).padStart(2,'0')}\`;
    const dayEvents = getEventsForDay(dateStr);
    const isToday = dateStr === todayStr;
    const isSelected = selectedDay === dateStr;
    html += \`<div class="cal-cell\${isToday?' today':''}\${isSelected?' selected':''}" onclick="selectDay('\${dateStr}')">
      <div class="day-num">\${d}</div>
      \${dayEvents.slice(0,3).map(e => {
        const feed = feeds.find(f=>f.id===e.feedId);
        return \`<div class="cal-event" style="background:\${feed?.color||'#4f6ef7'}22;color:\${feed?.color||'#4f6ef7'}">\${e.sportEmoji||feed?.emoji||'📅'} \${e.title||'Event'}</div>\`;
      }).join('')}
      \${dayEvents.length > 3 ? \`<div style="font-size:10px;color:#9ca3af;padding:0 4px">+\${dayEvents.length-3} more</div>\` : ''}
    </div>\`;
  }
  cells.innerHTML = html;

  // Event count
  const monthEvents = getFilteredEvents().filter(e => e.start.getUTCFullYear()===year && e.start.getUTCMonth()===month);
  document.getElementById('eventCount').textContent = monthEvents.length;

  // Day panel
  renderDayPanel();
}

function selectDay(dateStr) {
  selectedDay = selectedDay === dateStr ? null : dateStr;
  renderCalendar();
}

function renderDayPanel() {
  const panel = document.getElementById('dayPanel');
  if (!selectedDay) { panel.innerHTML = ''; return; }
  const dayEvents = getEventsForDay(selectedDay);
  const d = new Date(selectedDay + 'T12:00:00');
  const label = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  panel.innerHTML = \`
    <div class="day-panel">
      <div class="day-panel-title">\${label} <span style="font-size:14px;color:#9ca3af;font-weight:600">\${dayEvents.length} event\${dayEvents.length!==1?'s':''}</span></div>
      \${dayEvents.length===0 ? '<div style="color:#9ca3af;font-size:14px">No events this day.</div>' : dayEvents.map(e => renderEventCard(e)).join('')}
    </div>\`;
}

function renderEventCard(e) {
  const feed = feeds.find(f=>f.id===e.feedId);
  const emoji = e.sportEmoji || feed?.emoji || '📅';
  return \`<div class="event-card">
    <div class="event-sport-icon" style="background:\${feed?.color||'#4f6ef7'}18">\${emoji}</div>
    <div class="event-details">
      <div class="event-title">\${e.title||'Event'}</div>
      <div class="event-meta">
        \${e.start ? \`<span>🕐 \${formatTime(e.start, e.allDay)}</span>\` : ''}
        \${e.location ? \`<span>📍 \${e.location}</span>\` : ''}
        \${e.description ? \`<span style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📝 \${e.description}</span>\` : ''}
      </div>
    </div>
    <div class="event-kid-tag" style="background:\${feed?.color||'#4f6ef7'}18;color:\${feed?.color||'#4f6ef7'}">\${feed?.name||'Unknown'}</div>
  </div>\`;
}

function renderAgenda() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const events = getFilteredEvents()
    .filter(e => e.start.getUTCFullYear()===year && e.start.getUTCMonth()===month)
    .sort((a,b) => a.start - b.start);

  const el = document.getElementById('agendaContent');
  if (events.length === 0) {
    el.innerHTML = \`<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">No events this month</div><div>Add a calendar feed or check another month.</div></div>\`;
    return;
  }

  const grouped = {};
  for (const e of events) {
    const key = toDateStr(e.start);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  el.innerHTML = Object.entries(grouped).map(([date, evs]) => {
    const d = new Date(date + 'T12:00:00');
    const label = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
    return \`<div class="agenda-group">
      <div class="agenda-date">\${label}</div>
      \${evs.map(e => renderEventCard(e)).join('')}
    </div>\`;
  }).join('');
}

function render() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  document.getElementById('monthTitle').textContent = \`\${MONTHS[month]} \${year}\`;
  renderFeedList();
  renderKidFilters();
  if (currentView === 'calendar') renderCalendar();
  else renderAgenda();
}

function changeMonth(dir) {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1);
  selectedDay = null;
  render();
}

function setView(v, btn) {
  currentView = v;
  document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('calendarView').style.display = v==='calendar' ? '' : 'none';
  document.getElementById('agendaView').style.display = v==='agenda' ? '' : 'none';
  render();
}

// --- REMINDER SYSTEM ---

async function getDriveTime(destination) {
  if (!destination) return null;
  try {
    const res = await fetch(\`\${SERVER_URL}/drive-time?destination=\${encodeURIComponent(destination)}\`);
    const data = await res.json();
    if (data.success) return data.minutes;
  } catch(e) { console.warn('Drive time error:', e); }
  return null;
}

async function sendSMS(body) {
  showReminderStatus(\`Contacting server at \${SERVER_URL}...\`, null);
  try {
    const res = await fetch(\`\${SERVER_URL}/send-sms\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: MY_CELL, body })
    });
    showReminderStatus(\`Server responded: HTTP \${res.status}\`, null);
    const data = await res.json();
    console.log('SMS response:', data);
    if (!data.success) showReminderStatus(\`Server error: \${JSON.stringify(data)}\`, false);
    return data.success === true;
  } catch(e) {
    showReminderStatus(\`Fetch error: \${e.message}\`, false);
    console.error('SMS error:', e);
    return false;
  }
}

function formatLeaveTime(eventDate, driveMinutes, bufferMinutes = 15) {
  const leaveMs = eventDate.getTime() - (driveMinutes + bufferMinutes) * 60000;
  const leave = new Date(leaveMs);
  let h = leave.getUTCHours(), m = leave.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return \`\${h}:\${String(m).padStart(2,'0')} \${ampm}\`;
}

async function sendMorningReminders(isTest = false) {
  const todayStr = toDateStr(new Date());
  const todayEvents = allEvents.filter(e => e.start && toDateStr(e.start) === todayStr);

  if (todayEvents.length === 0 && !isTest) {
    showReminderStatus('No events today — nothing to send!', false);
    return;
  }

  const eventsToUse = isTest ? allEvents.slice(0, 1) : todayEvents;
  showReminderStatus(\`Sending \${eventsToUse.length} reminder\${eventsToUse.length !== 1 ? 's' : ''}...\`, null);

  let sent = 0;
  for (const e of eventsToUse) {
    const feed = feeds.find(f => f.id === e.feedId);
    const kidName = feed?.name || 'Your kid';
    const emoji = e.sportEmoji || feed?.emoji || '📅';
    const timeStr = formatTime(e.start, e.allDay);

    let driveStr = '';
    if (e.location && !e.allDay) {
      const mins = await getDriveTime(e.location);
      if (mins !== null) {
        const leaveBy = formatLeaveTime(e.start, mins);
        driveStr = \`\\n🚗 ~\${mins} min drive — leave by \${leaveBy} PT\`;
      }
    }

    const msg = \`\${emoji} Reminder: \${kidName} has \${e.title} today at \${timeStr}\` +
      (e.location ? \`\\n📍 \${e.location}\` : '') +
      driveStr +
      \`\\n\\nSent from Kids Sports Calendar\`;

    const ok = await sendSMS(msg);
    if (ok) sent++;
  }

  showReminderStatus(sent > 0 ? \`✅ \${sent} reminder\${sent !== 1 ? 's' : ''} sent to \${MY_CELL}!\` : '❌ Failed to send — check Twilio credentials', sent > 0);
}

function showReminderStatus(msg, success) {
  let el = document.getElementById('reminderStatus');
  if (!el) return;
  el.textContent = msg;
  el.style.color = success === null ? '#fbbf24' : success ? '#22c55e' : '#f87171';
  el.style.display = 'block';
  if (success !== null) setTimeout(() => { el.style.display = 'none'; }, 6000);
}

// Schedule morning reminders at 7:00 AM PT daily
function scheduleMorningCheck() {
  const now = new Date();
  const nowUTC = now.getTime();
  // 7 AM PT = 14:00 UTC (standard) or 15:00 UTC (DST - but we check offset)
  const ptOffset = getPacificOffset(now);
  const targetHourUTC = 7 - ptOffset; // e.g. 7 - (-7) = 14 UTC in DST
  const next7am = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), targetHourUTC, 0, 0));
  if (next7am.getTime() <= nowUTC) next7am.setUTCDate(next7am.getUTCDate() + 1);
  const msUntil = next7am.getTime() - nowUTC;
  console.log(\`Next reminder check in \${Math.round(msUntil/60000)} minutes\`);
  setTimeout(() => {
    sendMorningReminders();
    setInterval(sendMorningReminders, 24 * 60 * 60 * 1000);
  }, msUntil);
}

// Init
render();
// Auto-load all feeds
feeds.forEach(feed => loadFeed(feed));
// Start morning reminder scheduler
scheduleMorningCheck();
</script>
</body>
</html>
`);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Sports Calendar Server running ✅' });
});

// Fetch iCal feed (proxies for browser CORS)
app.get('/fetch-ical', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const content = await response.text();
    if (!content.includes('BEGIN:VCALENDAR')) throw new Error('Not a valid iCal feed');
    res.json({ success: true, content });
  } catch (err) {
    console.error('iCal fetch error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send WhatsApp message
app.post('/send-sms', async (req, res) => {
  const { to, body } = req.body;
  if (!to || !body) return res.status(400).json({ error: 'Missing to or body' });
  try {
    const client = twilio(TWILIO_SID, TWILIO_TOKEN);
    const message = await client.messages.create({
      body,
      from: `whatsapp:${TWILIO_FROM}`,
      to: `whatsapp:${to}`
    });
    res.json({ success: true, sid: message.sid });
  } catch (err) {
    console.error('Twilio error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get drive time
app.get('/drive-time', async (req, res) => {
  const { destination } = req.query;
  if (!destination) return res.status(400).json({ error: 'Missing destination' });
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${encodeURIComponent(HOME_ADDRESS)}` +
      `&destinations=${encodeURIComponent(destination)}` +
      `&departure_time=now` +
      `&key=${GOOGLE_MAPS_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    const element = data?.rows?.[0]?.elements?.[0];
    if (element?.status === 'OK') {
      const mins = Math.round(
        (element.duration_in_traffic?.value || element.duration?.value) / 60
      );
      res.json({ success: true, minutes: mins });
    } else {
      res.json({ success: false, error: 'No route found' });
    }
  } catch (err) {
    console.error('Maps error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- CRON: Morning reminders endpoint ---
// Called by Render Cron Job at 7 AM PT daily
app.get('/send-morning-reminders', async (req, res) => {
  // Validate secret key to prevent unauthorized calls
  const secret = req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const todayEvents = await getTodayEvents();
    if (todayEvents.length === 0) {
      console.log('No events today');
      return res.json({ success: true, sent: 0, message: 'No events today' });
    }

    let sent = 0;
    for (const e of todayEvents) {
      let driveStr = '';
      if (e.location) {
        const mins = await getDriveTimeMinutes(e.location);
        if (mins !== null) {
          const leaveBy = getLeaveByTime(e.startDate, mins);
          driveStr = `\n🚗 ~${mins} min drive — leave by ${leaveBy} PT`;
        }
      }
      const msg = `${e.emoji} Reminder: ${e.kidName} has ${e.title} today at ${e.timeStr} PT` +
        (e.location ? `\n📍 ${e.location}` : '') +
        driveStr +
        `\n\nSent from Kids Sports Calendar`;

      const client = twilio(TWILIO_SID, TWILIO_TOKEN);
      await client.messages.create({
        body: msg,
        from: `whatsapp:${TWILIO_FROM}`,
        to: `whatsapp:${MY_CELL}`
      });
      sent++;
      console.log(`Sent reminder for ${e.kidName}: ${e.title}`);
    }

    res.json({ success: true, sent, events: todayEvents.map(e => e.title) });
  } catch (err) {
    console.error('Cron error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- HELPERS ---

function getPacificOffset(date) {
  const year = date.getUTCFullYear();
  const dstStart = new Date(Date.UTC(year, 2, 1));
  dstStart.setUTCDate(1 + (7 - dstStart.getUTCDay() + 0) % 7 + 7);
  const dstEnd = new Date(Date.UTC(year, 10, 1));
  dstEnd.setUTCDate(1 + (7 - dstEnd.getUTCDay()) % 7);
  return date >= dstStart && date < dstEnd ? -7 : -8;
}

function parseICSDate(str) {
  if (!str) return null;
  const hasZ = str.endsWith('Z');
  const clean = str.replace(/Z$/, '');
  const y = clean.substr(0,4), mo = clean.substr(4,2), d = clean.substr(6,2);
  const isAllDay = !clean.includes('T');
  if (isAllDay) return { date: new Date(Date.UTC(+y,+mo-1,+d,12,0,0)), allDay: true };
  const h = clean.substr(9,2)||'00', mi = clean.substr(11,2)||'00';
  if (hasZ) {
    const utc = new Date(Date.UTC(+y,+mo-1,+d,+h,+mi,0));
    const offset = getPacificOffset(utc);
    return { date: new Date(utc.getTime() + offset*3600000), allDay: false };
  }
  return { date: new Date(Date.UTC(+y,+mo-1,+d,+h,+mi,0)), allDay: false };
}

function formatTimePT(date, allDay) {
  if (allDay) return 'All Day';
  let h = date.getUTCHours(), m = date.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
}

function getTodayStr() {
  // Today in PT
  const now = new Date();
  const offset = getPacificOffset(now);
  const pt = new Date(now.getTime() + offset * 3600000);
  return `${pt.getUTCFullYear()}-${String(pt.getUTCMonth()+1).padStart(2,'0')}-${String(pt.getUTCDate()).padStart(2,'0')}`;
}

function getLeaveByTime(date, driveMinutes, buffer = 15) {
  const leaveMs = date.getTime() - (driveMinutes + buffer) * 60000;
  const leave = new Date(leaveMs);
  let h = leave.getUTCHours(), m = leave.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
}

function detectEmoji(title, defaultEmoji) {
  if (!title) return defaultEmoji;
  const t = title.toLowerCase();
  if (/baseball|softball|prime synergy/i.test(t)) return '⚾';
  if (/volleyball|south bay/i.test(t)) return '🏐';
  if (/basketball/i.test(t)) return '🏀';
  if (/soccer/i.test(t)) return '⚽';
  if (/football/i.test(t)) return '🏈';
  if (/swim/i.test(t)) return '🏊';
  if (/tennis/i.test(t)) return '🎾';
  return defaultEmoji;
}

async function fetchICS(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function parseICSEvents(icsText, kidName, defaultEmoji) {
  const events = [];
  const unfolded = icsText.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r\n|\n|\r/);
  let current = null;
  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) { current = {}; }
    else if (line.startsWith('END:VEVENT') && current) {
      if (current.start) events.push({ ...current, kidName, defaultEmoji });
      current = null;
    } else if (current) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const keyPart = line.substring(0, colonIdx);
      const val = line.substring(colonIdx + 1).trim();
      const k = keyPart.split(';')[0].toUpperCase();
      if (k === 'SUMMARY') current.title = val.replace(/\\,/g, ',').replace(/\\/g, '');
      else if (k === 'DTSTART') {
        const parsed = parseICSDate(val);
        if (parsed) { current.start = parsed.date; current.allDay = parsed.allDay; }
      }
      else if (k === 'LOCATION') current.location = val.replace(/\\,/g, ',').replace(/\\/g, '');
    }
  }
  return events;
}

async function getTodayEvents() {
  const todayStr = getTodayStr();
  const todayEvents = [];

  for (const feed of FEEDS) {
    try {
      const ics = await fetchICS(feed.url);
      const events = parseICSEvents(ics, feed.name, feed.emoji);
      for (const e of events) {
        if (!e.start) continue;
        const d = e.start;
        const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
        if (dateStr === todayStr) {
          todayEvents.push({
            kidName: e.kidName,
            title: e.title || 'Event',
            location: e.location || '',
            startDate: e.start,
            timeStr: formatTimePT(e.start, e.allDay),
            allDay: e.allDay,
            emoji: detectEmoji(e.title, e.defaultEmoji)
          });
        }
      }
    } catch (err) {
      console.error(`Error loading feed for ${feed.name}:`, err.message);
    }
  }

  return todayEvents.sort((a, b) => a.startDate - b.startDate);
}

async function getDriveTimeMinutes(destination) {
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${encodeURIComponent(HOME_ADDRESS)}` +
      `&destinations=${encodeURIComponent(destination)}` +
      `&departure_time=now` +
      `&key=${GOOGLE_MAPS_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    const element = data?.rows?.[0]?.elements?.[0];
    if (element?.status === 'OK') {
      return Math.round((element.duration_in_traffic?.value || element.duration?.value) / 60);
    }
  } catch (e) { console.warn('Drive time error:', e.message); }
  return null;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
