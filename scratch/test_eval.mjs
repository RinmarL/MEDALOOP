// scratch/test_eval.mjs
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const distDir = path.resolve('dist');

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(distDir, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(4182, async () => {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9232',
    'http://127.0.0.1:4182',
  ]);
  await new Promise((r) => setTimeout(r, 1500));

  try {
    const listRes = await fetch('http://127.0.0.1:9232/json/list');
    const list = await listRes.json();
    const ws = new WebSocket(list[0].webSocketDebuggerUrl);
    let id = 1;
    const send = (method, params = {}) => new Promise((resolve) => {
      const curId = id++;
      const handler = (e) => {
        const d = JSON.parse(e.data);
        if (d.id === curId) {
          ws.removeEventListener('message', handler);
          resolve(d.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
    await new Promise((r) => (ws.onopen = r));

    // セーブデータ注入
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const raw = localStorage.getItem('hexamedal_save_v3');
          let data = raw ? JSON.parse(raw) : {};
          if (!data.levels) data.levels = {};
          data.levels['hot_slot'] = 1;
          localStorage.setItem('hexamedal_save_v3', JSON.stringify(data));
        })()
      `,
    });
    await send('Page.reload');
    await new Promise((r) => setTimeout(r, 1000));
    await send('Runtime.evaluate', { expression: `document.getElementById('btn-start-play').click()` });
    await new Promise((r) => setTimeout(r, 800));

    // 保留2でスピン
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          window.game.slotHoldCount = 2;
          window.game.startSlotSpin();
        })()
      `,
    });

    // 2.05s後（停止直後、0.6sクールダウン中）
    await new Promise((r) => setTimeout(r, 2050));
    const res1 = await send('Runtime.evaluate', {
      expression: `JSON.stringify({ isSpinning: window.game.isSlotSpinning, holds: window.game.slotHoldCount, cooldown: window.game.slotRestartCooldown.toFixed(2) })`,
    });
    console.log('Stop + 0.05s:', res1.result.value);

    // さらに 0.65s後（0.6s経過、再始動後）
    await new Promise((r) => setTimeout(r, 650));
    const res2 = await send('Runtime.evaluate', {
      expression: `JSON.stringify({ isSpinning: window.game.isSlotSpinning, holds: window.game.slotHoldCount, cooldown: window.game.slotRestartCooldown.toFixed(2) })`,
    });
    console.log('Stop + 0.70s:', res2.result.value);

    ws.close();
  } finally {
    chrome.kill();
    server.close();
    process.exit(0);
  }
});
