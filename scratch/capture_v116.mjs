// scratch/capture_v116.mjs
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

const PORT = 4179;
server.listen(PORT, async () => {
  console.log(`Server started on http://127.0.0.1:${PORT}`);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debugPort = 9229;
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=480,820',
    `http://127.0.0.1:${PORT}`,
  ]);

  console.log('Chrome spawned, waiting for CDP...');
  await new Promise((r) => setTimeout(r, 1500));

  try {
    // CDP WebSocket URL を取得
    const verRes = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
    const verData = await verRes.json();
    console.log('CDP Version:', verData['User-Agent']);

    const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const listData = await listRes.json();
    const page = listData.find((t) => t.type === 'page');
    if (!page) throw new Error('No page found');

    const wsUrl = page.webSocketDebuggerUrl;
    console.log('Connecting to WebSocket:', wsUrl);

    // WebSocket 接続
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

    // スキルツリーの hot_slot を解放したセーブデータを注入
    console.log('Injecting save data with hot_slot unlocked...');
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

    // リロード
    await sendCDP('Page.reload');
    await new Promise((r) => setTimeout(r, 1200));

    // 「プレイ」ボタン（#btn-start-play）をクリック
    console.log('Clicking Play button...');
    await sendCDP('Runtime.evaluate', {
      expression: `
        (() => {
          const playBtn = document.getElementById('btn-start-play');
          if (playBtn) playBtn.click();
        })()
      `,
    });

    // プレイ画面が立ち上がり、スロット窓とHOTポケットが描画されるまで少し待機
    await new Promise((r) => setTimeout(r, 1500));

    // スクリーンショット撮影
    console.log('Capturing screenshot of play phase with slot...');
    const shotRes = await sendCDP('Page.captureScreenshot', { format: 'png' });
    const shotBuffer = Buffer.from(shotRes.result.data, 'base64');
    fs.writeFileSync('scratch/shot_v116_slot_play.png', shotBuffer);
    console.log('Saved scratch/shot_v116_slot_play.png');

    // スキルツリー画面も撮影してみよう
    console.log('Clicking tree button to inspect Skill Tree...');
    // 一度リロードしてホーム画面から「強化」ボタンをクリック
    await sendCDP('Page.reload');
    await new Promise((r) => setTimeout(r, 1000));
    await sendCDP('Runtime.evaluate', {
      expression: `
        (() => {
          const treeBtn = document.getElementById('btn-open-tree');
          if (treeBtn) treeBtn.click();
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 1200));

    const shotTreeRes = await sendCDP('Page.captureScreenshot', { format: 'png' });
    const shotTreeBuffer = Buffer.from(shotTreeRes.result.data, 'base64');
    fs.writeFileSync('scratch/shot_v116_tree.png', shotTreeBuffer);
    console.log('Saved scratch/shot_v116_tree.png');

    ws.close();
  } catch (err) {
    console.error('Capture Error:', err);
  } finally {
    chrome.kill();
    server.close();
    process.exit(0);
  }
});
