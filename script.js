/* ============================================
   MathPlay - script.js
   核心:状态(state)→ 事件(event)→ 渲染(render)
   ============================================ */

// ====== 1. 状态:用一个数字记录"现在几点几分" ======
// currentMinutes 是一个"连续累加"的数字,不限范围(可以是 -50、0、1000、99999...)
// 为什么不 wrap 到 0-719?因为 CSS transition 只认数字大小,
//   如果数字突然从 718 跳到 0,CSS 会把角度"反着转回去"(360° 倒车 bug)
// 解决:让数字一直顺着用户拖动方向变化,显示时间时再做 % 720
let currentMinutes = 0;


// ====== 2. 抓取 HTML 元素 ======
const clock      = document.querySelector('.clock');
const handHour   = document.querySelector('.hand-hour');
const handMinute = document.querySelector('.hand-minute');
const timeLabel  = document.getElementById('time-label');
const btnReset   = document.getElementById('btn-reset');


// ====== 3. 渲染函数:根据 currentMinutes 重画指针和时间 ======
function render() {
  // --- 计算指针角度(直接用连续值,永远不会跳变) ---
  // 分针:每分钟 6° → minuteAngle 跟 currentMinutes 同步增长,CSS 看到的永远是平滑变化
  const minuteAngle = currentMinutes * 6;
  // 时针:每分钟 0.5° (= 每小时 30°,联动公式)
  const hourAngle   = currentMinutes * 0.5;

  handMinute.style.transform = `translateX(-50%) rotate(${minuteAngle}deg)`;
  handHour.style.transform   = `translateX(-50%) rotate(${hourAngle}deg)`;

  // --- 显示文字时间:这里才把数字 wrap 到 0-719 范围 ---
  // ((x % 720) + 720) % 720 处理负数情况(JS 的 % 对负数会返回负值)
  const wrapped     = ((currentMinutes % 720) + 720) % 720;
  const minute      = wrapped % 60;
  const hour        = Math.floor(wrapped / 60);   // 0-11
  const displayHour = hour === 0 ? 12 : hour;
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
  // 注意:currentMinutes 可能是负数或很大的数,要正确取出"当前是第几分钟"
  const oldMinute = ((currentMinutes % 60) + 60) % 60;

  // 算"最短路径":从 oldMinute 到 newMinute 走哪边更近
  let delta = newMinute - oldMinute;
  if (delta >  30) delta -= 60;  // 比如 58 → 2,直接算是 -56,实际应该是 +4
  if (delta < -30) delta += 60;  // 比如 2 → 58,直接算是 +56,实际应该是 -4

  // 连续累加,绝不 wrap(这就是修复 360° 倒车 bug 的关键)
  currentMinutes += delta;

  render();
}


// ====== 6. 监听触摸/鼠标事件(只在分针上,不在表盘上) ======
// 设计原则:只有分针是"可控的因",时针是"被动的果",空白处无反应。
// 这样:① 教学聚焦——只有一个可操作对象  ② 触发联动概念——时针自己动,引发"为什么"
let isDragging = false;

handMinute.addEventListener('pointerdown', (e) => {
  isDragging = true;
  handMinute.setPointerCapture(e.pointerId);  // 锁定指针,即使手指移出胖外套也跟踪
  updateFromTouch(e.clientX, e.clientY);
  e.preventDefault();
});

handMinute.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  updateFromTouch(e.clientX, e.clientY);
});

handMinute.addEventListener('pointerup',     () => { isDragging = false; });
handMinute.addEventListener('pointercancel', () => { isDragging = false; });


// ====== 7. 重置按钮:换个随机时间(也走最短路径,避免 360° 倒车) ======
function setRandomTime() {
  // 算当前在 12 小时循环里的位置(0-719)
  const currentWrapped = ((currentMinutes % 720) + 720) % 720;
  // 随机一个目标位置
  const target = Math.floor(Math.random() * 720);
  // 算最短路径(避免跨 12 点时的反向 360° 倒转)
  let delta = target - currentWrapped;
  if (delta >  360) delta -= 720;
  if (delta < -360) delta += 720;
  currentMinutes += delta;
  render();
}

btnReset.addEventListener('click', setRandomTime);


// ====== 8. 启动:初始随机时间 + 第一次渲染 ======
setRandomTime();
