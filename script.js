/* ============================================
   MathPlay - script.js  (Step 4: 自由玩 + 3 关挑战)
   核心:状态(state)→ 事件(event)→ 渲染(render)
   ============================================ */

// ====== 1. 状态 ======
// currentMinutes:连续累加,不 wrap(避免 CSS transition 360° 倒车 bug)
let currentMinutes = 0;

// 挑战模式相关状态
let mode         = 'sandbox';   // 'sandbox'(自由玩) | 'challenge'(挑战)
let levelIndex   = 0;            // 0,1,2 → 关 1,2,3
let targetMinutes= 0;            // 当前关卡的目标分钟数(0-719)
let errorCount   = 0;            // 当前关卡的错误次数(3 次后自动演示)
let isLocked     = false;        // 锁:动画/演示期间禁止拖动 + 提交

const TOTAL_LEVELS = 3;
const TOLERANCE_DEG = 3;         // ±3° 容差(≈ ±30 秒)


// ====== 2. 抓取 HTML 元素 ======
const body          = document.body;
const clock         = document.querySelector('.clock');
const handHour      = document.querySelector('.hand-hour');
const handMinute    = document.querySelector('.hand-minute');
const timeLabel     = document.getElementById('time-label');
const btnReset      = document.getElementById('btn-reset');
const btnStart      = document.getElementById('btn-start-challenge');
const btnBack       = document.getElementById('btn-back-sandbox');
const btnSubmit     = document.getElementById('btn-submit');
const bannerProg    = document.getElementById('banner-progress');
const bannerTarget  = document.getElementById('banner-target-time');
const challengeHint = document.getElementById('challenge-hint');
const overlay       = document.getElementById('overlay');
const overlayText   = document.getElementById('overlay-text');
const overlayActions= document.getElementById('overlay-actions');
const confettiBox   = document.getElementById('confetti-container');


// ====== 3. 渲染函数 ======
function render() {
  const minuteAngle = currentMinutes * 6;
  const hourAngle   = currentMinutes * 0.5;

  handMinute.style.transform = `translateX(-50%) rotate(${minuteAngle}deg)`;
  handHour.style.transform   = `translateX(-50%) rotate(${hourAngle}deg)`;

  // 自由玩模式才显示文字时间
  if (mode === 'sandbox') {
    timeLabel.textContent = formatTime(currentMinutes);
  }
}

// 把 currentMinutes(无界)格式化成 "H:MM" 字符串
function formatTime(mins) {
  const wrapped     = ((mins % 720) + 720) % 720;
  const minute      = wrapped % 60;
  const hour        = Math.floor(wrapped / 60);   // 0-11
  const displayHour = hour === 0 ? 12 : hour;
  const displayMin  = String(minute).padStart(2, '0');
  return `${displayHour}:${displayMin}`;
}


// ====== 4. 算触摸点对应的"分钟数" ======
function pointToMinute(x, y) {
  const rect    = clock.getBoundingClientRect();
  const centerX = rect.left + rect.width  / 2;
  const centerY = rect.top  + rect.height / 2;
  const dx = x - centerX;
  const dy = y - centerY;
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  angle = (angle + 90 + 360) % 360;
  return Math.round(angle / 6) % 60;
}


// ====== 5. 拖动更新(走最短路径,跨 12 点正确进/退一小时) ======
function updateFromTouch(x, y) {
  const newMinute = pointToMinute(x, y);
  const oldMinute = ((currentMinutes % 60) + 60) % 60;
  let delta = newMinute - oldMinute;
  if (delta >  30) delta -= 60;
  if (delta < -30) delta += 60;
  currentMinutes += delta;
  render();
}


// ====== 6. 拖动事件(分针专用) ======
let isDragging = false;

handMinute.addEventListener('pointerdown', (e) => {
  if (isLocked) return;            // 演示/庆祝期间不响应
  isDragging = true;
  handMinute.setPointerCapture(e.pointerId);
  updateFromTouch(e.clientX, e.clientY);
  // 用户开始拖动 → 清掉之前的提示文字
  if (mode === 'challenge') challengeHint.textContent = '\u00A0';
  e.preventDefault();
});

handMinute.addEventListener('pointermove', (e) => {
  if (!isDragging || isLocked) return;
  updateFromTouch(e.clientX, e.clientY);
});

handMinute.addEventListener('pointerup',     () => { isDragging = false; });
handMinute.addEventListener('pointercancel', () => { isDragging = false; });


// ====== 7. 自由玩:换个时间 ======
function setRandomTime() {
  const currentWrapped = ((currentMinutes % 720) + 720) % 720;
  const target = Math.floor(Math.random() * 720);
  let delta = target - currentWrapped;
  if (delta >  360) delta -= 720;
  if (delta < -360) delta += 720;
  currentMinutes += delta;
  render();
}

btnReset.addEventListener('click', setRandomTime);


// ====== 8. 模式切换 ======
function setMode(newMode) {
  mode = newMode;
  body.classList.remove('mode-sandbox', 'mode-challenge');
  body.classList.add('mode-' + newMode);
}


// ====== 9. 挑战:开始 / 关卡生成 ======
btnStart.addEventListener('click', () => {
  setMode('challenge');
  levelIndex = 0;
  startLevel(levelIndex);
});

btnBack.addEventListener('click', () => {
  hideOverlay();
  unlock();
  setMode('sandbox');
  setRandomTime();
});

// 难度梯度:关 1 整点,关 2 半点,关 3 一刻钟/三刻钟
function generateTarget(idx) {
  const hour = Math.floor(Math.random() * 12);   // 0-11
  let minute;
  if      (idx === 0) minute = 0;
  else if (idx === 1) minute = 30;
  else                minute = (Math.random() < 0.5) ? 15 : 45;
  return hour * 60 + minute;
}

function startLevel(idx) {
  errorCount = 0;
  targetMinutes = generateTarget(idx);
  challengeHint.textContent = '\u00A0';

  // 横幅:关卡进度 + 目标时间
  bannerProg.textContent   = `第 ${idx + 1} 关 / 共 ${TOTAL_LEVELS} 关`;
  bannerTarget.textContent = formatTime(targetMinutes);

  // 给一个不同于目标的随机起始位置,避免一打开就对
  let startWrapped;
  do {
    startWrapped = Math.floor(Math.random() * 720);
  } while (Math.abs(startWrapped - targetMinutes) < 60);

  // 走最短路径过去
  const currentWrapped = ((currentMinutes % 720) + 720) % 720;
  let delta = startWrapped - currentWrapped;
  if (delta >  360) delta -= 720;
  if (delta < -360) delta += 720;
  currentMinutes += delta;
  render();
}


// ====== 10. 提交答案 ======
btnSubmit.addEventListener('click', () => {
  if (isLocked) return;
  submitAnswer();
});

function submitAnswer() {
  // 用分针角度判定(±3° = ±0.5 分钟容差)
  const currentWrapped = ((currentMinutes % 720) + 720) % 720;
  const currentMinuteAngle = (currentWrapped % 60) * 6;     // 0-360
  const targetMinuteAngle  = (targetMinutes  % 60) * 6;
  let diff = Math.abs(currentMinuteAngle - targetMinuteAngle);
  if (diff > 180) diff = 360 - diff;

  // 同时也要小时正确(整点容差大些:小时部分可以偏 ±0.5 小时)
  const currentHour = Math.floor(currentWrapped / 60);
  const targetHour  = Math.floor(targetMinutes  / 60);
  // 跨小时边界判定:用 currentMinutes 的真实位置来比
  const totalDiff = Math.abs(currentWrapped - targetMinutes);
  const wrappedDiff = Math.min(totalDiff, 720 - totalDiff);  // 720 分钟环上的最短距离
  // 容差:±3° 分针 ≈ ±0.5 分钟,但联动会带动时针,所以整体容差用 wrappedDiff < 1 分钟
  const isCorrect = wrappedDiff < 1.5;

  if (isCorrect) handleCorrect(false);
  else           handleWrong();
}

function handleCorrect(viaDemo) {
  lock();
  // 钟表庆祝动画
  clock.classList.remove('shake');
  clock.classList.add('celebrate');
  // 撒花
  spawnConfetti(40);

  const text = viaDemo ? '🌟 看明白了吗?' : '🎉 答对啦!';

  if (levelIndex < TOTAL_LEVELS - 1) {
    // 还有下一关:1.8s 后自动进入
    showOverlay(text, [], 1800, () => {
      clock.classList.remove('celebrate');
      unlock();
      levelIndex += 1;
      startLevel(levelIndex);
    });
  } else {
    // 通关!满屏撒花 + 按钮
    setTimeout(() => spawnConfetti(60), 300);
    setTimeout(() => spawnConfetti(60), 700);
    showOverlay('🏆 全部通关!', [
      { label: '🔁 再玩一次', onClick: () => {
        hideOverlay();
        clock.classList.remove('celebrate');
        unlock();
        levelIndex = 0;
        startLevel(levelIndex);
      }},
      { label: '🏠 回自由玩', onClick: () => {
        hideOverlay();
        clock.classList.remove('celebrate');
        unlock();
        setMode('sandbox');
        setRandomTime();
      }}
    ], 0);
  }
}

function handleWrong() {
  errorCount += 1;
  // 钟表摇头
  clock.classList.remove('shake');
  void clock.offsetWidth;             // 触发重排,重启动画
  clock.classList.add('shake');

  if (errorCount >= 3) {
    // 3 次错 → 自动演示
    challengeHint.textContent = '别急,我演示给你看 👀';
    setTimeout(autoDemo, 800);
  } else if (errorCount === 1) {
    challengeHint.textContent = '再想想~ 看看分针应该指几?';
  } else {
    challengeHint.textContent = '快了!分针指向目标的"分"那个位置 💪';
  }
}


// ====== 11. 自动演示:指针缓慢滑到目标 ======
function autoDemo() {
  lock();
  // 走最短路径
  const currentWrapped = ((currentMinutes % 720) + 720) % 720;
  let delta = targetMinutes - currentWrapped;
  if (delta >  360) delta -= 720;
  if (delta < -360) delta += 720;

  // 给指针加 .demo 类:transition 1.6s
  handMinute.classList.add('demo');
  handHour.classList.add('demo');

  currentMinutes += delta;
  render();

  // 1.7s 后视为演示完成,触发"对"流程
  setTimeout(() => {
    handMinute.classList.remove('demo');
    handHour.classList.remove('demo');
    handleCorrect(true);
  }, 1700);
}


// ====== 12. 锁定/解锁 ======
function lock()   { isLocked = true;  body.classList.add('locked'); }
function unlock() { isLocked = false; body.classList.remove('locked'); }


// ====== 13. 浮层:显示/隐藏 ======
// actions: [{label, onClick}, ...];duration > 0 = 自动消失;= 0 = 等用户点
function showOverlay(text, actions, duration, onAutoClose) {
  overlayText.textContent = text;
  overlayActions.innerHTML = '';

  actions.forEach(act => {
    const btn = document.createElement('button');
    btn.textContent = act.label;
    btn.addEventListener('click', act.onClick);
    overlayActions.appendChild(btn);
  });

  overlay.classList.add('show');

  if (duration > 0) {
    setTimeout(() => {
      hideOverlay();
      if (onAutoClose) onAutoClose();
    }, duration);
  }
}

function hideOverlay() {
  overlay.classList.remove('show');
  overlayText.textContent = '';
  overlayActions.innerHTML = '';
}


// ====== 14. 撒花:动态生成 N 个彩色方块,从顶部下落 ======
const CONFETTI_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF8C42', '#C780FA'];

function spawnConfetti(count) {
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti';
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const left  = Math.random() * 100;            // 0-100vw
    const dur   = 2 + Math.random() * 2;          // 2-4s
    const delay = Math.random() * 0.4;            // 0-0.4s 错峰
    const size  = 8 + Math.random() * 8;          // 8-16px
    piece.style.left = `${left}vw`;
    piece.style.background = color;
    piece.style.width  = `${size}px`;
    piece.style.height = `${size}px`;
    piece.style.animationDuration = `${dur}s`;
    piece.style.animationDelay    = `${delay}s`;
    confettiBox.appendChild(piece);
    // 动画结束自动清理
    setTimeout(() => piece.remove(), (dur + delay) * 1000 + 200);
  }
}


// ====== 15. 启动 ======
setRandomTime();
