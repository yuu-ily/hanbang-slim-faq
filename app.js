// ============================================================
// Hanbang Slim FAQ — Static SPA
// Public: read faqs.json. Admin: commits to GitHub via API.
// ============================================================

// CONFIG — populated at deploy time by build step / sed.
const CONFIG = {
  // GitHub repo info — set automatically when the site is pushed.
  owner: window.__HBS_OWNER__ || "OWNER_PLACEHOLDER",
  repo: window.__HBS_REPO__ || "REPO_PLACEHOLDER",
  branch: "main",
  dataPath: "data/faqs.json",
  // Hashed admin password (SHA-256 hex). Set at deploy time.
  passwordHash: window.__HBS_PW_HASH__ || "PW_HASH_PLACEHOLDER",
};

const state = {
  faqs: [],
  categories: [],
  filter: "all",
  search: "",
  sha: null,
  isAdmin: false,
};

// -------- utils --------
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// -------- data loading --------
async function loadFaqs() {
  // Try GitHub API first (gets SHA for writes + latest content)
  if (CONFIG.owner !== "OWNER_PLACEHOLDER") {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dataPath}?ref=${CONFIG.branch}`,
        { headers: { Accept: "application/vnd.github.v3+json" }, cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        state.sha = data.sha;
        const content = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, "")))));
        applyData(content);
        return;
      }
    } catch (e) { /* fallback below */ }
  }
  // Fallback: bundled JSON
  const res = await fetch("./data/faqs.json", { cache: "no-store" });
  applyData(await res.json());
}

function applyData(data) {
  state.faqs = data.faqs || [];
  state.categories = data.categories || [];
  renderCategories();
  renderFaqs();
  if (state.isAdmin) {
    renderCategorySelect();
    renderCatList();
  }
}

// -------- rendering --------
function renderCategories() {
  const cats = ["all", ...state.categories];
  $("categories").innerHTML = cats
    .map(
      (c) =>
        `<button class="cat-chip${c === state.filter ? " active" : ""}" data-cat="${esc(c)}">${
          c === "all" ? "すべて" : esc(c)
        }</button>`
    )
    .join("");
  $("categories")
    .querySelectorAll(".cat-chip")
    .forEach((el) =>
      el.addEventListener("click", () => {
        state.filter = el.dataset.cat;
        renderCategories();
        renderFaqs();
      })
    );
}

function renderFaqs() {
  const q = state.search.trim().toLowerCase();
  const filtered = state.faqs.filter((f) => {
    if (state.filter !== "all" && f.category !== state.filter) return false;
    if (q && !(f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q) || (f.category || "").toLowerCase().includes(q))) return false;
    return true;
  });

  $("empty").hidden = filtered.length > 0;
  $("faq-list").innerHTML = filtered
    .map(
      (f) => `
      <div class="faq-item" data-id="${esc(f.id)}">
        <div class="faq-q">
          <span class="q-mark">Q</span>
          <div class="q-text">
            <div class="q-cat">${esc(f.category || "")}</div>
            ${esc(f.question)}
          </div>
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="faq-a">${esc(f.answer)}</div>
        ${state.isAdmin ? `<div class="faq-actions"><button data-delete="${esc(f.id)}">削除</button></div>` : ""}
      </div>`
    )
    .join("");

  $("faq-list")
    .querySelectorAll(".faq-q")
    .forEach((el) => el.addEventListener("click", () => el.parentElement.classList.toggle("open")));

  if (state.isAdmin) {
    $("faq-list")
      .querySelectorAll("[data-delete]")
      .forEach((b) =>
        b.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (!confirm("このFAQを削除しますか？")) return;
          await deleteFaq(b.dataset.delete);
        })
      );
  }
}

function renderCategorySelect() {
  $("f-category").innerHTML = state.categories
    .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
    .join("");
}

function renderCatList() {
  $("cat-list").innerHTML = state.categories
    .map(
      (c) =>
        `<li><span>${esc(c)}</span><button data-delcat="${esc(c)}">削除</button></li>`
    )
    .join("");
  $("cat-list")
    .querySelectorAll("[data-delcat]")
    .forEach((b) =>
      b.addEventListener("click", async () => {
        const c = b.dataset.delcat;
        if (state.faqs.some((f) => f.category === c)) {
          alert("このカテゴリには登録済みFAQがあります。先にFAQを削除してください。");
          return;
        }
        if (!confirm(`カテゴリ「${c}」を削除しますか？`)) return;
        state.categories = state.categories.filter((x) => x !== c);
        await saveData("カテゴリ削除: " + c);
      })
    );
}

// -------- admin auth & GitHub writes --------
const TOKEN_KEY = "hbs_token";
const SESSION_KEY = "hbs_session";

function getToken() { return localStorage.getItem(TOKEN_KEY) || ""; }
function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); }

async function adminLogin() {
  $("admin-error").hidden = true;
  const pw = $("admin-pw").value;
  const tok = $("admin-token").value.trim();
  if (tok) setToken(tok);

  const hash = await sha256(pw);
  if (hash !== CONFIG.passwordHash) {
    $("admin-error").textContent = "パスワードが違います";
    $("admin-error").hidden = false;
    return;
  }
  if (!getToken()) {
    $("admin-error").textContent = "初回はGitHubアクセストークンを入力してください";
    $("admin-error").hidden = false;
    return;
  }
  sessionStorage.setItem(SESSION_KEY, "1");
  state.isAdmin = true;
  $("admin-login").hidden = true;
  $("admin-panel").hidden = false;
  renderCategorySelect();
  renderCatList();
  renderFaqs();
  $("admin-pw").value = "";
  $("admin-token").value = "";
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  state.isAdmin = false;
  $("admin-modal").hidden = true;
  $("admin-login").hidden = false;
  $("admin-panel").hidden = true;
  renderFaqs();
}

async function saveData(commitMessage) {
  const token = getToken();
  if (!token) { alert("GitHubトークンがありません。再ログインしてください。"); return; }
  const body = {
    categories: state.categories,
    faqs: state.faqs,
  };
  const contentB64 = btoa(unescape(encodeURIComponent(JSON.stringify(body, null, 2) + "\n")));

  $("save-status").hidden = false;
  $("save-status").textContent = "保存中...";

  const res = await fetch(
    `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dataPath}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: commitMessage,
        content: contentB64,
        sha: state.sha,
        branch: CONFIG.branch,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    $("save-status").textContent = "保存に失敗しました: " + (err.message || res.status);
    return false;
  }
  const out = await res.json();
  state.sha = out.content.sha;
  $("save-status").textContent = "保存しました（数十秒で反映）";
  renderCategories();
  renderFaqs();
  renderCatList();
  return true;
}

async function addFaq(e) {
  e.preventDefault();
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    category: $("f-category").value,
    question: $("f-question").value.trim(),
    answer: $("f-answer").value.trim(),
    createdAt: new Date().toISOString(),
  };
  if (!item.question || !item.answer) return;
  state.faqs.unshift(item);
  $("save-btn").disabled = true;
  const ok = await saveData("FAQ追加: " + item.question.slice(0, 40));
  $("save-btn").disabled = false;
  if (ok) {
    $("f-question").value = "";
    $("f-answer").value = "";
  } else {
    state.faqs.shift();
  }
}

async function deleteFaq(id) {
  const before = state.faqs.slice();
  state.faqs = state.faqs.filter((f) => f.id !== id);
  renderFaqs();
  const ok = await saveData("FAQ削除: " + id);
  if (!ok) { state.faqs = before; renderFaqs(); }
}

async function addCategory() {
  const v = $("new-cat").value.trim();
  if (!v) return;
  if (state.categories.includes(v)) { alert("既にあります"); return; }
  state.categories.push(v);
  $("new-cat").value = "";
  await saveData("カテゴリ追加: " + v);
}

// -------- init --------
document.addEventListener("DOMContentLoaded", async () => {
  await loadFaqs();

  $("search").addEventListener("input", (e) => {
    state.search = e.target.value;
    renderFaqs();
  });

  $("admin-toggle").addEventListener("click", () => {
    $("admin-modal").hidden = false;
    if (sessionStorage.getItem(SESSION_KEY)) {
      state.isAdmin = true;
      $("admin-login").hidden = true;
      $("admin-panel").hidden = false;
      renderCategorySelect();
      renderCatList();
      renderFaqs();
    }
  });
  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => ($("admin-modal").hidden = true))
  );
  $("admin-modal").addEventListener("click", (e) => {
    if (e.target.id === "admin-modal") $("admin-modal").hidden = true;
  });
  $("admin-login-btn").addEventListener("click", adminLogin);
  $("logout-btn").addEventListener("click", logout);
  $("faq-form").addEventListener("submit", addFaq);
  $("add-cat-btn").addEventListener("click", addCategory);

  // Secret URL trigger: append ?admin to open modal directly
  if (location.search.includes("admin")) $("admin-toggle").click();
});
