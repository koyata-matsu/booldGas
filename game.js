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
);

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
async function checkLogin() {
  const { data } = await db.auth.getSession();
  isLoggedIn = !!data.session;
}

let currentUserEmail = null;
function openLoginModal() {
  document.getElementById("loginModal").style.display = "flex";
}


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

  document.getElementById("stageList").style.display = "none";
  document.getElementById("stageDetail").style.display = "block";

  const info = getStages()[String(stage)] || {};
  document.getElementById("stageTitle").textContent = info.title || "";
  document.getElementById("stageDescription").textContent = info.description || "";
  document.getElementById("stageKnowledge").textContent = info.knowledge || "";

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

document.addEventListener("DOMContentLoaded", async () => {
  await checkLogin();
  await loadFromSheet();
  renderStageList();
});



resumeBtn.onclick = () => {
  isPaused = false;
setChoicesDisabled(false);
requestAnimationFrame(move);
  resumeBtn.style.display = "none";
  pauseBtn.style.display = "inline-block";
};

pauseBtn.onclick = () => {
  isPaused = true;
  setChoicesDisabled(true);
  pauseBtn.style.display = "none";
  resumeBtn.style.display = "inline-block";
};

menuBtn.onclick = () => {
  // ゲーム状態を完全リセット
  isPlaying = false;
  isPaused = false;

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

  renderStageList(); // ステージ状態更新
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

    btn.classList.remove("current", "lock", "lock-login");
    btn.disabled = false;

    /* ===== ステージ1〜3：常に解放 ===== */
    if (stage <= 3) {
      btn.classList.add("current");
      btn.querySelector(".stage-subtitle").textContent = "▶ 今すぐプレイ";
      return;
    }

    /* ===== ログインしていない場合：4以降は全部NG ===== */
    if (!isLoggedIn) {
      btn.classList.add("lock-login");
      btn.querySelector(".stage-subtitle").textContent =
        "🔒 ログインが必要です";
      return;
    }

    /* ===== ログイン済み ===== */

    // ステージ4：ログインだけでOK
    if (stage === 4) {
      btn.classList.add("current");
      btn.querySelector(".stage-subtitle").textContent =
        "▶ プレイ可能";
      return;
    }

    // ステージ5以降：前ステージクリア必須
    const prevStage = stage - 1;
    if (!clearedStages.includes(prevStage)) {
      btn.classList.add("lock");
      btn.querySelector(".stage-subtitle").textContent =
        `🔒 ステージ${prevStage}をクリアしてください`;
      return;
    }

    // 解放済み
    btn.classList.add("current");
    btn.querySelector(".stage-subtitle").textContent =
      "▶ プレイ可能";
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
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}
function getStages() {
  return JSON.parse(localStorage.getItem(STAGE_KEY)) || {};
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

  // レーン1のみ（ログイン前）
  lanes.push({
    x: window.innerWidth,
    quizIndex: current,
    resolved: false
  });

  updateSpeedInfo();
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
function startGame() {
  document.getElementById("stageDetail").style.display = "none";
  document.getElementById("gameScreen").style.display = "block";

  isPaused = false;
  

  startCountdown(() => {
    startStage(selectedStage);
    
  });
}


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
}
function endStage(type) {
  isPlaying = false;
  isPaused = false;

  lanes = [];
  stopHpDrain();

  let message = "";
  let unlockStage = null;

  if (type === "perfect") {
    // クリア済み保存
    if (!clearedStages.includes(selectedStage)) {
      clearedStages.push(selectedStage);
      localStorage.setItem(
        "clearedStages",
        JSON.stringify(clearedStages)
      );

      // ログインユーザーなら Supabase にも保存
      if (isLoggedIn && userProgress) {
        db.from("user_progress")
          .update({ cleared_stages: clearedStages })
          .eq("user_id", userProgress.user_id);
      }
    }

    // ★ ステージ4以降は次のステージ解放演出
    if (selectedStage >= 4 && selectedStage < MAX_STAGE) {
      const nextStage = selectedStage + 1;

      // まだ解放されていない場合のみ
      if (!clearedStages.includes(nextStage)) {
        unlockStage = nextStage;
        message = `🎉 ステージ${nextStage} 解放！`;
      }
    }

    // 通常クリア
    if (!message) {
      message = "🎉 ステージクリア！";
    }
  } else {
    message = "💀 ゲームオーバー";
  }

  document.getElementById("gameScreen").style.display = "none";

  const overlay = document.getElementById("countdown");
  overlay.textContent = message;
  overlay.style.display = "flex";

  setTimeout(() => {
    overlay.style.display = "none";
    endToList();
    renderStageList();
  }, unlockStage ? 1500 : 1000);
}





// =========================
// Render
// =========================
function renderQuestion() {
  const q = stageQuizzes[current];
  if (!q) return;

  if (q.questionType === "case") {
    document.getElementById("laneContainer").style.display = "none";
    renderCaseUI(q);
    renderChoices(q.steps[currentStep]);
    startCaseTimer(q.steps[currentStep]);
  } else {
    document.getElementById("caseArea").style.display = "none";
    document.getElementById("laneContainer").style.display = "block";
    questionEls[0].textContent = q.question;
    renderChoices(q);
  }
  updateRemain();
}

function renderCaseUI(q) {
  const step = q.steps[currentStep];
  document.getElementById("caseArea").style.display = "block";
  document.getElementById("caseText").textContent = q.caseText || "";
  document.getElementById("caseQuestion").textContent = step.question;

  const memoEl = document.getElementById("caseMemo");
 memoEl.innerHTML = memoList.length
  ? memoList.map(m => `
      <pre class="case-memo-item">${m}</pre>
    `).join("")
  : `<pre class="case-memo-item muted">（まだ判断はありません）</pre>`;
}

// =========================
// Choices
// =========================
function renderChoices(quiz) {
  choicesEl.innerHTML = "";

  quiz.choices.forEach((text, index) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = text;
    btn.onclick = () => checkAnswer(index);
    choicesEl.appendChild(btn);
  });
}
function resetSpeed() {
  speed = Number(stageConfig.speedStart);
  updateSpeedInfo();
}

function endToList() {
    
  isPlaying = false;
  isPaused = false;

  lanes = [];
  current = 0;
  currentStep = 0;
  memoList = [];
  stopHpDrain(); // ★ 必ず止める


  document.getElementById("stageDetail").style.display = "none";
  document.getElementById("gameScreen").style.display = "none";
  document.getElementById("stageList").style.display = "block";
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


function checkAnswer(index) {
  const q = stageQuizzes[current];
  if (!q || !isPlaying) return;

  stopCaseTimer();

  // =========================
  // CASE 問題
  // =========================
  if (q.questionType === "case") {
    const step = q.steps[currentStep];
    if (!step) {
      console.warn("CASE step undefined", currentStep, q.steps.length);
      return;
    }

    const isCorrect = step.answers.includes(index);

    showPopup(isCorrect ? "○" : "×");

    // 解説表示（CASEは数秒で消す）
    const expEl = document.getElementById("explanationText");
    expEl.textContent = step.explanation || "";
    setTimeout(() => {
      expEl.textContent = "";
    }, 5000);

    // memo 追加
    if (step.memo) {
      memoList.push(step.memo);
    }

    // ★ 進行は advanceQuestion に一本化
    advanceQuestion({ correct: isCorrect });
    return;
  }

  // =========================
  // NORMAL 問題
  // =========================
  const isCorrect = q.answers.includes(index);

  showPopup(isCorrect ? "○" : "×");

  if (isCorrect) {
    hp += HP_CORRECT;
  } else {
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

  advanceQuestion({ correct: isCorrect });
}


function openStage(stage) {
    selectedStage = stage;

  document.getElementById("stageList").style.display = "none";
  document.getElementById("stageDetail").style.display = "block";

  const info = getStages()[String(stage)] || {};
  document.getElementById("stageTitle").textContent = info.title || "";
  document.getElementById("stageDescription").textContent = info.description || "";
  document.getElementById("stageKnowledge").textContent = info.knowledge || "";
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
    return;
  }

  enterStage(stage);
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
};




// =========================
// Case timer
// =========================
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
      // ★ タイムアウトも advanceQuestion に一本化
      advanceQuestion({ correct: false });
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
function showPopup(text) {
  const p = document.getElementById("popup");
  p.textContent = text;
  p.style.display = "block";
  setTimeout(() => (p.style.display = "none"), 800);
}

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
  const URL = "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLj_09em7QhPTtEb455Spu__WC_Y84c0SkJxoAYEvBhLVuZEEh7KcB_ab6Xq9BKl10cYAWGGe_XB5VSPK1LBLgDw47tHTfBp45Cyfqm5cR1y3ic38KpJaoUiakClWEmijucwCyeNCCOa3bhnTCbMzry8LoZHeEfnQQ2HyY8ZJjc8eaRGDi8k9Iz7gPq10bUKrpiESu0uSr0eC-Z-DEC0TThQdSgnKSGS8lfHlY4s4v-1njNgztaYtrOcOxMbwYbdajNSdvbTCGxTepZCfPKa6v-bke2UCg&lib=M-c4AW_-jaCtRM9OSBimxB9GSk0SJ0LNw";

  try {
    const res = await fetch(URL, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }

    const data = await res.json();

    // 構造チェック（重要）
    if (!data || !data.quizzes || !data.stages) {
      throw new Error("Invalid JSON structure");
    }

    localStorage.setItem("flowQuizzes", JSON.stringify(data.quizzes));
    localStorage.setItem("flowStages", JSON.stringify(data.stages));

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

  if (correct) {
    correctCount++;

    // ★ 正解時スピードアップ
    speed = Math.min(
      stageConfig.speedMax,
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
        currentStep = 0;
        memoList = [];
        initLanes();   // ← 次の問題でも speed は維持される
        renderQuestion();
      }, 500);
      return;
    }

    setTimeout(renderQuestion, 300);
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
  }, 300);
}







// =========================
// Init
// =========================

