/***********************
 * 0. 定数と便利関数
 ***********************/

// 自動で付けるタグ（本文に含まれる言葉で判定）
const TAG_RULES = [
  { name: "😊 ポジティブ",  match: ["嬉","楽","幸","ワクワク"] },
  { name: "😟 不安",        match: ["不安","怖","緊張"] },
  { name: "💤 疲労",        match: ["疲","しんど","つかれ"] },
  { name: "🔥 意欲",        match: ["したい","やりたい","挑戦"] },
];

let selectedTag = null; // タグフィルタの選択状態

// DOM取得
const diaryInput  = document.getElementById("diaryInput");
const saveButton  = document.getElementById("saveButton");
const clearButton = document.getElementById("clearButton");
const diaryList   = document.getElementById("diaryList");
const charCount   = document.getElementById("charCount");
const searchInput = document.getElementById("searchInput");
const tagFilter   = document.getElementById("tagFilter");
const themeToggle = document.getElementById("themeToggle");

// localStorage ラッパ
function loadAll() {
  const raw = localStorage.getItem("diaryList");
  return raw ? JSON.parse(raw) : [];
}
function saveAll(list) {
  localStorage.setItem("diaryList", JSON.stringify(list));
}

// 日付表示（YYYY/MM/DD HH:mm）
function formatDate(iso) {
  const d = new Date(iso);
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}
// 今日/昨日バッジ
function dayLabel(iso){
  const d = new Date(iso);
  const today = new Date(); today.setHours(0,0,0,0);
  const that  = new Date(d); that.setHours(0,0,0,0);
  const diffDays = Math.round((today - that)/(1000*60*60*24));
  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  return null;
}

/***********************
 * 1. タグ・質問・要約
 ***********************/
function createTagsFromText(text) {
  const tags = [];
  TAG_RULES.forEach(rule => {
    const ok = rule.match.some(word => text.includes(word));
    if (ok) tags.push(rule.name);
  });
  if (tags.length === 0) tags.push("🗒️ その他");
  return tags;
}

function createQuestionsFromText(text) {
  let qs = [];
  if (text.includes("嬉") || text.includes("楽") || text.includes("幸")) {
    qs.push("その嬉しさ・楽しさはどこから来たと思う？");
  }
  if (text.includes("疲") || text.includes("しんど") || text.includes("つかれ")) {
    qs.push("疲れた原因は何？それは減らせそう？");
  }
  if (text.includes("不安") || text.includes("怖") || text.includes("緊張")) {
    qs.push("その不安の正体はなんだと思う？小さく確かめる方法はある？");
  }
  if (text.includes("したい") || text.includes("やりたい") || text.includes("挑戦")) {
    qs.push("なぜそれをやりたい？今日15分で一歩進めるなら何をする？");
  }
  if (qs.length === 0) {
    qs.push("今日の出来事から学べたことは何？");
  }
  return qs.slice(0, 3);
}

function makeSummary(text) {
  const s = text.trim().replace(/\s+/g, " ");
  const first = s.split(/[。．！？?!\n]/)[0] || s;
  return first.length > 80 ? first.slice(0,80) + "…" : first;
}

/***********************
 * 2. レンダリング
 ***********************/
function renderAll() {
  const list = loadAll().sort((a,b)=> b.id - a.id); // 新しい順
  const keyword = (searchInput.value || "").toLowerCase();
  diaryList.innerHTML = "";

  list.forEach(entry => {
    // タグフィルタ
    if (selectedTag && !entry.tags.includes(selectedTag)) return;

    // 検索（本文・要約・答え）
    const hay = (entry.text + " " + (entry.summary||"") + " " + Object.values(entry.answers||{}).join(" ")).toLowerCase();
    if (keyword && !hay.includes(keyword)) return;

    diaryList.appendChild(makeCard(entry));
  });
}

function makeCard(entry) {
  const card = document.createElement("div");
  card.className = "card";

  // ヘッダ（日付 + 今日/昨日）
  const head = document.createElement("div");
  head.className = "head";
  const left = document.createElement("div");
  left.textContent = "日記";
  const time = document.createElement("time");
  const label = dayLabel(entry.createdAt);
  time.textContent = (label ? `${label} ` : "") + formatDate(entry.createdAt);
  head.appendChild(left); head.appendChild(time);

  // 本文
  const pText = document.createElement("p");
  pText.textContent = entry.text;

  // 要約
  const pSummary = document.createElement("p");
  pSummary.style.margin = "6px 0";
  pSummary.style.fontWeight = "bold";
  pSummary.textContent = "要約: " + (entry.summary || "");

  // タグバッジ
  const badges = document.createElement("div");
  badges.className = "badges";
  entry.tags.forEach(t => {
    const b = document.createElement("span");
    b.className = "badge";
    b.textContent = t;
    badges.appendChild(b);
  });

  // 操作ボタン（編集・削除）
  const ops = document.createElement("div");
  const editBtn = document.createElement("button");
  editBtn.className = "btn";
  editBtn.textContent = "編集";
  const delBtn = document.createElement("button");
  delBtn.className = "btn danger";
  delBtn.textContent = "削除";
  ops.appendChild(editBtn); ops.appendChild(delBtn);

  editBtn.addEventListener("click", () => {
    const newText = prompt("本文を編集：", entry.text);
    if (newText == null) return;
    const v = newText.trim();
    if (!v) return alert("空の本文は保存できません。");
    entry.text = v;
    entry.summary = makeSummary(v);
    entry.questions = createQuestionsFromText(v);
    entry.tags = createTagsFromText(v);
    updateEntry(entry);
  });

  delBtn.addEventListener("click", () => {
    if (!confirm("この日記を削除しますか？")) return;
    const all = loadAll().filter(e => e.id !== entry.id);
    saveAll(all);
    renderAll();
  });

  // 質問＋答え
  const ul = document.createElement("ul");
  entry.questions.forEach(q => {
    const li = document.createElement("li");
    const qText = document.createElement("div");
    qText.className = "q";
    qText.textContent = q;
    li.appendChild(qText);

    const previous = entry.answers && entry.answers[q];

    if (previous) {
      const wrap = document.createElement("div");
      wrap.className = "answered";

      const ans = document.createElement("div");
      ans.textContent = "あなたの答え： " + previous;
      ans.style.marginTop = "4px";

      const editBtn = document.createElement("button");
      editBtn.className = "btn";
      editBtn.textContent = "編集";
      editBtn.style.marginLeft = "8px";
      editBtn.addEventListener("click", () => {
        entry.answers[q] = undefined; // 未回答に戻す
        updateEntry(entry);
      });

      wrap.appendChild(ans);
      wrap.appendChild(editBtn);
      li.appendChild(wrap);
    } else {
      const row = document.createElement("div");
      row.className = "answerRow";
      const ta = document.createElement("textarea");
      ta.rows = 2; ta.placeholder = "ここに自分の答えを書く"; ta.style.flex = "1";
      const saveBtn = document.createElement("button");
      saveBtn.className = "btn";
      saveBtn.textContent = "答えを保存";
      saveBtn.addEventListener("click", () => {
        const val = ta.value.trim();
        if (!val) return alert("答えを入力してください。");
        if (!entry.answers) entry.answers = {};
        entry.answers[q] = val;
        updateEntry(entry);
      });
      row.appendChild(ta); row.appendChild(saveBtn);
      li.appendChild(row);
    }

    ul.appendChild(li);
  });

  card.appendChild(head);
  card.appendChild(pText);
  card.appendChild(pSummary);
  card.appendChild(badges);
  card.appendChild(ops);
  card.appendChild(ul);

  return card;
}

function updateEntry(entry) {
  const list = loadAll();
  const idx = list.findIndex(e => e.id === entry.id);
  if (idx !== -1) {
    list[idx] = entry;
    saveAll(list);
    renderAll();
  }
}

/***********************
 * 3. イベント
 ***********************/

// 保存
saveButton.addEventListener("click", () => {
  const text = diaryInput.value.trim();
  if (!text) return;
  if (text.length < 10) {
    alert("もう少し詳しく書いてみよう（10文字以上推奨）");
    return;
  }

  const entry = {
    id: Date.now(),
    text,
    summary: makeSummary(text),
    questions: createQuestionsFromText(text),
    answers: {},
    tags: createTagsFromText(text),
    createdAt: new Date().toISOString()
  };

  const list = loadAll();
  list.push(entry);
  saveAll(list);

  diaryInput.value = "";
  localStorage.removeItem("draft");
  charCount.textContent = "0 文字";
  renderAll();
});

// 全削除
clearButton.addEventListener("click", () => {
  if (!confirm("本当にすべての記録を削除しますか？")) return;
  localStorage.removeItem("diaryList");
  renderAll();
});

// 文字数カウント & ドラフト保存
diaryInput.addEventListener("input", () => {
  charCount.textContent = `${diaryInput.value.length} 文字`;
  localStorage.setItem("draft", diaryInput.value);
});

// Ctrl/Cmd + Enter で保存
diaryInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    saveButton.click();
  }
});

// 検索
searchInput.addEventListener("input", () => {
  renderAll();
});

// テーマ切替
themeToggle.addEventListener("click", ()=>{
  const r = document.documentElement;
  r.classList.toggle("light");
  localStorage.setItem("theme", r.classList.contains("light") ? "light" : "dark");
});

/***********************
 * 4. タグフィルタ
 ***********************/
function buildTagFilter() {
  tagFilter.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = "tag" + (selectedTag ? "" : " active");
  allBtn.textContent = "すべて";
  allBtn.addEventListener("click", () => {
    selectedTag = null; buildTagFilter(); renderAll();
  });
  tagFilter.appendChild(allBtn);

  const names = [...new Set(TAG_RULES.map(r => r.name).concat(["🗒️ その他"]))];
  names.forEach(name => {
    const btn = document.createElement("button");
    btn.className = "tag" + (selectedTag === name ? " active" : "");
    btn.textContent = name;
    btn.addEventListener("click", () => {
      selectedTag = name; buildTagFilter(); renderAll();
    });
    tagFilter.appendChild(btn);
  });
}

/***********************
 * 5. 初期化
 ***********************/
window.addEventListener("load", () => {
  // テーマ復元
  if (localStorage.getItem("theme")==="light") {
    document.documentElement.classList.add("light");
  }
  // ドラフト復元
  const d = localStorage.getItem("draft");
  if (d) {
    diaryInput.value = d;
    charCount.textContent = `${d.length} 文字`;
  }
  buildTagFilter();
  renderAll();
});
