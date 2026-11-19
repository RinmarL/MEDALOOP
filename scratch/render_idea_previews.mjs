// scratch/render_idea_previews.mjs
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

const PORT = 4188;
server.listen(PORT, async () => {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debugPort = 9238;
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

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
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

    // 右上ツリーのギミック（ホットスロット・スプリットライン・ワープホール）を解放した状態にする
    await sendCDP('Runtime.evaluate', {
      expression: `
        localStorage.setItem('hexamedal_save_v3', JSON.stringify({
          score: 50000,
          levels: { c0: 1, r1_0: 1, r1_1: 1, hot_slot: 1, r3_0: 1, outer_0: 1, r1_3: 1, r1_4: 1 }
        }));
      `,
    });
    await sendCDP('Page.reload');
    await new Promise((r) => setTimeout(r, 1000));

    await sendCDP('Runtime.evaluate', {
      expression: `document.getElementById('btn-start-play').click()`,
    });
    await new Promise((r) => setTimeout(r, 600));

    // アニメーションループを一旦止めて、同じ盤面ベースで3案のオーバーレイを正確に描画できるようにする
    await sendCDP('Runtime.evaluate', {
      expression: `
        (() => {
          const g = window.game;
          // 盤面にメダルを見栄えよく配置
          g.physics.medals = g.physics.medals.filter(m => m.zone === 'tray');
          const placements = [
            { x: 145, y: 175, type: 'normal', mult: 1.5 },
            { x: 295, y: 165, type: 'rush', mult: 2.0 },
            { x: 118, y: 270, type: 'bounce', mult: 2.0 },
            { x: 342, y: 280, type: 'normal', mult: 1.5 },
            { x: 175, y: 360, type: 'normal', mult: 2.0 },
            { x: 285, y: 350, type: 'gold', mult: 3.0 },
            { x: 120, y: 425, type: 'normal', mult: 1.5 },
            { x: 230, y: 430, type: 'normal', mult: 2.0 },
            { x: 335, y: 418, type: 'normal', mult: 1.5 },
          ];
          for (const p of placements) {
            const m = g.physics.spawnMedal(p.x, p.y, p.type, 'board');
            m.vx = 0; m.vy = 0;
            m.chargeMultiplier = p.mult;
          }
          g.timeRemaining = 12.4;
          g.score = 12840;
          g.updateScoreHUD();
          g.elTimer.textContent = '12.4s';
          // 物理更新を止めて静止フレームでレンダリングできるようにする
          g.updatePlayPhase = () => {};
          g.renderPlayPhase();
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 200));

    // === 案3：パルス・リアクター（衝突チャージ衝撃波） ===
    await sendCDP('Runtime.evaluate', {
      expression: `
        (() => {
          const g = window.game;
          const origRender = g.renderPlayPhase.bind(g);
          window.__origRender = origRender;
          g.renderPlayPhase = function() {
            origRender();
            const ctx = g.ctx;
            const cx = 230, cy = 278;

            ctx.save();
            // クリップ
            g.tracePlayfieldPath(ctx);
            ctx.clip();

            // 1. 盤面全体のフラッシュオーラ
            const flash = ctx.createRadialGradient(cx, cy, 10, cx, cy, 260);
            flash.addColorStop(0, 'rgba(224, 242, 254, 0.55)');
            flash.addColorStop(0.32, 'rgba(0, 242, 254, 0.28)');
            flash.addColorStop(0.65, 'rgba(236, 72, 153, 0.16)');
            flash.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = flash;
            ctx.fillRect(0, 0, 460, 560);

            // 2. 多重ショックウェーブ（巨大衝撃波リング）
            const rings = [
              { r: 72, w: 4.5, col: '#ffffff', glow: '#38bdf8', a: 0.95 },
              { r: 138, w: 6.0, col: '#00f2fe', glow: '#00f2fe', a: 0.88 },
              { r: 198, w: 3.5, col: '#f472b6', glow: '#ec4899', a: 0.72 },
              { r: 245, w: 2.0, col: '#bae6fd', glow: '#38bdf8', a: 0.45 },
            ];
            for (const rg of rings) {
              ctx.save();
              ctx.globalAlpha = rg.a;
              ctx.shadowColor = rg.glow;
              ctx.shadowBlur = 18;
              ctx.strokeStyle = rg.col;
              ctx.lineWidth = rg.w;
              ctx.beginPath();
              ctx.arc(cx, cy, rg.r, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }

            // 3. 放射状スピード光線＆スパーク
            for (let i = 0; i < 24; i++) {
              const ang = (i / 24) * Math.PI * 2 + 0.13;
              const r1 = 35 + (i % 3) * 18;
              const r2 = 165 + (i % 4) * 28;
              ctx.save();
              ctx.strokeStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.65)' : 'rgba(244, 114, 182, 0.55)';
              ctx.lineWidth = i % 3 === 0 ? 2.5 : 1.4;
              ctx.beginPath();
              ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
              ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
              ctx.stroke();
              ctx.restore();
            }

            // 4. 中央リアクターコア（満タン発光）
            ctx.save();
            ctx.shadowColor = '#00f2fe';
            ctx.shadowBlur = 26;
            const coreG = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
            coreG.addColorStop(0, '#ffffff');
            coreG.addColorStop(0.45, '#67e8f9');
            coreG.addColorStop(0.85, '#0284c7');
            coreG.addColorStop(1, 'rgba(2,132,199,0)');
            ctx.fillStyle = coreG;
            ctx.beginPath();
            ctx.arc(cx, cy, 26, 0, Math.PI * 2);
            ctx.fill();
            // 外周リングゲージ（満タン）
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.arc(cx, cy, 22, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // 5. 全メダルの上向き吹き上がりトレイル＆倍率上昇エフェクト
            for (const m of g.physics.medals) {
              if (m.zone !== 'board') continue;
              ctx.save();
              const tr = ctx.createLinearGradient(m.x, m.y, m.x, m.y + 68);
              tr.addColorStop(0, 'rgba(103, 232, 249, 0.85)');
              tr.addColorStop(0.5, 'rgba(244, 114, 182, 0.45)');
              tr.addColorStop(1, 'rgba(56, 189, 248, 0)');
              ctx.strokeStyle = tr;
              ctx.lineWidth = 14;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(m.x, m.y + 4);
              ctx.lineTo(m.x, m.y + 64);
              ctx.stroke();

              // 吹き上がり光輪
              ctx.strokeStyle = '#fef08a';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(m.x, m.y, m.radius + 5, 0, Math.PI * 2);
              ctx.stroke();

              // 上向き矢印アクセント
              ctx.fillStyle = '#ffffff';
              ctx.font = '900 11px sans-serif';
              ctx.textAlign = 'center';
              ctx.shadowColor = '#00f2fe';
              ctx.shadowBlur = 8;
              ctx.fillText('▲ +0.5', m.x, m.y - 20);
              ctx.restore();

              g.drawMedalGraphic(ctx, m.x, m.y, m.radius, m.type, m.chargeMultiplier + 0.5, 0.9);
            }

            // 6. 左右サイドのチャージMAXネオンゲージ
            for (const sx of [26, 434]) {
              ctx.save();
              ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
              ctx.beginPath();
              ctx.roundRect(sx - 4, 175, 8, 170, 4);
              ctx.fill();
              const barG = ctx.createLinearGradient(0, 345, 0, 175);
              barG.addColorStop(0, '#00f2fe');
              barG.addColorStop(0.5, '#f472b6');
              barG.addColorStop(1, '#fef08a');
              ctx.shadowColor = '#00f2fe';
              ctx.shadowBlur = 12;
              ctx.fillStyle = barG;
              ctx.beginPath();
              ctx.roundRect(sx - 3, 177, 6, 166, 3);
              ctx.fill();
              ctx.restore();
            }

            ctx.restore();
          };
          g.renderPlayPhase();
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 200));
    const shot3 = await sendCDP('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'preview_idea3_pulse_reactor.png'), Buffer.from(shot3.result.data, 'base64'));
    console.log('Saved preview_idea3_pulse_reactor.png');

    // === 案8：メテオメダル（巨大隕石コイン降臨） ===
    await sendCDP('Runtime.evaluate', {
      expression: `
        (() => {
          const g = window.game;
          const origRender = window.__origRender;
          g.renderPlayPhase = function() {
            origRender();
            const ctx = g.ctx;
            const mx = 205, my = 295, mr = 27; // 通常15pxの1.8倍！

            ctx.save();
            g.tracePlayfieldPath(ctx);
            ctx.clip();

            // 1. 上空からの灼熱メテオトレイル（斜め軌道）
            ctx.save();
            const trailGrad = ctx.createLinearGradient(mx, my, mx + 95, my - 230);
            trailGrad.addColorStop(0, 'rgba(251, 146, 60, 0.92)');
            trailGrad.addColorStop(0.28, 'rgba(239, 68, 68, 0.65)');
            trailGrad.addColorStop(0.65, 'rgba(234, 179, 8, 0.25)');
            trailGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
            ctx.fillStyle = trailGrad;
            ctx.beginPath();
            ctx.moveTo(mx - 24, my - 6);
            ctx.lineTo(mx + 24, my + 8);
            ctx.lineTo(mx + 102, my - 220);
            ctx.lineTo(mx + 76, my - 228);
            ctx.closePath();
            ctx.fill();

            // 炎の内芯トレイル
            const innerGrad = ctx.createLinearGradient(mx, my, mx + 60, my - 150);
            innerGrad.addColorStop(0, 'rgba(254, 249, 195, 0.95)');
            innerGrad.addColorStop(0.5, 'rgba(251, 146, 60, 0.5)');
            innerGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
            ctx.fillStyle = innerGrad;
            ctx.beginPath();
            ctx.moveTo(mx - 12, my - 4);
            ctx.lineTo(mx + 12, my + 4);
            ctx.lineTo(mx + 65, my - 145);
            ctx.lineTo(mx + 50, my - 150);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // 2. 周囲への衝撃波リング（バンパー・通常メダルを弾き飛ばす演出）
            ctx.save();
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 20;
            ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(mx, my, mr + 16, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(249, 115, 22, 0.55)';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(mx, my, mr + 34, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // 3. 飛散する火の粉・星屑スパーク
            const sparks = [
              [-38, -28, 3.5], [44, -18, 4.2], [-45, 22, 3.0], [38, 36, 3.8],
              [12, -58, 3.2], [52, -75, 2.8], [-22, -48, 2.5], [70, -110, 3.0],
              [35, -125, 2.6], [-54, -8, 2.5], [18, 48, 3.2], [-30, 44, 2.8],
              [62, 10, 2.5], [84, -165, 2.4]
            ];
            for (const [dx, dy, sr] of sparks) {
              ctx.save();
              ctx.shadowColor = '#f97316';
              ctx.shadowBlur = 8;
              ctx.fillStyle = sr > 3.2 ? '#fef08a' : '#fb923c';
              ctx.beginPath();
              ctx.arc(mx + dx, my + dy, sr, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }

            // 4. 弾き飛ばされる通常メダルへの吹き飛びエフェクト
            const knocked = [
              { x: 118, y: 270, vx: -42, vy: -18 },
              { x: 175, y: 360, vx: -16, vy: 36 },
            ];
            for (const k of knocked) {
              ctx.save();
              ctx.strokeStyle = 'rgba(254, 240, 138, 0.75)';
              ctx.lineWidth = 2.2;
              ctx.beginPath();
              ctx.moveTo(k.x, k.y);
              ctx.lineTo(k.x - k.vx, k.y - k.vy);
              ctx.stroke();
              ctx.restore();
            }

            // 5. 巨大メテオメダル本体（炎コロナ＋マグマゴールド立体コイン）
            ctx.save();
            // 外周炎コロナ
            const corona = ctx.createRadialGradient(mx, my, mr * 0.7, mx, my, mr + 14);
            corona.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
            corona.addColorStop(0.5, 'rgba(249, 115, 22, 0.65)');
            corona.addColorStop(1, 'rgba(239, 68, 68, 0)');
            ctx.fillStyle = corona;
            ctx.beginPath();
            ctx.arc(mx, my, mr + 14, 0, Math.PI * 2);
            ctx.fill();

            // コイン外周リム
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 22;
            const bodyGrad = ctx.createRadialGradient(mx - 8, my - 8, 3, mx, my, mr);
            bodyGrad.addColorStop(0, '#fffbeb');
            bodyGrad.addColorStop(0.32, '#facc15');
            bodyGrad.addColorStop(0.72, '#ea580c');
            bodyGrad.addColorStop(1, '#7c2d12');
            ctx.fillStyle = bodyGrad;
            ctx.beginPath();
            ctx.arc(mx, my, mr, 0, Math.PI * 2);
            ctx.fill();

            ctx.lineWidth = 3.0;
            ctx.strokeStyle = '#fef08a';
            ctx.stroke();

            // 内周装飾リング
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(mx, my, mr - 5, 0, Math.PI * 2);
            ctx.stroke();

            // 中央の星＆倍率刻印
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 15px Consolas, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = '#9a3412';
            ctx.shadowBlur = 4;
            ctx.fillText('★x5', mx, my + 1);
            ctx.restore();

            ctx.restore();
          };
          g.renderPlayPhase();
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 200));
    const shot8 = await sendCDP('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'preview_idea8_meteor_medal.png'), Buffer.from(shot8.result.data, 'base64'));
    console.log('Saved preview_idea8_meteor_medal.png');

    // === 案5アレンジ：スターフォール（流星群＆ゴールド昇格） ===
    await sendCDP('Runtime.evaluate', {
      expression: `
        (() => {
          const g = window.game;
          const origRender = window.__origRender;
          g.renderPlayPhase = function() {
            origRender();
            const ctx = g.ctx;

            ctx.save();
            g.tracePlayfieldPath(ctx);
            ctx.clip();

            // 1. 夜空に輝く4本の流星群（右上→左下へ斜めに駆け抜ける）
            const meteors = [
              { x: 145, y: 175, len: 165, w: 7.5, col1: '#fef08a', col2: '#38bdf8' },
              { x: 230, y: 270, len: 190, w: 9.0, col1: '#ffffff', col2: '#facc15' },
              { x: 175, y: 360, len: 175, w: 8.0, col1: '#fef08a', col2: '#f472b6' },
              { x: 315, y: 390, len: 145, w: 6.5, col1: '#e0f2fe', col2: '#38bdf8' },
            ];

            const draw4Star = (cx, cy, rOuter, rInner, color) => {
              ctx.save();
              ctx.fillStyle = color;
              ctx.shadowColor = color;
              ctx.shadowBlur = 14;
              ctx.beginPath();
              for (let i = 0; i < 8; i++) {
                const r = i % 2 === 0 ? rOuter : rInner;
                const a = (i * Math.PI) / 4;
                const px = cx + Math.cos(a) * r;
                const py = cy + Math.sin(a) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
              }
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            };

            const dxUnit = 0.76;  // 尾が伸びる右上方向
            const dyUnit = -0.65;

            for (const mt of meteors) {
              const ex = mt.x + dxUnit * mt.len;
              const ey = mt.y + dyUnit * mt.len;

              // 光帯テール
              ctx.save();
              const tg = ctx.createLinearGradient(mt.x, mt.y, ex, ey);
              tg.addColorStop(0, mt.col1);
              tg.addColorStop(0.35, mt.col2);
              tg.addColorStop(1, 'rgba(56, 189, 248, 0)');
              ctx.strokeStyle = tg;
              ctx.lineWidth = mt.w;
              ctx.lineCap = 'round';
              ctx.shadowColor = mt.col2;
              ctx.shadowBlur = 14;
              ctx.beginPath();
              ctx.moveTo(mt.x, mt.y);
              ctx.lineTo(ex, ey);
              ctx.stroke();

              // 中心白芯
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
              ctx.lineWidth = mt.w * 0.32;
              ctx.beginPath();
              ctx.moveTo(mt.x, mt.y);
              ctx.lineTo(mt.x + dxUnit * mt.len * 0.55, mt.y + dyUnit * mt.len * 0.55);
              ctx.stroke();
              ctx.restore();

              // 星屑パーティクル（尾に沿って散らす）
              for (let s = 1; s <= 7; s++) {
                const t = s / 8;
                const sx = mt.x + dxUnit * mt.len * t + Math.sin(s * 3.7 + mt.x) * 11;
                const sy = mt.y + dyUnit * mt.len * t + Math.cos(s * 2.9 + mt.y) * 11;
                draw4Star(sx, sy, 4.5 - t * 2, 1.4, s % 2 === 0 ? '#fef08a' : '#bae6fd');
              }

              // 流星ヘッドの4点星コア
              draw4Star(mt.x, mt.y, 13, 3.8, '#ffffff');
            }

            // 2. 流星に触れてゴールドメダルへ昇格する瞬間（2枚のメダルを金色昇格スパーク）
            const upgraded = [
              { x: 145, y: 175 },
              { x: 175, y: 360 },
            ];
            for (const u of upgraded) {
              ctx.save();
              // 黄金昇格バーストリング
              ctx.shadowColor = '#facc15';
              ctx.shadowBlur = 22;
              ctx.strokeStyle = '#fef08a';
              ctx.lineWidth = 3.2;
              ctx.beginPath();
              ctx.arc(u.x, u.y, 26, 0, Math.PI * 2);
              ctx.stroke();

              ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
              ctx.lineWidth = 1.6;
              ctx.beginPath();
              ctx.arc(u.x, u.y, 38, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();

              // ゴールドメダルとして上書き描画
              g.drawMedalGraphic(ctx, u.x, u.y, 15, 'gold', 3.0, 1.0);

              // 周囲の4点星スパークル
              draw4Star(u.x - 24, u.y - 16, 7, 2, '#fef08a');
              draw4Star(u.x + 25, u.y - 14, 6, 1.8, '#ffffff');
              draw4Star(u.x + 18, u.y + 22, 5.5, 1.6, '#fde047');

              ctx.save();
              ctx.font = '900 11px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillStyle = '#fef08a';
              ctx.shadowColor = '#f59e0b';
              ctx.shadowBlur = 10;
              ctx.fillText('✦ GOLD UP!', u.x, u.y - 28);
              ctx.restore();
            }

            ctx.restore();
          };
          g.renderPlayPhase();
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 200));
    const shot5 = await sendCDP('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'preview_idea5_starfall.png'), Buffer.from(shot5.result.data, 'base64'));
    console.log('Saved preview_idea5_starfall.png');

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chrome.kill();
    server.close();
    process.exit(0);
  }
});
