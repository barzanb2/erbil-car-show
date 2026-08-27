const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

let ready = false;
let qrDataUrl = null;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  }
});

client.on('qr', async qr => {
  ready = false;
  qrDataUrl = await QRCode.toDataURL(qr);
  console.log('WhatsApp QR ready. Open /qr in your browser.');
});
client.on('ready', () => {
  ready = true;
  qrDataUrl = null;
  console.log('ZEBAZ WhatsApp connected.');
});
client.on('disconnected', () => { ready = false; });
client.initialize();

app.get('/', (req, res) => res.json({ service: 'ZEBAZ WhatsApp', ready }));
app.get('/status', (req, res) => res.json({ ready, needsQr: !ready && !!qrDataUrl }));
app.get('/qr', (req, res) => {
  if (ready) return res.send('<h2>WhatsApp is connected ✅</h2>');
  if (!qrDataUrl) return res.send('<h2>Waiting for QR… refresh shortly.</h2>');
  res.send(`<html><body style="background:#050505;color:white;text-align:center;font-family:Arial;padding:30px"><h1>ZEBAZ WhatsApp</h1><p>WhatsApp → Linked devices → Link a device</p><img style="max-width:360px;width:90%;background:white;padding:15px" src="${qrDataUrl}"></body></html>`);
});

app.post('/send-booking', async (req, res) => {
  try {
    if (!ready) return res.status(503).json({ ok: false, error: 'WhatsApp is not connected' });
    const { to = '9647502122220', message, pdfBase64, filename = 'ZEBAZ-Booking.pdf' } = req.body;
    const digits = String(to).replace(/\D/g, '');
    if (!digits || !message) return res.status(400).json({ ok: false, error: 'to and message are required' });
    const chatId = `${digits}@c.us`;
    if (pdfBase64) {
      const clean = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      const media = new MessageMedia('application/pdf', clean, filename);
      await client.sendMessage(chatId, media, { caption: message });
    } else {
      await client.sendMessage(chatId, message);
    }
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`ZEBAZ backend running on port ${port}`));
