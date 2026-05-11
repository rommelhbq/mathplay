/* ============================================
   MathPlay - script.js
   核心:状态(state)→ 事件(event)→ 渲染(render)
   ============================================ */

// ====== 1. 状态:用一个数字记录"现在几点几分" ======
// currentMinutes 取值 0-719,代表 12 小时 × 60 分钟 的总分钟数
// 例:12:00 = 0,1:30 = 90,11:59 = 719
let currentMinutes = 0;


// ====== 2. 抓取 HTML 元素 ======
const clock      = document.querySelector('.clock');
const handHour   = document.querySelector('.hand-hour');
const handMinute = document.querySelector('.hand-minute');
const timeLabel  = document.getElementById('time-label');
const btnReset   = document.getElementById('btn-reset');


// ====== 3. 渲染函数:根据 currentMinutes 重画指针和时间 ======
function render() {
  // 拆出小时和分钟
  const minute = currentMinutes % 60;
  const hour   = Math.floor(currentMinutes / 60);  // 0-11

  // --- 计算指针角度 ---
  // 分针:每分钟 6° (360 / 60)
  const minuteAngle = minute * 6;
  // 时针:每小时 30° + 每分钟 0.5° (这就是"联动"!)
  const hourAngle   = hour * 30 + minute * 0.5;

  // --- 应用到 CSS transform ---
  // translateX(-50%) 让指针水平居中,rotate() 旋转
  handMinute.style.transform = `translateX(-50%) rotate(${minuteAngle}deg)`;
  handHour.style.transform   = `translateX(-50%) rotate(${hourAngle}deg)`;

  // --- 更新文字时间(12 小时制,12:00 而不是 0:00) ---
  const displayHour = hour === 0 ? 12 : hour;
  // padStart(2, '0') 让分钟永远两位数:5 → "05"
  const displayMin  = String(minute).padStart(2, '0');
  timeLabel.textContent = `${displayHour}:${displayMin}`;
}


// ====== 4. 算触摸点对应的"分钟数" ======
// 输入:触摸点的屏幕坐标 (x, y)
// 输出:对应的分钟 (0-59)
function pointToMinute(x, y) {
  // 拿到钟表中心点的屏幕坐标
  const rect    = clock.getBoundingClientRect();
  const centerX = rect.left + rect.width  / 2;
  const centerY = rect.top  + rect.height / 2;

  // 触摸点相对于中心的偏移
  const dx = x - centerX;
  const dy = y - centerY;

  // atan2 算出角度(弧度),0 在右侧(3 点钟方向)
  // 转成度数:* 180 / π
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;

  // 钟表的 0 度在顶部(12 点),顺时针,所以 +90,再保证 0-360
  angle = (angle + 90 + 360) % 360;

  // 每分钟占 6 度,四舍五入到最近的整数分钟
  let minute = Math.round(angle / 6) % 60;
  return minute;
}


// ====== 5. 拖动时更新状态(关键:跨 12 点要正确进/退一小时) ======
function updateFromTouch(x, y) {
  const newMinute = pointToMinute(x, y);
  const oldMinute = currentMinutes % 60;

  // 算"最短路径":从 oldMinute 到 newMinute 走哪边更近
  let delta = newMinute - oldMinute;
  if (delta >  30) delta -= 60;  // 比如 58 → 2,直接算是 -56,实际应该是 +4
  if (delta < -30) delta += 60;  // 比如 2 → 58,直接算是 +56,实际应该是 -4

  currentMinutes += delta;

  // 把 currentMinutes 拉回 0-719 范围(支持 12 小时循环)
  currentMinutes = ((currentMinutes % 720) + 720) % 720;

  render();
}


// ====== 6. 监听触摸/鼠标事件 ======
// pointer 事件统一处理触摸 + 鼠标(iPad 和 Mac 都能用)
let isDragging = false;

clock.addEventListener('pointerdown', (e) => {
  isDragging = true;
  clock.setPointerCapture(e.pointerId);  // 锁定指针,即使移出钟表也跟踪
  updateFromTouch(e.clientX, e.clientY);
});

clock.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  updateFromTouch(e.clientX, e.clientY);
});

clock.addEventListener('pointerup', () => {
  isDragging = false;
});

clock.addEventListener('pointercancel', () => {
  isDragging = false;
});


// ====== 7. 重置按钮:换个随机时间 ======
function setRandomTime() {
  // 随机 0-719 分钟,但避开 0(12:00)以免和初始一样
  currentMinutes = Math.floor(Math.random() * 720);
  render();
}

btnReset.addEventListener('click', setRandomTime);


// ====== 8. 启动:初始随机时间 + 第一次渲染 ======
setRandomTime();
