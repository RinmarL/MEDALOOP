// scratch/capture_v123_auto_reload.mjs
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
    res.end();
  }
});

const PORT = 4186;
server.listen(PORT, async () => {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debugPort = 9236;
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

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let idCounter = 1;
    const pending = new Map();
    const errors = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails);
      }
    };

    await new Promise((resolve) => (ws.onopen = resolve));

    const sendCDP = (method, params = {}) =>
      new Promise((resolve) => {
        const id = idCounter++;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });

    await sendCDP('Runtime.enable');
    await sendCDP('Page.enable');
    await sendCDP('Emulation.setDeviceMetricsOverride', {
      width: 480,
      height: 820,
      deviceScaleFactor: 2,
      mobile: true,
    });

    // 1. スキルツリー確認：reload_spd_2解放済み、所持20000PTでauto_reload選択
    await sendCDP('Runtime.evaluate', {
      expression: `
        localStorage.setItem('hexamedal_save_v3', JSON.stringify({
          score: 20000,
          levels: { c0: 1, r1_3: 1, r1_2: 1, m2_3: 1, reload_spd_1: 1, reload_spd_2: 1 }
        }));
      `,
    });
    await sendCDP('Page.reload');
    await new Promise((r) => setTimeout(r, 1000));

    await sendCDP('Runtime.evaluate', {
      expression: `document.getElementById('btn-open-tree').click()`,
    });
    await new Promise((r) => setTimeout(r, 800));

    await sendCDP('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btn-tree-debug-reveal').click();
          window.game.selectedNodeId = 'auto_reload';
          window.game.updateTreeUI();
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 500));

    const treeShot = await sendCDP('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/shot_v123_tree_auto_reload.png', Buffer.from(treeShot.result.data, 'base64'));

    // 2. 装填自動化を購入→プレイ画面で下皿回収テスト
    await sendCDP('Runtime.evaluate', {
      expression: `document.getElementById('btn-buy-node').click()`,
    });
    await new Promise((r) => setTimeout(r, 300));
    await sendCDP('Runtime.evaluate', {
      expression: `document.getElementById('btn-tree-back-home').click()`,
    });
    await new Promise((r) => setTimeout(r, 400));
    await sendCDP('Runtime.evaluate', {
      expression: `document.getElementById('btn-start-play').click()`,
    });
    await new Promise((r) => setTimeout(r, 900));

    const testRes = await sendCDP('Runtime.evaluate', {
      expression: `
        (() => {
          const trayMedal = window.game.physics.medals.find(m => m.zone === 'tray');
          const before = {
            autoReloadUnlocked: window.game.stats.autoReloadUnlocked,
            held: window.game.heldQueue.length,
            loaded: window.game.loadedQueue.length,
            inserted: window.game.roundInsertedCount
          };
          if (trayMedal) {
            window.game.tryPickupFromTray(trayMedal.x, trayMedal.y);
          }
          const after = {
            held: window.game.heldQueue.length,
            loaded: window.game.loadedQueue.length,
            inserted: window.game.roundInsertedCount,
            insertAnims: window.game.slotInsertAnims.length
          };
          return JSON.stringify({ before, after });
        })()
      `,
    });
    console.log('Auto-reload pickup test:', testRes.result.result.value);

    await new Promise((r) => setTimeout(r, 150));
    const playShot = await sendCDP('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/shot_v123_play_auto_reload.png', Buffer.from(playShot.result.data, 'base64'));
    console.log('Errors:', errors.length);

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chrome.kill();
    server.close();
    process.exit(0);
  }
});
