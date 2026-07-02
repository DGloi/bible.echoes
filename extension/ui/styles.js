// Shadow-DOM stylesheet for the in-page panel — a medieval "old French / Italian
// Catholic church" illuminated-manuscript theme: parchment ground, rubric-red +
// lapis + gold-leaf palette, a carved-stone tympanum with a rose-window motif, and
// the bundled MedievalSharp display font (OFL; @font-face injected in panel.js) on the
// "chrome." Body/verse text stays in a readable serif. Lives in the shadow root so the
// host page's CSS can't touch it. (Highlight tints for matched page text are separate,
// in content.css, because ::highlight() is document-scoped.)

export const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: "Palatino Linotype","Book Antiqua",Palatino,Georgia,"Times New Roman",serif; }

  /* ---- gilded wax-seal medallion (floating button) ---- */
  .fab {
    width: 58px; height: 58px; border-radius: 50%; cursor: grab; border: 3px solid #5a3d0a;
    background: radial-gradient(circle at 34% 30%, #f6e6b0 0%, #d8b45a 34%, #b58a2e 66%, #7a5a1e 100%);
    box-shadow: 0 4px 15px rgba(0,0,0,.5), inset 0 0 7px rgba(255,255,255,.55), inset 0 0 0 5px rgba(90,61,10,.35);
    color: #4a3208; font-family: 'MedievalSharp', serif; font-size: 30px; line-height: 52px; text-align: center;
    user-select: none; text-shadow: 0 1px 0 #f6e6b0; touch-action: none;
  }
  .fab:hover { filter: brightness(1.07); }
  .fab.busy { cursor: progress; animation: spin 1.4s linear infinite; }
  .badge { position: absolute; top: -4px; right: -4px; min-width: 20px; height: 20px; border-radius: 10px;
    background: #7b1113; color: #f6e6b0; font: 700 11px/20px 'MedievalSharp', serif; text-align: center; padding: 0 5px;
    border: 1px solid #f6e6b0; display: none; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ---- the codex panel ---- */
  .panel {
    position: fixed; width: 384px; max-height: 80vh; display: none; flex-direction: column; overflow: hidden;
    color: #2e2216; border: 3px solid #7a5a1e; border-radius: 6px; font-size: 13px;
    background:
      radial-gradient(120% 60% at 50% 0%, rgba(181,138,46,.10), transparent 60%),
      radial-gradient(90% 50% at 100% 100%, rgba(123,17,19,.06), transparent 60%),
      repeating-linear-gradient(0deg, rgba(120,90,30,.04) 0 3px, transparent 3px 6px),
      linear-gradient(160deg, #efe4c8 0%, #e6d5ad 60%, #dcc79a 100%);
    box-shadow: 0 12px 36px rgba(0,0,0,.55), inset 0 0 0 2px #cdb06a, inset 0 0 22px rgba(120,80,20,.18);
  }
  .panel.open { display: flex; }

  /* ---- carved-stone tympanum with a rose-window motif ---- */
  .roof { position: relative; flex: none; height: 76px; overflow: hidden; color: #f6e6b0;
    border-bottom: 4px double #b58a2e;
    background:
      radial-gradient(circle at 50% 44px, rgba(214,180,90,.30) 0 20px, transparent 21px),
      radial-gradient(circle at 50% 44px, rgba(35,54,110,.55) 0 12px, transparent 13px),
      repeating-conic-gradient(from 0deg at 50% 44px, rgba(214,180,90,.28) 0 12deg, transparent 12deg 24deg),
      linear-gradient(180deg, #3a2a16, #241a10); }
  .roof::before, .roof::after { position: absolute; top: 22px; font-size: 20px; opacity: .55; }
  .roof::before { content: "⛪"; left: 12px; } .roof::after { content: "✝"; right: 12px; }
  .roof h1 { margin: 0; padding: 13px 42px 0; text-align: center; font-family: 'MedievalSharp', serif; font-size: 22px;
    letter-spacing: .5px; color: #f2d98b; text-shadow: 0 1px 0 #7b1113, 0 0 10px rgba(214,180,90,.5); }
  .roof .sub { text-align: center; font-size: 10px; font-style: italic; color: #d8c79a; padding: 0 12px; }
  .roof .cross { display: none; } /* superseded by the rose-window + corner glyphs */

  .body { padding: 10px 12px; flex: none; }
  .row { display: flex; align-items: center; gap: 8px; margin: 8px 0; flex-wrap: wrap; }
  .lbl { font-family: 'MedievalSharp', serif; font-size: 11px; letter-spacing: .04em; color: #7b1113; font-weight: 700; text-transform: uppercase; }

  button.ornate, select.ornate {
    font-family: 'MedievalSharp', serif; cursor: pointer; color: #3b2a10; border: 2px solid #7a5a1e; border-radius: 4px;
    background: linear-gradient(#f6e6b0, #d8b45a 62%, #b58a2e); box-shadow: 0 2px 0 #6b4f12, inset 0 1px 0 #fbefc4; padding: 7px 12px; font-weight: 700;
  }
  button.ornate:active { transform: translateY(1px); box-shadow: 0 1px 0 #6b4f12; }
  .reveal { font-size: 15px; }
  select.ornate { padding: 5px 6px; }

  .modes { display: flex; gap: 0; }
  .mode { flex: 1; text-align: center; padding: 6px 4px; border: 2px solid #7a5a1e; cursor: pointer;
    background: #e8d6a8; font-family: 'MedievalSharp', serif; font-weight: 700; font-size: 12px; color: #4a3208; }
  .mode:first-child { border-radius: 4px 0 0 4px; } .mode:last-child { border-radius: 0 4px 4px 0; } .mode + .mode { border-left: none; }
  .mode.on { color: #f6e6b0; text-shadow: 0 1px 1px #000; }
  .mode.neutral.on { background: linear-gradient(#7a5a1e,#4a3208); }
  .mode.positive.on { background: linear-gradient(#2e6b3f,#1c4a2a); }
  .mode.negative.on { background: linear-gradient(#7b1113,#4a0a0b); }

  input[type=range] { flex: 1; accent-color: #7a5a1e; }
  .val { font-family: 'MedievalSharp', serif; font-weight: 700; color: #7b1113; min-width: 30px; text-align: right; }

  details.gear { margin-top: 6px; border-top: 1px dashed #b58a2e; padding-top: 6px; }
  details.gear summary { cursor: pointer; font-family: 'MedievalSharp', serif; font-size: 12px; color: #7b1113; font-weight: 700; }
  details.gear input[type=text], details.gear input[type=password] { width: 100%; padding: 4px 6px; border: 1px solid #a98b5a; border-radius: 4px; font-family: inherit; background: #f7efd6; }
  #provOpenai { margin-top: 4px; }
  .dim { color: #7a5a1e; font-size: 10px; margin: 3px 0; }
  .warn { color: #7b1113; font-weight: 700; font-size: 11px; margin: 4px 0; }
  .orbtn { width: 100%; font-size: 13px; }
  .adv { display: flex; gap: 4px; margin-top: 5px; } .adv input { flex: 1; font-size: 11px; }
  #orSteps { margin-top: 6px; }
  .ostep { display: flex; align-items: center; gap: 6px; font-size: 12px; margin: 3px 0; }
  .ostep .ic { width: 14px; text-align: center; }
  .ostep.run .ic::after { content: "⏳"; } .ostep.ok .ic::after { content: "✓"; color: #2e6b3f; } .ostep.fail .ic::after { content: "✗"; color: #7b1113; }
  .ostep .pc { margin-left: auto; font-size: 11px; color: #7a5a1e; }
  .bar { height: 8px; background: #d8c79a; border: 1px solid #7a5a1e; border-radius: 4px; overflow: hidden; margin: 4px 0; }
  .bar > i { display: block; height: 100%; width: 0; background: linear-gradient(#d8b45a, #b58a2e); transition: width .2s; }
  #orActive { font-size: 12px; color: #2e6b3f; margin-top: 6px; } #orActive a { color: #7b1113; }

  .help { font-size: 11px; background: rgba(123,17,19,.05); border: 1px solid #b58a2e; border-radius: 5px; padding: 6px; margin-top: 6px; line-height: 1.5; }
  .help a { color: #7b1113; font-weight: 700; }
  .help code { display: block; background: #241a10; color: #f2d98b; padding: 5px 7px; border-radius: 4px; font: 10px/1.4 "Courier New", monospace; margin: 4px 0; white-space: pre-wrap; word-break: break-all; }
  .help .intro { margin-bottom: 5px; }
  .help .ostabs { display: flex; gap: 4px; margin: 4px 0 6px; }
  .help .ostab { cursor: pointer; padding: 2px 8px; border: 1px solid #7a5a1e; border-radius: 4px; background: #e8d6a8; font-family: 'MedievalSharp', serif; font-weight: 700; font-size: 11px; }
  .help .ostab.on { background: linear-gradient(#7a5a1e,#4a3208); color: #f6e6b0; }
  .help .osbody b { color: #7b1113; }
  .help .dim { color: #7a5a1e; font-size: 10px; margin: 2px 0 7px; }
  .help .warn { color: #7b1113; font-weight: 700; margin-top: 4px; }

  .status { font-size: 12px; font-style: italic; color: #6b4f12; min-height: 16px; margin: 6px 0; }
  .status.err { color: #7b1113; font-style: normal; font-weight: 700; }

  /* ---- results: illuminated verse cards (scrolls independently; controls stay pinned) ---- */
  .results { border-top: 4px double #b58a2e; flex: 1 1 auto; overflow-y: auto; min-height: 0; }
  .chunk { padding: 9px 8px; border-bottom: 1px solid #cdb06a; cursor: pointer; }
  .chunk:hover { background: rgba(181,138,46,.12); }
  .chunk .snip { font-size: 12px; color: #5a4626; font-style: italic; }
  .chunk .verses { margin-top: 5px; }
  .chunk .vitem { margin: 5px 0; padding-left: 8px; border-left: 3px solid #b58a2e; }
  .chunk .vitem .ref { font-family: 'MedievalSharp', serif; color: #7b1113; font-weight: 700; font-size: 13px; text-decoration: none; }
  .chunk .vitem .ref:hover { text-decoration: underline; }
  .chunk .vitem .score { margin-left: 6px; font-size: 10px; color: #4a3208; background: #d8b45a; border: 1px solid #7a5a1e; border-radius: 8px; padding: 0 5px; }
  .chunk .vtext { font-size: 12.5px; color: #2e2216; margin-top: 2px; line-height: 1.45; }
  .analysis { font-size: 12px; margin-top: 6px; padding: 5px 8px; border-left: 3px solid; background: rgba(255,250,235,.6); white-space: pre-wrap; }
  .analysis.neutral { border-color: #7a5a1e; } .analysis.positive { border-color: #2e6b3f; color: #1c4a2a; }
  .analysis.negative { border-color: #7b1113; color: #5a0a0b; } .analysis.err { border-color: #7b1113; color: #7b1113; }
  .empty { padding: 16px 8px; color: #7a5a1e; font-style: italic; text-align: center; }

  /* ---- footer: illuminated colophon ---- */
  .footer { flex: none; border-top: 4px double #b58a2e; background: linear-gradient(#241a10,#3a2a16); color: #d8c79a; font-size: 10px; padding: 5px 0; overflow: hidden; }
  .marquee { white-space: nowrap; animation: slide 18s linear infinite; font-family: 'MedievalSharp', serif; }
  @keyframes slide { from { transform: translateX(100%); } to { transform: translateX(-100%); } }
  .counter { text-align: center; color: #f2d98b; padding: 2px; letter-spacing: 1px; font-family: 'MedievalSharp', serif; }
  .counter b { background: #140d06; padding: 0 4px; border: 1px solid #b58a2e; font-family: "Courier New", monospace; color: #f2d98b; }
  .donate-row { text-align: center; padding: 3px 2px 1px; }
  .donate { color: #f2d98b; text-decoration: none; font-family: 'MedievalSharp', serif; font-size: 11px; }
  .donate:hover { color: #fff6cf; text-decoration: underline; }
  .support { flex: none; display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 12px; color: #5a4626; background: rgba(181,138,46,.16); border-top: 1px solid #cdb06a; }
  .support .coffee { color: #7b1113; font-weight: 700; text-decoration: none; font-family: 'MedievalSharp', serif; }
  .support .coffee:hover { text-decoration: underline; }
  .support .sx { margin-left: auto; border: none; background: none; cursor: pointer; color: #8a7340; font-size: 14px; line-height: 1; }
`;
