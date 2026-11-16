// scratch/capture_v118_interval.mjs
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

const PORT = 4181;
server.listen(PORT, async () => {
  console.log(`Server started on http://127.0.0.1:${PORT}`);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debugPort = 9231;
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

    // 保留2でスピン開始
    console.log('Triggering slot spin with 2 holds...');
    await sendCDP('Runtime.evaluate', {
      expression: `
        (() => {
          window.game.slotHoldCount = 2;
          window.game.startSlotSpin();
        })()
      `,
    });

    // 2.0秒待機（スピン終了直後：0.6秒インターバル中）
    await new Promise((r) => setTimeout(r, 2000));
    const status1 = await sendCDP('Runtime.evaluate', {
      expression: `
        ({
          isSpinning: window.game.isSlotSpinning,
          holds: window.game.slotHoldCount,
          cooldown: window.game.slotRestartCooldown
        })
      `,
      returnByValue: true,
    });
    console.log('Status right after stop (interval active):', status1.result.value);

    // さらに0.7秒待機（0.6秒インターバル経過後：再始動中）
    await new Promise((r) => setTimeout(r, 700));
    const status2 = await sendCDP('Runtime.evaluate', {
      expression: `
        ({
          isSpinning: window.game.isSlotSpinning,
          holds: window.game.slotHoldCount,
          cooldown: window.game.slotRestartCooldown
        })
      `,
      returnByValue: true,
    });
    console.log('Status after 0.6s interval (restarted):', status2.result.value);

    ws.close();
  } catch (err) {
    console.error('Capture Error:', err);
  } finally {
    chrome.kill();
    server.close();
    process.exit(0);
  }
});
