// scratch/capture_v116_actions.mjs
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const distDir = path.resolve('dist');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(distDir, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 4180;
server.listen(PORT, async () => {
  console.log(`Server started on http://127.0.0.1:${PORT}`);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debugPort = 9230;
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=480,820',
    `http://127.0.0.1:${PORT}`,
  ]);

  await new Promise((r) => setTimeout(r, 1500));

  try {
    const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const listData = await listRes.json();
    const page = listData.find((t) => t.type === 'page');
    if (!page) throw new Error('No page found');

    const wsUrl = page.webSocketDebuggerUrl;
    const ws = new WebSocket(wsUrl);
    let idCounter = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log(`[Browser Console ${msg.params.type}]`, ...msg.params.args.map((a) => a.value || a.description));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[Browser Exception]', msg.params.exceptionDetails);
      }
    };

    await new Promise((resolve) => (ws.onopen = resolve));

    const sendCDP = (method, params = {}) => {
      return new Promise((resolve) => {
        const id = idCounter++;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    await sendCDP('Runtime.enable');
    await sendCDP('Page.enable');
    await sendCDP('Emulation.setDeviceMetricsOverride', {
      width: 480,
      height: 820,
      deviceScaleFactor: 2,
      mobile: true,
    });

    // hot_slot 解放セーブデータ注入
    await sendCDP('Runtime.evaluate', {
      expression: `
        (() => {
          const raw = localStorage.getItem('hexamedal_save_v3');
          let data = raw ? JSON.parse(raw) : {};
          if (!data.levels) data.levels = {};
          data.levels['hot_slot'] = 1;
          data.score = 50000;
          localStorage.setItem('hexamedal_save_v3', JSON.stringify(data));
        })()
      `,
    });

    await sendCDP('Page.reload');
    await new Promise((r) => setTimeout(r, 1200));

    // プレイ開始
    await sendCDP('Runtime.evaluate', {
      expression: `document.getElementById('btn-start-play').click()`,
    });
    await new Promise((r) => setTimeout(r, 1000));

    // 1. スロット保留を2にし、スピン開始
    console.log('Triggering slot spin...');
    await sendCDP('Runtime.evaluate', {
      expression: `
        (() => {
          window.game.slotHoldCount = 2;
          window.game.startSlotSpin();
        })()
      `,
    });

    // 0.9秒待機（スピン中）
    await new Promise((r) => setTimeout(r, 900));
    console.log('Capturing spinning screenshot...');
    const shotSpinRes = await sendCDP('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/shot_v116_slot_spinning.png', Buffer.from(shotSpinRes.result.data, 'base64'));

    // 赤7当選演出を直接トリガーしてフラッシュとゴールドメダル射出をキャプチャ
    console.log('Triggering Red 7 reward...');
    await sendCDP('Runtime.evaluate', {
      expression: `
        (() => {
          window.game.slotCurrentTarget = '7';
          window.game.slotReelSymbols = ['7', '7', '7'];
          window.game.slotReelStopped = [true, true, true];
          window.game.applySlotReward('7');
        })()
      `,
    });
    // 少し待機（フラッシュ＆シューター射出中）
    await new Promise((r) => setTimeout(r, 250));
    console.log('Capturing Red 7 win screenshot...');
    const shot7Res = await sendCDP('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/shot_v116_slot_7win.png', Buffer.from(shot7Res.result.data, 'base64'));

    ws.close();
  } catch (err) {
    console.error('Capture Error:', err);
  } finally {
    chrome.kill();
    server.close();
    process.exit(0);
  }
});
