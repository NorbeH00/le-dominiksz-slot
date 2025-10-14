// slot.js — Le Dominiksz Slot (Pixi v8)
// Rétegek: BG -> Reels(mask 6×5) -> Frame -> Dominiksz
// Képek: assets/le_bg.png, assets/slot_frame.png, assets/dominiksz_static.png

// ===== Helpers / HUD =====
const q = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ASSETS = "./assets/";

// ===== Finomhangolási konstansok =====
// Keret kicsinyítés (1.0 = eredeti)
const FRAME_SCALE = 0.92;

// A keret középvonalát CSS px-ben ennyivel toljuk fel/le (negatív = FELJEBB)
const FRAME_Y_OFFSET_CSS = -30;

// HUD finom fel/le tolása (CSS px; +érték = feljebb kerül a HUD)
const HUD_Y_OFFSET_CSS = +36;

// HUD szélesség kis túllógása a kerethez képest (CSS px oldalanként)
const HUD_OVERHANG_PX = 24;

// Dominiksz méret/pozíció
const DOM_TARGET_H_RATIO = 0.60;      // a vászon 50%-a legyen a célmagasság
const DOM_Y_OFFSET_CSS   = 180;       // keret középvonalához képest ennyivel LEJJEBB (CSS px)
const DOM_RIGHT_OFFSET_CM = -2.7;        // ~5 cm-rel jobbra a keret jobb szélétől
const CSS_PX_PER_CM = 37.7952755906;
const DOM_RIGHT_OFFSET_PX = DOM_RIGHT_OFFSET_CM * CSS_PX_PER_CM;

// ===== HUD adatok / bet-létra =====
let app;
let balance = 5000.0;

const BET_STEPS = [
  0.1,0.2,0.4,0.6,0.8,1,1.2,1.4,1.6,1.8,2,
  3,4,5,6,7,8,9,10,
  15,20,25,30,35,40,45,50,
  75,100,150,200
];
let betIndex = BET_STEPS.indexOf(2) >= 0 ? BET_STEPS.indexOf(2) : 10;
let bet = BET_STEPS[betIndex];

const fmt = (n) => (Math.round(n*100)/100).toFixed(2);
function updateHUD(){
  const bv = q('betValue'); if (bv) bv.textContent = `€${fmt(bet)}`;
  const bal = q('balanceValue'); if (bal) bal.textContent = `€${fmt(balance)}`;
}
function incBet(){ betIndex = clamp(betIndex+1, 0, BET_STEPS.length-1); bet = BET_STEPS[betIndex]; updateHUD(); }
function decBet(){ betIndex = clamp(betIndex-1, 0, BET_STEPS.length-1); bet = BET_STEPS[betIndex]; updateHUD(); }
q('betUp')?.addEventListener('click', incBet);
q('betDown')?.addEventListener('click', decBet);

// ===== Autoplay (overlay vezérlés, ha kell) =====
const AUTO_ROUNDS = [10,25,50,75,100,500,1000];
let autoSelected = AUTO_ROUNDS[0];
(function wireAutoplayUI(){
  const row = q('pillRow');
  if (row){
    row.innerHTML = '';
    AUTO_ROUNDS.forEach(n=>{
      const b = document.createElement('button');
      b.className = 'pill' + (n===autoSelected?' active':'');
      b.textContent = n;
      b.addEventListener('click', ()=>{
        autoSelected = n;
        [...row.children].forEach(c=>c.classList.remove('active'));
        b.classList.add('active');
      });
      row.appendChild(b);
    });
  }
  const overlay = q('autoOverlay');
  const open = ()=> overlay?.classList.add('active');
  const close = ()=> overlay?.classList.remove('active');
  q('btnAuto')?.addEventListener('click', open);
  q('autoClose')?.addEventListener('click', close);
  q('autoCancel')?.addEventListener('click', close);
  q('autoStart')?.addEventListener('click', async ()=>{ close(); await autoSpin(autoSelected); });
})();

// ===== Grid / Pixi =====
const COLS = 6;
const ROWS = 5;
const SYMBOL_SIZE = 110;
const GAP = 10;

const GRID_W = COLS*SYMBOL_SIZE + (COLS-1)*GAP;
const GRID_H = ROWS*SYMBOL_SIZE + (ROWS-1)*GAP;

let reels = [];     // [{ colContainer, symbols:[Graphics] }]
let reelsHost;      // Container
let reelsMask;      // Graphics
let bgSprite;       // háttér
let frameSprite;    // keret
let domSprite;      // dominiksz

const COLORS = [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93, 0xffffff];
const randCol = () => COLORS[Math.floor(Math.random()*COLORS.length)];

const manifest = {
  bg:    `${ASSETS}le_bg.png`,
  frame: `${ASSETS}slot_frame.png`,
  dom:   `${ASSETS}dominiksz_static.png`,
};

async function initPixi(){
  try{
    app = new PIXI.Application();
    await app.init({
      width: 1920,
      height: 1080,
      backgroundAlpha: 0,
      antialias: true
    });

    (q('reelsCanvasHost') || document.body).appendChild(app.canvas);

    PIXI.Assets.addBundle('slot', manifest);
    const textures = await PIXI.Assets.loadBundle('slot');

    // 1) Háttér — TELI 1920×1080
    bgSprite = new PIXI.Sprite(textures.bg);
    bgSprite.anchor.set(0.5);
    bgSprite.position.set(1920/2, 1080/2);
    bgSprite.width  = 1920;
    bgSprite.height = 1080;
    bgSprite.zIndex = 0;
    app.stage.addChild(bgSprite);

    // 2) Reels + maszk
    reelsHost = new PIXI.Container();
    reelsMask = new PIXI.Graphics()
      .beginFill(0xffffff)
      .drawRoundedRect(0,0, GRID_W, GRID_H, 8)
      .endFill();
    reelsHost.mask = reelsMask;
    app.stage.addChild(reelsHost);
    app.stage.addChild(reelsMask);

    for (let c=0;c<COLS;c++){
      const col = new PIXI.Container();
      col.x = c*(SYMBOL_SIZE+GAP);
      col.y = 0;
      const symbols = [];
      for (let r=-1; r<ROWS+1; r++){
        const g = new PIXI.Graphics();
        g.beginFill(randCol()).drawRoundedRect(0,0,SYMBOL_SIZE,SYMBOL_SIZE,16).endFill();
        g.y = r*(SYMBOL_SIZE+GAP);
        col.addChild(g);
        symbols.push(g);
      }
      reelsHost.addChild(col);
      reels.push({ colContainer: col, symbols });
    }

    // 3) Keret — középen + skála
    frameSprite = new PIXI.Sprite(textures.frame);
    frameSprite.anchor.set(0.5);
    frameSprite.position.set(1920/2, 1080/2);
    frameSprite.scale.set(FRAME_SCALE);
    frameSprite.zIndex = 10;
    app.stage.addChild(frameSprite);

    // 4) Dominiksz — layout állítja a helyét és a skáláját
    domSprite = new PIXI.Sprite(textures.dom);
    domSprite.anchor.set(0, 0.5);
    domSprite.zIndex = 20;
    app.stage.addChild(domSprite);

    app.stage.sortableChildren = true;

    centerGrid();
    layout();
    window.addEventListener('resize', layout);

  }catch(e){
    console.error('PIXI init hiba:', e);
  }
}

// Rács maszkja a keret belső közepéhez igazodik
function centerGrid(){
  const targetX = Math.round(frameSprite.x - GRID_W / 2);
  const targetY = Math.round(frameSprite.y - GRID_H / 2);
  reelsHost.x = targetX;
  reelsHost.y = targetY;
  reelsMask.x = targetX;
  reelsMask.y = targetY;
}

// Elrendezés: keret offset, Dominiksz méret/pozíció, HUD szélesség és finom bottom
function layout(){
  if (!app || !frameSprite) return;

  const canvas = app.canvas;
  const hudEl  = document.getElementById('hudBar');

  const cssH = canvas.clientHeight || 1080;
  const scale = cssH / 1080;

  // KERET: középre + függőleges offset (CSS->world)
  const frameYOffsetWorld = FRAME_Y_OFFSET_CSS / scale;
  frameSprite.x = 1920/2;
  frameSprite.y = 1080/2 + frameYOffsetWorld;

  // DOMINIKSZ: célmagasságra skálázás + pozíció (jobbra 5cm, lejjebb DOM_Y_OFFSET_CSS)
  if (domSprite?.texture?.height){
    const targetH = 1080 * DOM_TARGET_H_RATIO;
    const s = targetH / domSprite.texture.height;
    domSprite.scale.set(s);
  }
  const worldOffsetX = DOM_RIGHT_OFFSET_PX / scale;
  const worldOffsetY = DOM_Y_OFFSET_CSS / scale;
  domSprite.x = frameSprite.x + frameSprite.width/2 + worldOffsetX;
  domSprite.y = frameSprite.y + worldOffsetY;

  // HUD: fix alul, de finom offsettel mozgatható, szélessége a kerethez igazítva
  if (hudEl){
    hudEl.style.bottom = `${Math.max(0, HUD_Y_OFFSET_CSS)}px`;
    const frameCssW = frameSprite.width * scale;
    const hudCssW = Math.round(frameCssW + 2 * HUD_OVERHANG_PX);
    hudEl.style.width = `${hudCssW}px`;
    hudEl.style.left = '50%';
    hudEl.style.transform = 'translateX(-50%)';
  }

  // rács illesztése a kerethez
  centerGrid();
}

// ===== Spin (alap animáció – placeholder) =====
function refillColumn(col){
  for (const g of col.symbols){
    g.clear().beginFill(randCol()).drawRoundedRect(0,0,SYMBOL_SIZE,SYMBOL_SIZE,16).endFill();
  }
}
function animateColumn(col, duration=600, distance = SYMBOL_SIZE+GAP){
  return new Promise((resolve)=>{
    const start = performance.now();
    const startY = col.colContainer.y;
    function tick(now){
      const t = Math.min(1, (now-start)/duration);
      const ease = 1 - Math.pow(1-t,3);
      col.colContainer.y = startY + ease*distance;
      if (t<1){ requestAnimationFrame(tick); }
      else{
        col.colContainer.y = startY;
        const last = col.symbols.pop();
        last.y = -1*(SYMBOL_SIZE+GAP);
        col.colContainer.addChildAt(last,0);
        col.symbols.unshift(last);
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}

let spinning = false;
async function spin(){
  if (spinning) return;
  spinning = true;

  document.dispatchEvent(new CustomEvent('slot:spin', { detail:{ bet } }));
  updateHUD();

  for (const col of reels) refillColumn(col);
  for (let c=0;c<reels.length;c++){
    await animateColumn(reels[c], 500 + c*90);
  }
  spinning = false;
}

q('btnSpin')?.addEventListener('click', ()=>{ spin(); });

// Autospin
async function autoSpin(rounds){
  for (let i=0;i<rounds;i++){
    await spin();
    await new Promise(res=>setTimeout(res,700));
  }
}

// Start
(async function main(){
  updateHUD();
  await initPixi();
})();
