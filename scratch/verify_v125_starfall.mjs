// scratch/verify_v125_starfall.mjs
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const distDir = path.resolve('dist');
const artifactDir = 'C:\\Users\\SHOOO\\.gemini\\antigravity\\brain\\7d643e75-04a4-451c-91e6-c5535306b686';
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

const PORT = 4189;
server.listen(PORT, async () => {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debugPort = 9239;
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

    // 1. スキルツリー：r3_0解放済み・30000PTで starfall を選択
    await sendCDP('Runtime.evaluate', {
      expression: `
        localStorage.setItem('hexamedal_save_v3', JSON.stringify({
          score: 30000,
          levels: { c0: 1, r1_0: 1, r1_1: 1, hot_slot: 1, r3_0: 1 }
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
          window.game.selectedNodeId = 'starfall';
          window.game.updateTreeUI();
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 500));

    const treeShot = await sendCDP('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'shot_v125_tree_starfall.png'), Buffer.from(treeShot.result.data, 'base64'));

    // 2. starfall購入→プレイ画面で流星群発射＆通常メダルとの接触テスト
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
    await new Promise((r) => setTimeout(r, 400));

    // 通常メダルを盤面全域に並べて流星群を即時発射し、0.75秒分進めて実機キャプチャ＆アサーション
    const simResult = await sendCDP('Runtime.evaluate', {
      expression: `
        (() => {
          const g = window.game;
          g.floatingTexts = [];
          const coords = [
            [140, 185], [220, 215], [300, 170],
            [155, 290], [235, 310], [320, 275],
            [175, 385], [275, 370]
          ];
          for (const [x, y] of coords) {
            const m = g.physics.spawnMedal(x, y, 'normal', 'board');
            m.vx = 0; m.vy = 0;
          }
          g.starfallTimer = 0.01;
          for (let step = 0; step < 46; step++) {
            g.updateStarfall(1 / 60);
          }
          g.renderPlayPhase();
          const boardMedals = g.physics.medals.filter(m => m.zone === 'board');
          return JSON.stringify({
            starfallUnlocked: g.stats.starfallUnlocked,
            meteors: g.starfallMeteors.length,
            sparkles: g.starfallSparkles.length,
            bursts: g.starfallBursts.length,
            upgradedToGold: boardMedals.filter(m => m.type === 'gold').length,
            floatingTextsCount: g.floatingTexts.length
          });
        })()
      `,
    });
    console.log('Starfall simulation result:', simResult.result.result.value);

    const playShot = await sendCDP('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'shot_v125_play_starfall.png'), Buffer.from(playShot.result.data, 'base64'));
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
