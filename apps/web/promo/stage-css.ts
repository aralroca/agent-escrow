/** Styles of the recording stage: a 1920×1080 dark set with one layer per scene. */
export const STAGE_CSS = `
  * { box-sizing: border-box; margin: 0; }
  body { width: 1920px; height: 1080px; overflow: hidden; color: #fff; font-family: Geist, system-ui, sans-serif;
    background: radial-gradient(900px 520px at 78% -8%, rgba(25,118,210,.34), transparent 70%), #141414; }
  body::before { content: ""; position: absolute; inset: 0; opacity: .5;
    background-image: radial-gradient(rgba(255,255,255,.09) 1.2px, transparent 1.4px); background-size: 26px 26px; }
  .mono { font-family: "Geist Mono", monospace; }
  img.logo { height: 1em; vertical-align: -0.14em; }

  header { position: absolute; left: 72px; right: 72px; top: 40px; display: flex; justify-content: space-between; align-items: center; }
  .brand { display: flex; align-items: center; gap: 16px; font-size: 30px; font-weight: 600; letter-spacing: -.02em; }
  .mark { width: 52px; height: 52px; border-radius: 16px; background: #fff; color: #141414; display: grid; place-items: center; }
  .net { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-radius: 999px; background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.14); font-size: 21px; font-weight: 500; }
  .net i { width: 10px; height: 10px; border-radius: 5px; background: #4ade80; animation: blink 1.6s infinite; }
  @keyframes blink { 50% { opacity: .35; } }

  #headline { position: absolute; left: 0; right: 0; top: 128px; text-align: center; font-size: 54px; font-weight: 600; letter-spacing: -.035em;
    transition: opacity .28s, transform .28s; }
  #headline.out { opacity: 0; transform: translateY(14px); }

  .layer { position: absolute; inset: 0; opacity: 0; pointer-events: none; transform: scale(.985); transition: opacity .5s, transform .5s; }
  .layer.on { opacity: 1; transform: none; pointer-events: auto; }

  /* Intro and outro cover the header. */
  .cover { z-index: 5; display: grid; place-items: center; text-align: center;
    background: radial-gradient(1000px 600px at 50% 110%, rgba(25,118,210,.38), transparent 70%), #141414; }
  .beat { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; transition: opacity .45s; }
  .beat.on { opacity: 1; }
  .beat h1 { font-size: 118px; line-height: 1.02; letter-spacing: -.05em; font-weight: 600; }
  .beat p { margin-top: 30px; font-size: 44px; color: #c3c7d0; }
  .strike { position: relative; display: inline-block; }
  .strike::after { content: ""; position: absolute; left: -1%; right: 101%; bottom: -.04em; height: .09em; border-radius: .05em; background: #e5484d; transition: right .6s .9s; }
  .beat.on .strike::after { right: -1%; }
  .rise { opacity: 0; transform: translateY(26px); transition: opacity .6s, transform .6s cubic-bezier(.2,.7,.2,1); }
  .beat.on .rise { opacity: 1; transform: none; }
  .d1 { transition-delay: .35s; } .d2 { transition-delay: .9s; } .d3 { transition-delay: 1.5s; } .d4 { transition-delay: 2.1s; }
  .options { display: flex; gap: 28px; }
  .option { width: 500px; padding: 40px; border-radius: 32px; background: #1f1f1f; border: 1px solid #333; text-align: left; }
  .option b { display: block; font-size: 46px; letter-spacing: -.03em; margin: 18px 0 12px; }
  .option span { font-size: 26px; line-height: 1.4; color: #c3c7d0; }
  .tag { display: inline-block; padding: 8px 18px; border-radius: 999px; font-size: 22px; font-weight: 600; background: #472320; color: #ff9c94; }
  .option.ours { background: #1976d2; border-color: #1976d2; }
  .option.ours .tag { background: #fff; color: #0d47a1; }
  .option.ours span { color: #e3f2fd; }
  .bigmark { width: 128px; height: 128px; border-radius: 38px; margin: 0 auto 36px; }
  mark { background: #1976d2; color: #fff; padding: 0 .16em .04em; border-radius: .16em; display: inline-block; transform: rotate(-1.5deg); }
  .rails { margin-top: 56px; display: flex; gap: 20px; justify-content: center; font-size: 30px; font-weight: 500; }
  .rail { display: flex; align-items: center; gap: 14px; padding: 16px 28px; border-radius: 999px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.16); }
  .rail img { height: 34px; }
  .cmd { display: inline-block; font-size: 52px; padding: 30px 48px; border-radius: 28px; background: #1f1f1f; border: 1px solid #3a3a3a; }

  /* Sequence diagram. */
  .lane { position: absolute; top: 236px; width: 470px; margin-left: -235px; padding: 20px 24px; white-space: nowrap; border-radius: 26px; background: #1f1f1f; border: 1px solid #353535; z-index: 2;
    display: flex; align-items: center; gap: 18px; }
  .lane .avatar { width: 68px; height: 68px; border-radius: 20px; display: grid; place-items: center; background: #2d2d2d; flex: none; }
  .lane .avatar img { height: 36px; }
  .lane b { display: block; font-size: 27px; font-weight: 600; }
  .lane small { display: block; font-size: 18px; color: #9aa0ab; text-transform: uppercase; letter-spacing: .08em; }
  .lane .amount { margin-left: auto; text-align: right; font: 600 34px Geist, sans-serif; letter-spacing: -.02em; transition: color .3s; white-space: nowrap; }
  .lane .amount img { height: 26px; margin-right: 8px; vertical-align: -3px; }
  .lane .amount.up { color: #86efac; } .lane .amount.down { color: #fca5a5; }
  .lane.program { background: #1976d2; border-color: #1976d2; }
  .lane.program small { color: #e3f2fd; } .lane.program .avatar { background: rgba(255,255,255,.16); }
  .life { position: absolute; top: 330px; bottom: 96px; width: 0; border-left: 2px dashed #3a3a3a; }
  .row { position: absolute; height: 92px; opacity: 0; animation: appear .4s ease forwards; }
  @keyframes appear { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  .label { position: absolute; left: 0; right: 0; top: 0; text-align: center; font: 500 28px "Geist Mono", monospace; white-space: nowrap; }
  .note { position: absolute; left: 0; right: 0; top: 64px; text-align: center; font: 19px "Geist Mono", monospace; color: #8a909c; }
  .line { position: absolute; left: 6px; right: 6px; top: 50px; height: 4px; border-radius: 2px; background: currentColor; transform: scaleX(0); animation: draw .6s .15s cubic-bezier(.3,.7,.2,1) forwards; }
  .right .line { transform-origin: left; } .left .line { transform-origin: right; }
  .line::after { content: ""; position: absolute; top: -8px; border: 10px solid transparent; }
  .right .line::after { right: -5px; border-left-color: currentColor; border-right-width: 0; }
  .left .line::after { left: -5px; border-right-color: currentColor; border-left-width: 0; }
  @keyframes draw { to { transform: scaleX(1); } }
  .call { color: #90caf9; } .money { color: #86efac; } .bad { color: #fca5a5; }
  .coin { position: absolute; top: 28px; width: 48px; height: 48px; margin-left: -24px; opacity: 0; filter: drop-shadow(0 6px 14px rgba(39,117,202,.6)); }
  .right .coin { animation: toRight 1s .2s cubic-bezier(.4,.1,.3,1) forwards; } .left .coin { animation: toLeft 1s .2s cubic-bezier(.4,.1,.3,1) forwards; }
  @keyframes toRight { 0% { left: 0; opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { left: 100%; opacity: 0; } }
  @keyframes toLeft { 0% { left: 100%; opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { left: 0; opacity: 0; } }
  .self { display: flex; align-items: center; gap: 14px; height: 64px; font: 500 28px "Geist Mono", monospace; white-space: nowrap; }
  .chip { padding: 9px 18px; border-radius: 999px; font-size: 23px; background: #173524; color: #86efac; opacity: 0; animation: appear .35s ease forwards; }
  .chip.bad { background: #472320; color: #fca5a5; }
  #proof { position: absolute; left: 0; right: 0; bottom: 36px; text-align: center; font-size: 22px; color: #8a909c; }

  /* The site, inside a browser window. */
  .window { position: absolute; left: 110px; top: 226px; width: 1700px; height: 820px; border-radius: 22px; overflow: hidden; background: #fff;
    box-shadow: 0 40px 90px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.12); }
  .chrome { height: 52px; display: flex; align-items: center; gap: 9px; padding: 0 20px; background: #ececef; }
  .chrome i { width: 13px; height: 13px; border-radius: 7px; background: #ff5f57; } .chrome i + i { background: #febc2e; } .chrome i + i + i { background: #28c840; }
  .chrome span { margin-left: 18px; flex: 1; max-width: 900px; padding: 7px 16px; border-radius: 9px; background: #fff; color: #4a505c; font: 17px "Geist Mono", monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .window iframe { display: block; width: 1700px; height: 768px; border: 0; }

  /* Install card. */
  .install { position: absolute; left: 50%; top: 250px; width: 1180px; margin-left: -590px; padding: 40px 48px; border-radius: 28px; background: #1f1f1f; border: 1px solid #3a3a3a;
    font: 30px/1.6 "Geist Mono", monospace; white-space: pre; }
  .install div { opacity: 0; transform: translateX(-10px); transition: opacity .3s, transform .3s; }
  .install div.on { opacity: 1; transform: none; }
  .k { color: #90caf9; } .s { color: #86efac; }
`;
