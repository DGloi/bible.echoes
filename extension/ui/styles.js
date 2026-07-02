// Shadow-DOM stylesheet for the in-page panel — a deliberately kitsch
// "French-Catholic-church / early-2000s website" theme (stained-glass header,
// gilded medallion, marquee + visitor counter). Lives in the shadow root so the
// host page's CSS can't touch it. (The ::highlight() rules that tint matched page
// text are separate and live in content.css, because highlights are document-scoped.)

export const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: "Palatino Linotype","Book Antiqua",Palatino,"Times New Roman",serif; }
  .fab {
    width: 56px; height: 56px; border-radius: 50%; cursor: grab; border: 3px solid #6b4f12;
    background: radial-gradient(circle at 32% 28%, #fff6cf 0%, #e7c14e 38%, #c8961a 70%, #8a6710 100%);
    box-shadow: 0 4px 14px rgba(0,0,0,.45), inset 0 0 6px rgba(255,255,255,.6);
    color: #5a3d0a; font-size: 30px; line-height: 50px; text-align: center; user-select: none;
    text-shadow: 0 1px 0 #fff7d6; touch-action: none;
  }
  .fab:hover { filter: brightness(1.06); }
  .fab.busy { cursor: progress; animation: spin 1.2s linear infinite; }
  .badge {
    position: absolute; top: -4px; right: -4px; min-width: 20px; height: 20px; border-radius: 10px;
    background: #8b0000; color: #ffe9a8; font: 700 11px/20px serif; text-align: center; padding: 0 5px;
    border: 1px solid #ffe9a8; display: none;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .panel {
    position: fixed; width: 372px; max-height: 78vh; display: none; flex-direction: column; overflow: hidden;
    color: #3a2a12; border-radius: 8px; border: 3px solid #c8961a;
    background:
      repeating-linear-gradient(0deg, rgba(120,90,30,.045) 0 2px, transparent 2px 4px),
      linear-gradient(160deg, #fdf6e3 0%, #f3e6c4 55%, #ecd9a8 100%);
    box-shadow: 0 10px 34px rgba(0,0,0,.5), inset 0 0 0 2px #fbe6b0;
  }
  .panel.open { display: flex; }

  /* stained-glass gothic header */
  .roof { position: relative; height: 62px; flex: none; color: #fff; overflow: hidden;
    border-bottom: 3px double #8a6710;
    background:
      radial-gradient(circle at 14% 120%, #b8242f 0 18%, transparent 18.5%),
      radial-gradient(circle at 38% 120%, #1d6fb8 0 16%, transparent 16.5%),
      radial-gradient(circle at 62% 120%, #2e8b57 0 16%, transparent 16.5%),
      radial-gradient(circle at 86% 120%, #6b3fa0 0 18%, transparent 18.5%),
      linear-gradient(180deg, #3a1f5c, #241038); }
  .roof h1 { margin: 0; padding: 10px 12px 0; font-size: 21px; letter-spacing: .5px; font-weight: 700;
    background: linear-gradient(#fff3c4, #e7c14e 55%, #b8860b);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    text-shadow: 0 1px 1px rgba(0,0,0,.4); }
  .roof .sub { padding: 0 12px; font-size: 11px; font-style: italic; color: #f0e2b8; }
  .roof .cross { position: absolute; right: 10px; top: 8px; font-size: 26px; color: #ffe9a8; text-shadow: 0 0 8px #ffcf5e; }

  /* controls stay pinned & always visible; only .results scrolls */
  .body { padding: 10px 12px; flex: none; }
  .row { display: flex; align-items: center; gap: 8px; margin: 8px 0; flex-wrap: wrap; }
  .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #7a5a1e; font-weight: 700; }

  button.ornate, select.ornate {
    font-family: inherit; cursor: pointer; color: #4a3208; border: 2px solid #8a6710; border-radius: 5px;
    background: linear-gradient(#fff7d6, #e7c14e 60%, #c8961a); box-shadow: 0 2px 0 #8a6710, inset 0 1px 0 #fff7d6;
    padding: 7px 12px; font-weight: 700;
  }
  button.ornate:active { transform: translateY(1px); box-shadow: 0 1px 0 #8a6710; }
  .reveal { font-size: 15px; }
  select.ornate { padding: 5px 6px; }

  .modes { display: flex; gap: 4px; }
  .mode { flex: 1; text-align: center; padding: 6px 4px; border: 2px solid #8a6710; cursor: pointer;
    background: #f3e6c4; font-weight: 700; font-size: 12px; }
  .mode:first-child { border-radius: 5px 0 0 5px; } .mode:last-child { border-radius: 0 5px 5px 0; }
  .mode + .mode { border-left: none; }
  .mode.on { color: #fff; text-shadow: 0 1px 1px #000; }
  .mode.neutral.on { background: linear-gradient(#7a5a1e,#5a3d0a); }
  .mode.positive.on { background: linear-gradient(#2e8b57,#1c5a37); }
  .mode.negative.on { background: linear-gradient(#b8242f,#7d1019); }

  input[type=range] { flex: 1; accent-color: #8a6710; }
  .val { font-weight: 700; color: #8b0000; min-width: 30px; text-align: right; }

  details.gear { margin-top: 6px; border-top: 1px dashed #c8961a; padding-top: 6px; }
  details.gear summary { cursor: pointer; font-size: 12px; color: #7a5a1e; font-weight: 700; }
  details.gear input[type=text] { width: 100%; padding: 4px 6px; border: 1px solid #b89; border-radius: 4px; font-family: inherit; }
  .orbtn { width: 100%; font-size: 13px; }
  .adv { display: flex; gap: 4px; margin-top: 5px; } .adv input { flex: 1; font-size: 11px; }
  #orSteps { margin-top: 6px; }
  .ostep { display: flex; align-items: center; gap: 6px; font-size: 12px; margin: 3px 0; }
  .ostep .ic { width: 14px; text-align: center; }
  .ostep.run .ic::after { content: "⏳"; } .ostep.ok .ic::after { content: "✓"; color: #2e6b2e; } .ostep.fail .ic::after { content: "✗"; color: #8b0000; }
  .ostep .pc { margin-left: auto; font-size: 11px; color: #8a6710; }
  .bar { height: 8px; background: #e3d3a6; border: 1px solid #8a6710; border-radius: 4px; overflow: hidden; margin: 4px 0; }
  .bar > i { display: block; height: 100%; width: 0; background: linear-gradient(#e7c14e, #c8961a); transition: width .2s; }
  #orActive { font-size: 12px; color: #2e6b2e; margin-top: 6px; } #orActive a { color: #8b0000; }
  .help { font-size: 11px; background: rgba(139,0,0,.05); border: 1px solid #c8961a; border-radius: 5px; padding: 6px; margin-top: 6px; line-height: 1.5; }
  .help a { color: #8b0000; font-weight: 700; }
  .help code { display: block; background: #241038; color: #ffe9a8; padding: 5px 7px; border-radius: 4px; font: 10px/1.4 "Courier New", monospace; margin: 4px 0; white-space: pre-wrap; word-break: break-all; }
  .help .intro { margin-bottom: 5px; }
  .help .ostabs { display: flex; gap: 4px; margin: 4px 0 6px; }
  .help .ostab { cursor: pointer; padding: 2px 8px; border: 1px solid #8a6710; border-radius: 4px; background: #f3e6c4; font-weight: 700; font-size: 11px; }
  .help .ostab.on { background: linear-gradient(#7a5a1e, #5a3d0a); color: #fff; }
  .help .osbody b { color: #7a5a1e; }
  .help .dim { color: #8a7340; font-size: 10px; margin: 2px 0 7px; }
  .help .warn { color: #8b0000; font-weight: 700; margin-top: 4px; }

  .status { font-size: 12px; font-style: italic; color: #6b4f12; min-height: 16px; margin: 6px 0; }
  .status.err { color: #8b0000; font-style: normal; font-weight: 700; }

  .results { border-top: 3px double #c8961a; flex: 1 1 auto; overflow-y: auto; min-height: 0; }

  /* per-chunk result cards (chunk snippet + linked verses + optional LLM analysis) */
  .chunk { padding: 9px 6px; border-bottom: 1px solid #e3d3a6; cursor: pointer; }
  .chunk:hover { background: rgba(200,150,26,.1); }
  .chunk .snip { font-size: 12px; color: #4a3208; }
  .chunk .refs { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .chunk .refs .ref { color: #8b0000; font-weight: 700; font-size: 12px; text-decoration: none; }
  .chunk .refs .ref:hover { text-decoration: underline; }
  .chunk .refs .score { font-size: 10px; color: #5a3d0a; background: #e7c14e; border: 1px solid #8a6710; border-radius: 8px; padding: 0 5px; }
  .analysis { font-size: 12px; margin-top: 5px; padding: 5px 7px; border-left: 3px solid; background: rgba(255,255,255,.55); white-space: pre-wrap; }
  .analysis.neutral { border-color: #7a5a1e; } .analysis.positive { border-color: #2e8b57; color: #1c5a37; }
  .analysis.negative { border-color: #b8242f; color: #7d1019; } .analysis.err { border-color: #8b0000; color: #8b0000; }
  .verse { padding: 9px 4px; border-bottom: 1px solid #e3d3a6; cursor: pointer; }
  .verse:hover { background: rgba(200,150,26,.12); }
  .verse .ref { color: #8b0000; font-weight: 700; font-size: 14px; text-decoration: none; }
  .verse .ref:hover { text-decoration: underline; }
  .verse .score { float: right; font-size: 11px; color: #5a3d0a; background: #e7c14e; border: 1px solid #8a6710; border-radius: 8px; padding: 0 6px; }
  .verse .vt { font-size: 13px; margin: 3px 0; }
  .verse .snip { font-size: 11px; color: #8a7340; font-style: italic; }
  .verse .reason { font-size: 12px; margin-top: 4px; padding: 4px 6px; border-left: 3px solid; background: rgba(255,255,255,.5); }
  .reason.neutral { border-color: #7a5a1e; } .reason.positive { border-color: #2e8b57; color:#1c5a37; }
  .reason.negative { border-color: #b8242f; color:#7d1019; } .reason.err { border-color:#8b0000; color:#8b0000; }
  .empty { padding: 16px 4px; color: #8a7340; font-style: italic; }

  .footer { flex: none; border-top: 3px double #8a6710; background: linear-gradient(#241038,#3a1f5c); color: #f0e2b8;
    font-size: 10px; padding: 5px 0; overflow: hidden; }
  .marquee { white-space: nowrap; animation: slide 16s linear infinite; }
  @keyframes slide { from { transform: translateX(100%); } to { transform: translateX(-100%); } }
  .counter { text-align: center; color: #ffe9a8; padding: 2px; letter-spacing: 1px; }
  .counter b { background: #100; padding: 0 4px; border: 1px solid #ffe9a8; font-family: "Courier New", monospace; }
`;
