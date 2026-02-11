// =========================
// Storage / Config
// =========================
const STORAGE_KEY = "flowQuizzes";
const STAGE_KEY   = "flowStages";
let isPaused = false;
const DEADLINE_X = 60; // 画面左端の判定ライン（px）

let lanes = [];        // ← Flow用（必須）
let speed = 2;         // ← 流れる速さ
const DEFAULT_STAGE_CONFIG = {
  clearLine: 10,
  maxQuestions: 30,
  speedStart: 2,
  speedMax: 5,
  speedUpRate: 0.08,
  enableTwoLane: false,
  laneUnlockAt: 10,
  laneGapSec: 1.5
};
let hp = 100;
const HP_MAX = 100;
const HP_CORRECT = 10;
const HP_WRONG = 10;
let hpDrainTimer = null;
const HP_DRAIN_PER_SEC = 2; // ← 1秒で減るHP（調整用）
let correctCount = 0;
const memoEl = document.getElementById("caseMemo");
let gameTimer = null;   // setInterval 用
let isLoggedIn = false;
let clearedStages = JSON.parse(
  localStorage.getItem("clearedStages") || "[]"
).map(Number);
let selectedIndexes = [];
const BASE_WIDTH = 1200; // PC基準幅
const authBar = document.getElementById("authBar");

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");

let currentUserEmail = null;
function openLoginModal() {
  document.getElementById("loginModal").style.display = "flex";
}
let quizzesCache = [];
let stagesCache = {};


// =========================
// Stage State
// =========================
const MAX_STAGE = 9;

// localStorage に保存される
// stageClear = { 1: true, 2: true, 3: false ... }



// =========================
// DOM (必須)
// =========================
// =========================
// DOM
// =========================
const menuBtn    = document.getElementById("menuBtn");
const pauseBtn   = document.getElementById("pauseBtn");
const resumeBtn  = document.getElementById("resumeBtn");
const stageList  = document.getElementById("stageList");
const gameScreen = document.getElementById("gameScreen");
const overlay    = document.getElementById("countdown");
window.openStage = function(stage) {
  
  selectedStage = stage;
authBar.style.display = "none"; // ← 追加

  document.getElementById("stageList").style.display = "none";
  document.getElementById("stageDetail").style.display = "block";

  const info = getStages()[String(stage)] || {};
  document.getElementById("stageTitle").textContent = info.title || "";
  document.getElementById("stageDescription").textContent = info.description || "";
  document.getElementById("stageKnowledge").textContent = info.knowledge || "";
// 🔥 管理者メール
const ADMIN_EMAIL = "koyatamaro@icloud.com";

if (stage === 9 && currentUserEmail !== ADMIN_EMAIL) {
  alert("🚧 ステージ9は現在作成中です");

  document.getElementById("stageDetail").style.display = "none";
  document.getElementById("gameScreen").style.display = "none";
  document.getElementById("stageList").style.display = "block";
  authBar.style.display = "flex";

  return;
}
  // ステージ1〜3
  if (stage <= 3) {
    enterStage(stage);
    return;
  }

  // ステージ4
  if (stage === 4) {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    enterStage(stage);
    return;
  }

  // ステージ5以降
  if (!isLoggedIn) {
    document.getElementById("loginModal").style.display = "flex";
    return;
  }

  if (!clearedStages.includes(stage - 1)) {
  alert(`ステージ${stage - 1}をクリアしてください`);

  // 🔥 メニューに戻す
  document.getElementById("stageDetail").style.display = "none";
  document.getElementById("gameScreen").style.display = "none";
  document.getElementById("stageList").style.display = "block";
  authBar.style.display = "flex";

  return;
}

  enterStage(stage);
};

async function checkLogin() {
  const { data } = await db.auth.getSession();
  if (data.session) {
    isLoggedIn = true;
    currentUserEmail = data.session.user.email;
  } else {
    isLoggedIn = false;
    currentUserEmail = null;
  }
  updateAuthBar();
}
// ログイン
loginBtn.onclick = async () => {
  const email = emailInput.value;
  const password = passwordInput.value;

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    alert(error.message);
    return;
  }

  loginModal.style.display = "none";
  await checkLogin();
  renderStageList();
};

// 新規登録
signupBtn.onclick = async () => {
  const email = emailInput.value;
  const password = passwordInput.value;

  const { error } = await db.auth.signUp({ email, password });
  if (error) {
    alert(error.message);
    return;
  }

  alert("確認メールを送りました。メールを確認してください。");
};
function showMenuScreen() {
  stageList.style.display = "block";
  gameScreen.style.display = "none";
  stageDetail.style.display = "none";

  authBar.style.display = "flex";  // ← ここ絶対
}

function updateAuthBar() {
  const statusEl = document.getElementById("authStatus");
  const btn = document.getElementById("authBtn");

  if (isLoggedIn) {
    statusEl.textContent = `ログイン中：${currentUserEmail}`;
    btn.textContent = "ログアウト";
    btn.classList.add("logout");
  } else {
    statusEl.textContent = "未ログイン";
    btn.textContent = "ログイン / アカウント作成";
    btn.classList.remove("logout");
  }
}
document.getElementById("authBtn").onclick = async () => {
   if (isLoggedIn) {
    await logout();        // ← ログイン中ならログアウト
  } else {
    openLoginModal();      // ← 未ログインならログイン画面
  }
  
};






resumeBtn.onclick = () => {
  isPaused = false;
  sounds.bgm.pause();
setChoicesDisabled(false);
requestAnimationFrame(move);
  resumeBtn.style.display = "none";
  pauseBtn.style.display = "inline-block";
};

pauseBtn.onclick = () => {
  isPaused = true;
  sounds.bgm.pause();
  setChoicesDisabled(true);
  pauseBtn.style.display = "none";
  resumeBtn.style.display = "inline-block";
};

menuBtn.onclick = () => {
  // ゲーム状態を完全リセット
  isPlaying = false;
  isPaused = false;
sounds.bgm.pause();
  sounds.bgm.currentTime = 0;
  stopHpDrain();
  stopGameLoop();
  stopCaseTimer();

  lanes = [];
  current = 0;
  currentStep = 0;
  memoList = [];

  // overlay が残ってたら必ず消す（重要）
  overlay.style.display = "none";

  // 画面切り替え
  gameScreen.style.display = "none";
  stageList.style.display = "block";

  // ボタン状態も戻す
  resumeBtn.style.display = "none";
  pauseBtn.style.display = "inline-block";

  showMenuScreen();  // ← 統一
};



// ログイン
document.getElementById("loginBtn").onclick = async () => {
  const email = emailInput.value;
  const password = passwordInput.value;

  if (!email || !password) {
    alert("メールとパスワードを入力してください");
    return;
  }

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert("ログイン失敗：" + error.message);
    return;
  }

  document.getElementById("loginModal").style.display = "none";

  await checkLogin();

  showMenuScreen();   // ← ここ重要
  renderStageList();
};

async function logout() {
  const { error } = await db.auth.signOut();
  if (error) {
    alert("ログアウトに失敗しました");
    return;
  }

  // 状態リセット
  isLoggedIn = false;
  currentUserEmail = null;

  // ログインUI更新
  updateAuthBar();
  renderStageList();

  alert("ログアウトしました");
}
// 新規登録



stageList.style.display = "block";
gameScreen.style.display = "none";


// =========================
// Data access
// ========================
function renderStageList() {
  const buttons = document.querySelectorAll(".stage-card");

  buttons.forEach(btn => {
    const stage = Number(btn.getAttribute("onclick").match(/\d+/)[0]);

    btn.classList.remove("lock", "lock-login");
    btn.disabled = false;

    // 既存バッジ削除
    const oldBadge = btn.querySelector(".stage-badge");
    if (oldBadge) oldBadge.remove();

    const badge = document.createElement("div");
    badge.classList.add("stage-badge");
const ADMIN_EMAIL = "koyatamaro@icloud.com";

if (stage === 9) {
  if (currentUserEmail === ADMIN_EMAIL) {
    badge.textContent = "ADMIN";
    badge.classList.add("playable");
  } else {
    badge.textContent = "COMING SOON";
    badge.classList.add("locked");
    btn.disabled = true;
  }

  btn.appendChild(badge);
  return;
}
    // ===== ステージ1〜3 =====
    if (stage <= 3) {
      badge.textContent = "PLAY";
      badge.classList.add("playable");
      btn.appendChild(badge);
      return;
    }

    // ===== 未ログイン =====
    if (!isLoggedIn) {
      badge.textContent = "LOGIN";
      badge.classList.add("login");
      btn.appendChild(badge);
      return;
    }

    // ===== ログイン済み =====
    if (stage === 4) {
      badge.textContent = "PLAY";
      badge.classList.add("playable");
      btn.appendChild(badge);
      return;
    }
    // 🔥 ステージ9は常に作成中

    const prevStage = stage - 1;

    if (!clearedStages.includes(prevStage)) {
      badge.textContent = "LOCK";
      badge.classList.add("locked");
      btn.appendChild(badge);
      return;
    }

    badge.textContent = "PLAY";
    badge.classList.add("playable");
    btn.appendChild(badge);
  });
}









function getStageKnowledge(stage) {
  const knowledge = {
    1: `
● 血液ガス・電解質の正常値
pH：7.35〜7.45
PaCO2：35〜45 mmHg
HCO3⁻：22〜26 mEq/L
Na：135〜145 mEq/L
Cl：98〜108 mEq/L
`,

    2: `
● pH / PaCO2 / HCO3⁻ の役割
・pH：酸塩基の最終結果
・PaCO2：呼吸（肺）
・HCO3⁻：代謝（腎）
`,

    3: `
● 酸塩基異常の4分類
① 代謝性アシドーシス
② 代謝性アルカローシス
③ 呼吸性アシドーシス
④ 呼吸性アルカローシス
`,

    4: `
● 代謝性アシドーシスの代償
予測PaCO2 ≒ HCO3⁻ × 1.5 + 8 ±2
`,

    5: `
● AG計算と補正
AG = Na - (Cl + HCO3⁻)
補正AG = AG + (4 - Alb)
補正HCO3 = HCO3⁻ + (AG - 12)
`,

    6: `
● 呼吸性異常の急性・慢性
急性：HCO3変化が小さい
慢性：HCO3が代償的に上昇/低下
`,

    7: `
● 混合性障害の考え方
主病態 → 代償の適切さ → 合併を疑う
`,

    8: `
● 原因検索の検査
乳酸、血糖、ケトン、浸透圧Gap、尿Cl など
`,

    9: `
● 症例ベースの思考順
① 主病態
② 代償と合併
③ 原因
④ 初期対応
`
  };

  return `<pre>${knowledge[stage] || ""}</pre>`;
}



function stopGameLoop() {
  if (gameTimer) {
    clearInterval(gameTimer);
    gameTimer = null;
  }
}

function openKnowledge(stage) {
  const stages = getStages();
  const info = stages[String(stage)];
  if (!info) return;

  document.getElementById("knowledgeTitle").textContent =
    `📘 ステージ${stage}：必要な知識`;

  document.getElementById("knowledgeBody").textContent =
    info.knowledge || "準備中";

  document.getElementById("knowledgeModal").style.display = "flex";
}

function closeKnowledge() {
  document.getElementById("knowledgeModal").style.display = "none";
}

function updateSpeedInfo() {
  const el = document.getElementById("speedInfo");
  if (!el) return;
  el.textContent = `🚀 speed: ${speed.toFixed(2)}`;
}


function startHpDrain() {
  stopHpDrain(); // 二重防止
  hpDrainTimer = setInterval(() => {
    if (!isPlaying || isPaused) return;

    const q = stageQuizzes[current];
    if (q?.questionType === "case") return; // ★ CASE中は減らさない

    hp -= HP_DRAIN_PER_SEC;
    updateHpBar();

    if (hp <= 0) {
      stopHpDrain();
      endStage("gameover");
    }
  }, 1000);
}

function stopHpDrain() {
  if (hpDrainTimer) {
    clearInterval(hpDrainTimer);
    hpDrainTimer = null;
  }
}

function getQuizzes() {
  return quizzesCache || [];
}
function getStages() {
  return stagesCache || {};
}
function updateHpBar() {
  hp = Math.max(0, Math.min(HP_MAX, hp));
  const fill = document.getElementById("hpFill");
  fill.style.width = hp + "%";

  // 色変化（UX強化）
  if (hp > 60) {
    fill.style.background = "linear-gradient(90deg, #4caf50, #81c784)";
  } else if (hp > 30) {
    fill.style.background = "linear-gradient(90deg, #facc15, #fde047)";
  } else {
    fill.style.background = "linear-gradient(90deg, #ef4444, #f87171)";
  }
}

function initLanes() {
  lanes = [];

  const isMobileOrTablet = window.innerWidth <= 1024;

  let startX;

  if (isMobileOrTablet) {
    // 画面の80%位置からスタート（少し見えている）
    startX = window.innerWidth * 0.8;
  } else {
    // PCは今まで通り
    startX = window.innerWidth;
  }

  lanes.push({
    x: startX,
    quizIndex: current,
    resolved: false
  });

  updateSpeedInfo();
}
function getMaxSpeed() {
  const isMobile = window.innerWidth <= 1024;
  const isLandscape = window.innerWidth > window.innerHeight;

  if (isMobile && isLandscape) {
    return Math.min(stageConfig.speedMax, 3.5);
  }

  return stageConfig.speedMax;
}




function showPopup(text) {
  const p = document.getElementById("popup");
  p.textContent = text;
  p.style.display = "block";
  setTimeout(() => {
    p.style.display = "none";
  }, 800);
}

// =========================
// DOM
// =========================
const questionEls = [
  document.getElementById("question-0"),
  document.getElementById("question-1")
];
const choicesEl = document.getElementById("choices");

// =========================
// State
// =========================
let selectedStage = null;
let stageConfig = {};
let stageQuizzes = [];
let current = 0;
let currentStep = 0;
let memoList = [];
let isPlaying = false;
let caseTimerId = null;

// =========================
// Stage select
// =========================


// =========================
// Game start
// =========================
const sounds = {
  correct: new Audio("sounds/correct.mp3"),
  wrong: new Audio("sounds/wrong.mp3"),
  click: new Audio("sounds/click.mp3"),
  bgm: new Audio("sounds/bgm.mp3")
};

sounds.bgm.loop = true;
sounds.bgm.volume = 0.05;

function playSound(sound, volume = 1) {
  const s = sound.cloneNode();
  s.volume = volume;
  s.play().catch(() => {});
}

// 🔥 ここに置く
document.addEventListener("click", e => {
  if (e.target.tagName === "BUTTON") {
    playSound(sounds.click, 0.05);
  }
});


// BGM設定
sounds.bgm.loop = true;
sounds.bgm.volume = 0.05;

// 効果音は重なっても鳴るように
function playSound(sound, volume = 1) {
  const s = sound.cloneNode();
  s.volume = volume;
  s.play().catch(() => {});
}


function startGame() {
    // 🔥 横向きチェック
  if (window.innerWidth <= 1024 && !isLandscape()) {
    showRotateOverlay();
    return;
  }

  authBar.style.display = "none";
  document.getElementById("stageDetail").style.display = "none";
  document.getElementById("gameScreen").style.display = "block";

  isPaused = false;
  sounds.bgm.play();

  startCountdown(() => {
    startStage(selectedStage);
  });
}

window.addEventListener("resize", () => {
  if (isLandscape()) {
    hideRotateOverlay();
  }
});
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function groupQuizzesForShuffle(quizzes) {
  return quizzes.map(q => {
    if (q.questionType === "case") {
      return {
        type: "case",
        items: [q]   // CASEは塊
      };
    }
    return {
      type: "normal",
      items: [q]
    };
  });
}
function shuffleQuizzesKeepCase(quizzes) {
  const units = groupQuizzesForShuffle(quizzes);
  const shuffledUnits = shuffleArray(units);
  return shuffledUnits.flatMap(u => u.items);
}


function startStage(stage) {
  const quizzes = getQuizzes();
  const stages  = getStages();
const stageInfo = getStages()[String(stage)] || {};
document.getElementById("stageName").textContent =
  `🎯 ${stageInfo.title || "Stage " + stage}`;

  stageConfig = { ...DEFAULT_STAGE_CONFIG, ...(stages[String(stage)] || {}) };
  stageQuizzes = shuffleQuizzesKeepCase(
  quizzes.filter(q => Number(q.stage) === Number(stage))
);

  current = 0;
  currentStep = 0;
  memoList = [];
  isPlaying = true;
  isPaused = false;

  // ★ HP 初期化
  hp = HP_MAX;
  updateHpBar();
  startHpDrain();
    correctCount = 0;
    resetSpeed();
  if (stageQuizzes.length === 0) {
    alert("このステージに問題がありません");
    endToList();
    return;
  }

  initLanes();      // ★ 超重要
  renderQuestion();
  updateRemain();   // ★ 追加
  move();           // ★ Flow開始
  setTimeout(autoScaleGame, 50);

}
function endStage(type) {
  isPlaying = false;
  isPaused = false;

  sounds.bgm.pause();
  sounds.bgm.currentTime = 0;
  lanes = [];
  stopHpDrain();

  let message = "";

  if (type === "perfect") {

    // ★ 数値で保存する（超重要）
    const stageNum = Number(selectedStage);

    if (!clearedStages.includes(stageNum)) {
      clearedStages.push(stageNum);
      localStorage.setItem(
        "clearedStages",
        JSON.stringify(clearedStages)
      );
    }

    message = "🎉 ステージクリア！";

  } else {
    message = "💀 ゲームオーバー";
  }

  document.getElementById("gameScreen").style.display = "none";

  const overlay = document.getElementById("countdown");
  overlay.textContent = message;
  overlay.style.display = "flex";

  setTimeout(() => {
    overlay.style.display = "none";
    showMenuScreen();
    renderStageList(); // ← ここ超重要
  }, 1000);
}






// =========================
// Render
// =========================
function renderQuestion() {
  const q = stageQuizzes[current];
  if (!q) return;

  const imgEl = document.getElementById("questionImage");

  // CASE
  if (q.questionType === "case") {
    document.getElementById("laneContainer").style.display = "none";
    renderCaseUI(q);

    const step = q.steps[currentStep];

    // 画像処理
    if (step.image) {
      imgEl.src = step.image;
      imgEl.style.display = "block";
    } else {
      imgEl.style.display = "none";
    }

    renderChoices(step);
    startCaseTimer(step);
    return;
  }

  // NORMAL
  document.getElementById("caseArea").style.display = "none";
  document.getElementById("laneContainer").style.display = "block";

  // テキスト問題（あれば表示）
  questionEls[0].textContent = q.question || "";

  // 画像問題（あれば表示）
  if (q.image) {
    imgEl.src = q.image;
    imgEl.style.display = "block";
  } else {
    imgEl.style.display = "none";
  }

  renderChoices(q);
}

function renderCaseUI(q) {
  const step = q.steps[currentStep];

  document.getElementById("caseArea").style.display = "block";
  document.getElementById("caseText").textContent = q.caseText || "";
  document.getElementById("caseQuestion").textContent = step.question;

  const memoEl = document.getElementById("caseMemo");

  if (memoList.length > 0) {
    const lastMemo = memoList[memoList.length - 1];
    memoEl.innerHTML = `
      <pre class="case-memo-item">${lastMemo}</pre>
    `;
  } else {
    memoEl.innerHTML = `
      <pre class="case-memo-item muted">（まだ判断はありません）</pre>
    `;
  }
}


// =========================
// Choices
// =========================
function renderChoices(quiz) {
  choicesEl.innerHTML = "";
  selectedIndexes = [];

  // answersを強制的に配列化
  let answers = quiz.answers;

  if (typeof answers === "string") {
    answers = answers.split(",").map(n => Number(n.trim()));
  }

  if (!Array.isArray(answers)) {
    answers = [Number(answers)];
  }

  quiz.answers = answers; // 上書きして統一

  const isMulti = answers.length > 1;

  quiz.choices.forEach((text, index) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = text;

    btn.onclick = () => {
      if (!isPlaying) return;

      if (isMulti) {
        btn.classList.toggle("selected");

        if (selectedIndexes.includes(index)) {
          selectedIndexes = selectedIndexes.filter(i => i !== index);
        } else {
          selectedIndexes.push(index);
        }
      } else {
        checkAnswer(index);
      }
    };

    choicesEl.appendChild(btn);
  });

  if (isMulti) {
    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "決定";
    confirmBtn.className = "confirm-btn";
    confirmBtn.onclick = () => checkMultiAnswer(quiz);
    choicesEl.appendChild(confirmBtn);
  }
}

function checkMultiAnswer(quiz) {
  isPlaying = false;
  isPaused = true;

  const correctAnswers = [...quiz.answers].sort();
  const selected = [...selectedIndexes].sort();

  const isCorrect =
    correctAnswers.length === selected.length &&
    correctAnswers.every((v, i) => v === selected[i]);

  const buttons = document.querySelectorAll("#choices .choice");

  buttons.forEach((btn, i) => {
    btn.disabled = true;

    const isRight = correctAnswers.includes(i);
    const isSelected = selected.includes(i);

    if (isRight && isSelected) {
      // 正しく選んだ
      btn.classList.add("correct");
    } 
    else if (!isRight && isSelected) {
      // 間違って選んだ
      btn.classList.add("wrong");
    }
    else if (isRight && !isSelected) {
      // 選び忘れた正解
      btn.classList.add("correct");
    }
  });

  showPopup(isCorrect ? "○" : "×");

  if (isCorrect) {
    playSound(sounds.correct);
    hp += HP_CORRECT;
  } else {
    playSound(sounds.wrong);
    hp -= HP_WRONG;
  }

  updateHpBar();

  if (hp <= 0) {
    endStage("gameover");
    return;
  }

  setTimeout(() => {
    isPaused = false;
    advanceQuestion({ correct: isCorrect });
  }, 1200);
}




function highlightAnswers(quiz, selected = []) {
  const buttons = document.querySelectorAll("#choices .choice");

  buttons.forEach((btn, index) => {
    btn.disabled = true;

    if (quiz.answers.includes(index)) {
      btn.classList.add("correct");  // 正解は緑
    } else if (selected.includes(index)) {
      btn.classList.add("wrong");    // 間違いは赤
    }
  });
}



function resetSpeed() {
  const isMobile = window.innerWidth <= 1024;
  const isLandscape = window.innerWidth > window.innerHeight;

  let baseSpeed;

  if (isMobile && isLandscape) {
    // 横向きモバイルは少し遅く
    baseSpeed = stageConfig.speedStart * 0.6;
  } else {
    // PCは画面幅に応じて変化
    const widthRatio = window.innerWidth / BASE_WIDTH;

    // 速くなりすぎ・遅くなりすぎ防止
    const clampedRatio = Math.min(1.3, Math.max(0.7, widthRatio));

    baseSpeed = stageConfig.speedStart * clampedRatio;
  }

  // ★ 最終的な上限を適用
  speed = Math.min(baseSpeed, getMaxSpeed());

  updateSpeedInfo();
}


function endToList() {
  isPlaying = false;
  isPaused = false;

  sounds.bgm.pause();
  sounds.bgm.currentTime = 0;

  lanes = [];
  current = 0;
  currentStep = 0;
  memoList = [];
  stopHpDrain();

  document.getElementById("stageDetail").style.display = "none";
  document.getElementById("gameScreen").style.display = "none";
  document.getElementById("stageList").style.display = "block";

  showMenuScreen(); 
  document.getElementById("gameInner").style.transform = "scale(1)";
}

function showExplanation(correct) {
  const area = document.getElementById("explanationArea");
  area.style.borderLeft =
    correct ? "4px solid #22c55e" : "4px solid #ef4444";
}
function updateRemain() {
  const remain = Math.max(
    0,
    stageConfig.clearLine - correctCount
  );

  document.getElementById("clearRemain").textContent =
    `🧩 クリアまであと ${remain} 問`;
}

function autoScaleGame() {
  const isTabletOrPhone = window.innerWidth <= 1024;
  const isLandscape = window.innerWidth > window.innerHeight;

  if (!isTabletOrPhone || !isLandscape) {
    document.getElementById("gameInner").style.transform = "scale(1)";
    return;
  }

  const inner = document.getElementById("gameInner");
  const screenHeight = window.innerHeight;
  const contentHeight = inner.scrollHeight;

  if (contentHeight > screenHeight) {
    const scale = screenHeight / contentHeight;
    inner.style.transform = `scale(${scale})`;
  } else {
    inner.style.transform = "scale(1)";
  }
}

function checkAnswer(index) {
  const q = stageQuizzes[current];
  if (!q || !isPlaying) return;

  isPlaying = false;
  isPaused = true;
  stopCaseTimer();

  // =========================
  // CASE 問題
  // =========================
  if (q.questionType === "case") {
    const step = q.steps[currentStep];
    if (!step) return;

    const isCorrect = step.answers.includes(index);

    paintAnswers(step.answers, [index]);

    showPopup(isCorrect ? "○" : "×");

    if (isCorrect) {
      playSound(sounds.correct);
    } else {
      playSound(sounds.wrong);
      hp -= HP_WRONG;
      updateHpBar();

      if (hp <= 0) {
        endStage("gameover");
        return;
      }
    }

    if (step.memo) {
      memoList.push(step.memo);
      renderCaseUI(q);
    }

    document.getElementById("explanationText").textContent =
      step.explanation || "";

    setTimeout(() => {
      isPaused = false;
      advanceQuestion({ correct: isCorrect });
    }, 1200);

    return;
  }

  // =========================
  // NORMAL 問題
  // =========================

  const isCorrect = q.answers.includes(index);

  paintAnswers(q.answers, [index]);

  showPopup(isCorrect ? "○" : "×");

  if (isCorrect) {
    playSound(sounds.correct);
    hp += HP_CORRECT;
  } else {
    playSound(sounds.wrong);
    hp -= HP_WRONG;
  }

  updateHpBar();

  if (q.explanation) {
    document.getElementById("explanationText").textContent = q.explanation;
  }

  if (hp <= 0) {
    endStage("gameover");
    return;
  }

  setTimeout(() => {
    isPaused = false;
    advanceQuestion({ correct: isCorrect });
  }, 1200);
}

function paintAnswers(correctIndexes, selectedIndexes) {
  const buttons = document.querySelectorAll("#choices .choice");

  buttons.forEach((btn, i) => {
    btn.disabled = true;

    // 正解は常に緑
    if (correctIndexes.includes(i)) {
      btn.classList.add("correct");
    }

    // 押したけど間違いは赤
    if (selectedIndexes.includes(i) && !correctIndexes.includes(i)) {
      btn.classList.add("wrong");
    }
  });
}




function enterStage(stage) {
  selectedStage = stage;
  document.getElementById("stageList").style.display = "none";
  document.getElementById("stageDetail").style.display = "block";

  const info = getStages()[String(stage)] || {};
  document.getElementById("stageTitle").textContent = info.title || "";
  document.getElementById("stageDescription").textContent =
    info.description || "";
  document.getElementById("stageKnowledge").textContent =
    info.knowledge || "";
}

function setChoicesDisabled(disabled) {
  const buttons = document.querySelectorAll("#choices button");
  buttons.forEach(btn => {
    btn.disabled = disabled;
  });
}


document.getElementById("closeLoginModal").onclick = () => {
  document.getElementById("loginModal").style.display = "none";

  // ステージ詳細を閉じる
  document.getElementById("stageDetail").style.display = "none";

  // メニュー一覧へ戻る
  document.getElementById("stageList").style.display = "block";

  // ログインバー表示
  authBar.style.display = "flex";
};


document.getElementById("signupBtn").onclick = async () => {
  const email = emailInput.value;
  const password = passwordInput.value;

  if (!email || !password) {
    alert("メールとパスワードを入力してください");
    return;
  }

  const { data, error } = await db.auth.signUp({
    email,
    password
  });

  if (error) {
    alert("登録失敗：" + error.message);
    return;
  }

  alert(
    "確認メールを送りました。\n" +
    "メール内のリンクをクリックするとログイン完了です。"
  );

  // ★ モーダルを閉じる
  document.getElementById("loginModal").style.display = "none";

  // ★ メニューへ戻る
  showMenuScreen();

  // ★ ステージ状態を更新
  renderStageList();
};
function isLandscape() {
  return window.innerWidth > window.innerHeight;
}

function showRotateOverlay() {
  const overlay = document.getElementById("rotateOverlay");
  overlay.style.display = "flex";
}

function hideRotateOverlay() {
  const overlay = document.getElementById("rotateOverlay");
  overlay.style.display = "none";
}




// =========================
// Case timer
// =========================
function showCountdown(num) {
  const el = document.getElementById("countdown");
  el.textContent = num;
  el.style.display = "block";
}
function showJudge(isCorrect) {
  const el = document.getElementById("judge");
  el.textContent = isCorrect ? "◯" : "×";
  el.className = "judge " + (isCorrect ? "correct" : "wrong");
}

function startCaseTimer(step) {
  stopCaseTimer();

  const secEl = document.getElementById("caseTimerSec");
  const timerEl = document.getElementById("caseTimer");

  let t = step.timeLimitSec || 15;
  secEl.textContent = t;
  timerEl.style.display = "block";

  caseTimerId = setInterval(() => {
    t--;
    secEl.textContent = t;

    if (t <= 0) {
      stopCaseTimer();

      // ★ HP減少
      hp -= HP_WRONG;
      updateHpBar();

      const q = stageQuizzes[current];
      if (!q) return;

      const stepData = q.steps[currentStep];

      // ★ memo追加（正解不正解関係なく）
      if (stepData?.memo) {
        memoList.push(stepData.memo);
        renderCaseUI(q);
      }

      // ★ 解説は消さない
      document.getElementById("explanationText").textContent =
        stepData?.explanation || "";

      if (hp <= 0) {
        endStage("gameover");
        return;
      }

      // ★ 1秒待ってから次へ（演出時間）
      setTimeout(() => {
        advanceQuestion({ correct: false });
      }, 1000);
    }

  }, 1000);
}



function stopCaseTimer() {
  if (caseTimerId) clearInterval(caseTimerId);
  caseTimerId = null;
}

// =========================
// Utils
// =========================


function startCountdown(cb) {
  const el = document.getElementById("countdown");
  let c = 3;
  el.style.display = "flex";
  el.textContent = c;

  const t = setInterval(() => {
    c--;
    if (c === 0) {
      clearInterval(t);
      el.style.display = "none";
      cb();
    } else {
      el.textContent = c;
    }
  }, 1000);
}

async function loadFromSheet(retry = 3) {
  const baseURL = "https://script.google.com/macros/s/AKfycbxwFdMyj-GQ6YucmKNwJwM8nuKqsThsSnAKWlnLS5pIicsKQEY6vAOQKiTykRLCmGI8/exec";

  // キャッシュ回避（？にする）
  const URL = baseURL + "?t=" + new Date().getTime();

  try {
    const res = await fetch(URL, {
      method: "GET",
      mode: "cors"
    });

    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }

    const data = await res.json();

    if (!data || !data.quizzes || !data.stages) {
      throw new Error("Invalid JSON structure");
    }

    quizzesCache = data.quizzes;
    stagesCache = data.stages;

    console.log("✅ Sheet loaded", data);

  } catch (e) {
    console.warn("❌ loadFromSheet failed", e);

    if (retry > 0) {
      setTimeout(() => loadFromSheet(retry - 1), 2000);
    } else {
      alert("スプレッドシートのデータ取得に失敗しました");
    }
  }
}


function move() {
  if (!isPlaying || isPaused) return;

  updateSpeedInfo();

  const q = stageQuizzes[current];
  if (!q) return;

  // CASEは流さない
  if (q.questionType === "case") {
    requestAnimationFrame(move);
    return;
  }

  lanes.forEach((lane, i) => {
    const el = questionEls[i];
    if (!lane || !el || lane.resolved) return;

    if (lane.x == null) {
      lane.x = window.innerWidth;
      el.style.left = lane.x + "px";
    }

    lane.x -= speed;
    el.style.left = lane.x + "px";

    if (lane.x <= DEADLINE_X) {
      lane.resolved = true;

      showPopup("×");
      hp -= HP_WRONG;
      updateHpBar();

      if (hp <= 0) {
        endStage("gameover");
        return;
      }

      advanceQuestion({ correct: false });
    }
  });

  requestAnimationFrame(move);
}

function advanceQuestion({ correct }) {

  isPlaying = true;

  if (correct) {
    correctCount++;
    updateRemain();
    speed = Math.min(
      getMaxSpeed(),
      speed + stageConfig.speedUpRate
    );

    updateSpeedInfo();

    if (correctCount >= stageConfig.clearLine) {
      endStage("perfect");
      return;
    }
  }

  stopCaseTimer();

  const q = stageQuizzes[current];
  if (!q) return;

  if (q.questionType === "case") {
    currentStep++;

    if (currentStep >= q.steps.length) {
      showPopup("🎉 症例クリア！！");

      setTimeout(() => {
        current++;
        updateRemain();
        currentStep = 0;
        memoList = [];
        initLanes();
        renderQuestion();
        requestAnimationFrame(move);   // ← 追加
      }, 500);
      return;
    }

    setTimeout(() => {
      renderQuestion();
      requestAnimationFrame(move);   // ← 追加
    }, 300);

    return;
  }

  current++;

  if (current >= stageQuizzes.length) {
    endStage("perfect");
    return;
  }

  initLanes();

  setTimeout(() => {
    renderQuestion();
    updateRemain();
    requestAnimationFrame(move);   // ← 追加（重要）
    isPaused = false;

  }, 300);
}

window.addEventListener("resize", autoScaleGame);
window.addEventListener("DOMContentLoaded", async () => {
  await loadFromSheet();
  renderStageList();
});





// =========================
// Init
// =========================

