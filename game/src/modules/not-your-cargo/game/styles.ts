const CSS = `
.nyc-root{position:absolute;inset:0;overflow:hidden;background:#1d1714;font-family:"Segoe UI",Arial,sans-serif;color:#f4ead8;user-select:none;-webkit-user-select:none;touch-action:none}
.nyc-stage{position:absolute;inset:0}
.nyc-stage canvas{display:block}
.nyc-hud{position:absolute;inset:0;pointer-events:none;padding:calc(var(--idos-safe-top,0px) + 10px) 12px 12px;font-size:14px}
.nyc-hud-left{position:absolute;left:64px;top:calc(var(--idos-safe-top,0px) + 10px);display:flex;flex-direction:column;gap:6px}
.nyc-hud-right{position:absolute;right:12px;top:calc(var(--idos-safe-top,0px) + 10px);background:#0009;border-radius:6px;padding:4px 8px;font-size:12px}
.nyc-hud-right.bad{background:#b3261e;font-weight:700}
.nyc-hud-top{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--idos-safe-top,0px) + 10px);display:flex;flex-direction:column;align-items:center;gap:6px;max-width:60%}
.nyc-hp{position:relative;width:180px;height:16px;background:#0009;border:2px solid #000;border-radius:4px;overflow:hidden}
.nyc-hp i{position:absolute;inset:0 auto 0 0;background:#4fd18b}
.nyc-hp b{position:absolute;inset:0;text-align:center;font-size:11px;line-height:12px;color:#fff}
.nyc-chips{display:flex;gap:6px;flex-wrap:wrap}
.nyc-chips span{background:#000a;border-radius:4px;padding:2px 7px;font-size:12px}
.nyc-cargo-chip{color:#ff7a1a;font-weight:900}
.nyc-boss{width:min(420px,60vw);height:12px;background:#000b;border:2px solid #000;border-radius:4px;overflow:hidden}
.nyc-boss i{display:block;height:100%;background:#ff3b3b}
.nyc-objective{background:#000b;border-left:4px solid #ff7a1a;padding:5px 10px;border-radius:4px;font-weight:600;text-align:center}
.nyc-tip{background:#ffffffd9;color:#1d1714;padding:3px 9px;border-radius:4px;font-size:13px}
.nyc-warn{background:#b3261e;padding:3px 9px;border-radius:4px;font-size:13px}
.nyc-score{background:#000b;padding:2px 14px;border-radius:6px;font-size:26px;font-weight:900;display:flex;gap:6px;align-items:baseline}
.nyc-score small{font-size:13px;font-weight:600;margin-left:8px;color:#e9d7b6}
.nyc-big{font-size:40px;font-weight:900;text-shadow:0 2px 0 #000}
.nyc-overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:#140f0dcc;padding:16px;overflow:auto}
.nyc-overlay.on{display:flex}
.nyc-overlay.dim{background:#140f0d88}
.nyc-overlay.menu{background:radial-gradient(circle at 50% 30%,#3a2a20,#140f0d)}
.nyc-panel,.nyc-menu{background:#241c18;border:2px solid #ff7a1a;border-radius:10px;padding:18px 20px;max-width:520px;width:100%;display:flex;flex-direction:column;gap:9px;box-shadow:0 10px 40px #0008}
.nyc-menu{border:none;background:transparent;box-shadow:none;align-items:stretch;max-width:560px}
.nyc-banner{width:100%;border-radius:8px;display:block}
@media (max-height:760px){.nyc-overlay{align-items:flex-start;padding:10px}.nyc-menu{gap:6px;max-width:520px}.nyc-banner{max-height:22vh;object-fit:cover}.nyc-menu .nyc-btn{min-height:36px;padding:7px 10px}.nyc-trail{padding:6px 8px;gap:4px}.nyc-help{display:none}}
.nyc-panel h2{margin:0 0 4px;font-size:24px;letter-spacing:.5px;color:#ffb36b;text-transform:uppercase}
.nyc-panel p,.nyc-menu p{margin:0;line-height:1.4}
.nyc-muted{color:#cbb89b;font-size:13px}
.nyc-help{color:#9d8b74;font-size:11px}
.nyc-story{max-width:620px}
.nyc-story-text{font-size:19px;line-height:1.5}
.nyc-dots{text-align:center;color:#ff7a1a;letter-spacing:4px}
.nyc-error{color:#ff8a80;font-weight:600}
.nyc-ok{color:#4fd18b;font-weight:700}
.nyc-paints{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.nyc-paint{position:relative;padding-left:30px!important}
.nyc-paint::before{content:"";position:absolute;left:9px;top:50%;width:14px;height:14px;margin-top:-7px;border-radius:50%;background:var(--swatch)}
.nyc-nft-btn{min-height:30px!important;padding:4px 10px!important;margin-top:6px;font-size:13px}
.nyc-ach-list{display:flex;flex-direction:column;gap:6px;max-height:min(52vh,420px);overflow-y:auto;padding-right:4px}
.nyc-ach{border:1px solid #3a302a;border-radius:6px;padding:6px 10px;opacity:.75}
.nyc-ach.done{opacity:1;border-color:#ffc24a}
.nyc-ach.fresh{box-shadow:0 0 0 2px #ff7a1a}
.nyc-ach-bar{height:4px;margin-top:4px;border-radius:2px;background:linear-gradient(90deg,#ff7a1a var(--p),#3a302a var(--p))}
.nyc-stars{font-size:30px;color:#ffc24a;letter-spacing:4px;text-align:center}
.nyc-radio{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--idos-safe-bottom,0px) + 14px);max-width:min(620px,80%);background:#0d0b0acc;border:1px solid #ff7a1a;border-radius:6px;padding:6px 12px;font-size:14px;color:#f4ead8;text-align:center}
@media (pointer:coarse){.nyc-radio{bottom:auto;top:calc(var(--idos-safe-top,0px) + 96px)}}
.nyc-trail{border:1px solid #5a4a40;border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:6px;background:#1d1714aa}
.nyc-row{display:flex;gap:8px;flex-wrap:wrap}
.nyc-row .nyc-btn{flex:1}
.nyc-btn{font:inherit;font-weight:700;background:#3a2e28;color:#f4ead8;border:2px solid #5a4a40;border-radius:7px;padding:10px 12px;cursor:pointer;min-height:44px}
.nyc-btn:hover:not(:disabled){border-color:#ff7a1a}
.nyc-btn.primary{background:#ff7a1a;border-color:#ff7a1a;color:#1d1714}
.nyc-btn:disabled{opacity:.45;cursor:not-allowed}
.nyc-touch{position:absolute;inset:0;pointer-events:none;display:none}
.nyc-root.play .nyc-touch{display:block}
.nyc-stick{position:absolute;bottom:max(16px,env(safe-area-inset-bottom));width:min(140px,34vh);height:min(140px,34vh);border-radius:50%;background:#ffffff1a;border:2px solid #ffffff40;pointer-events:auto;touch-action:none}
.nyc-stick-left{left:24px}.nyc-stick-right{right:24px}
.nyc-knob{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px;border-radius:50%;background:#ffffff66}
.nyc-tbtns{position:absolute;right:calc(min(140px,34vh) + 40px);bottom:20px;display:grid;grid-template-columns:repeat(2,52px);gap:8px;pointer-events:auto}
.nyc-tbtn{width:52px;height:52px;border-radius:50%;border:2px solid #fff6;background:#0007;color:#fff;font-weight:900;font-size:18px;touch-action:none}
.nyc-tpause{position:absolute;right:12px;top:calc(var(--idos-safe-top,0px) + 44px);width:44px;height:44px;pointer-events:auto}
.nyc-rotate{display:none;position:absolute;inset:0;z-index:20;align-items:center;justify-content:center;text-align:center;padding:24px;background:#140f0df2;color:#ffb36b;font-size:20px;font-weight:800}
@media (orientation:portrait) and (max-width:820px){.nyc-root.play .nyc-rotate{display:flex}}
@media (max-height:460px){.nyc-hud{font-size:12px}.nyc-hp{width:120px;height:13px}.nyc-objective{padding:3px 8px;font-size:12px}.nyc-score{font-size:20px}.nyc-big{font-size:30px}.nyc-chips span{font-size:11px}.nyc-hud-top{max-width:52%}}
`;

export function injectStyles(): void {
  if (document.getElementById("nyc-styles")) return;
  const s = document.createElement("style");
  s.id = "nyc-styles";
  s.textContent = CSS;
  document.head.appendChild(s);
}
