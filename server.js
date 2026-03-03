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
const HOME_ADDRESS = '2917 Hermosa View Drive, Hermosa Beach, CA 90254';

app.get('/', (req, res) => {
  res.json({ status: 'Sports Calendar Server running ✅' });
});

app.post('/send-sms', async (req, res) => {
  const { to, body } = req.body;
  if (!to || !body) return res.status(400).json({ error: 'Missing to or body' });
  try {
    const client = twilio(TWILIO_SID, TWILIO_TOKEN);
    const message = await client.messages.create({ body, from: TWILIO_FROM, to });
    res.json({ success: true, sid: message.sid });
  } catch (err) {
    console.error('Twilio error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
