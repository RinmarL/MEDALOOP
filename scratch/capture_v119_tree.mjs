// scratch/capture_v119_tree.mjs
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

const PORT = 4185;
server.listen(PORT, async () => {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debugPort = 9235;
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

    // c0 と r1_0 を解放し、所持ポイント 1000 PT でツリーを開く
    await sendCDP('Runtime.evaluate', {
      expression: `
        (() => {
          localStorage.setItem('hexamedal_save_v3', JSON.stringify({
            score: 1000,
            levels: { c0: 1, r1_0: 1 }
          }));
        })()
      `,
    });

    await sendCDP('Page.reload');
    await new Promise((r) => setTimeout(r, 1000));

    await sendCDP('Runtime.evaluate', {
      expression: `document.getElementById('btn-open-tree').click()`,
    });
    await new Promise((r) => setTimeout(r, 900));

    // 全表示ボタンを押し、jp_freeze を選択状態にする
    await sendCDP('Runtime.evaluate', {
      expression: `
        (() => {
          document.getElementById('btn-tree-debug-reveal').click();
          window.game.selectedNodeId = 'jp_freeze';
          window.game.updateTreeUI();
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 600));

    const shotRes = await sendCDP('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/shot_v119_jp_tree.png', Buffer.from(shotRes.result.data, 'base64'));
    console.log('Captured scratch/shot_v119_jp_tree.png, errors:', errors.length);

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chrome.kill();
    server.close();
    process.exit(0);
  }
});
