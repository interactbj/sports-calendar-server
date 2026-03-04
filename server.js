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

// Health check
app.get('/', (req, res) => {
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
