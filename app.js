// ============================================================
// Hanbang Slim FAQ — Static SPA (Vercel-hosted)
// Public: read faqs.json from GitHub raw (always latest).
// Admin: POST password + data to /api/save (serverless).
// ============================================================

const CONFIG = {
  owner: "yuu-ily",
  repo: "hanbang-slim-faq",
  branch: "main",
  dataPath: "data/faqs.json",
};

const state = {
  faqs: [],
  categories: [],
  filter: "all",
  search: "",
  isAdmin: false,
  password: "",
  editingId: null,
};

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// -------- data loading (public, no auth) --------
async function loadFaqs() {
  const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dataPath}?ref=${CONFIG.branch}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github.v3+json" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const content = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, "")))));
      applyData(content);
      return;
    }
  } catch (e) { /* fallback */ }
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
    if (q && !(
      f.question.toLowerCase().includes(q) ||
      f.answer.toLowerCase().includes(q) ||
      (f.category || "").toLowerCase().includes(q)
    )) return false;
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
        ${state.isAdmin ? `<div class="faq-actions"><button data-edit="${esc(f.id)}">編集</button><button data-delete="${esc(f.id)}">削除</button></div>` : ""}
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
    $("faq-list")
      .querySelectorAll("[data-edit]")
      .forEach((b) =>
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          startEdit(b.dataset.edit);
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
    .map((c) => `<li><span>${esc(c)}</span><button data-delcat="${esc(c)}">削除</button></li>`)
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

// -------- admin (server-side via /api/save) --------
const SESSION_KEY = "hbs_session";

async function adminLogin() {
  $("admin-error").hidden = true;
  const pw = $("admin-pw").value;
  if (!pw) return;

  // Verify by attempting a no-op save (revalidates against the server).
  // We do this by sending current state — server checks password only.
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: pw, verifyOnly: true }),
  });

  if (res.status === 401) {
    $("admin-error").textContent = "パスワードが違います";
    $("admin-error").hidden = false;
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    $("admin-error").textContent = "ログインに失敗しました: " + (err.error || res.status);
    $("admin-error").hidden = false;
    return;
  }

  state.password = pw;
  sessionStorage.setItem(SESSION_KEY, pw);
  state.isAdmin = true;
  $("admin-login").hidden = true;
  $("admin-panel").hidden = false;
  renderCategorySelect();
  renderCatList();
  renderFaqs();
  updateAdminUI();
  $("admin-pw").value = "";
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  state.password = "";
  state.isAdmin = false;
  $("admin-modal").hidden = true;
  $("admin-login").hidden = false;
  $("admin-panel").hidden = true;
  renderFaqs();
  updateAdminUI();
}

function updateAdminUI() {
  const toggle = $("admin-toggle");
  if (state.isAdmin) {
    toggle.classList.add("active");
    toggle.title = "管理メニューを開く";
  } else {
    toggle.classList.remove("active");
    toggle.title = "管理者ログイン";
  }
}

async function saveData(commitMessage) {
  if (!state.password) {
    alert("ログインが切れています。再ログインしてください。");
    logout();
    return false;
  }
  $("save-status").hidden = false;
  $("save-status").textContent = "保存中...";

  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      password: state.password,
      faqs: state.faqs,
      categories: state.categories,
      message: commitMessage,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    $("save-status").textContent = "保存に失敗: " + (err.error || res.status);
    return false;
  }
  $("save-status").textContent = "保存しました（数秒で反映）";
  renderCategories();
  renderFaqs();
  renderCatList();
  return true;
}

function startEdit(id) {
  const f = state.faqs.find((x) => x.id === id);
  if (!f) return;
  state.editingId = id;
  $("admin-modal").hidden = false;
  $("admin-login").hidden = true;
  $("admin-panel").hidden = false;
  renderCategorySelect();
  $("f-category").value = f.category;
  $("f-question").value = f.question;
  $("f-answer").value = f.answer;
  $("save-btn").textContent = "更新して保存";
  $("form-mode").textContent = "FAQを編集中";
  $("form-mode").hidden = false;
  $("f-question").focus();
}

function cancelEdit() {
  state.editingId = null;
  $("faq-form").reset();
  renderCategorySelect();
  $("save-btn").textContent = "追加して保存";
  $("form-mode").hidden = true;
  $("save-status").hidden = true;
}

async function addFaq(e) {
  e.preventDefault();
  const question = $("f-question").value.trim();
  const answer = $("f-answer").value.trim();
  const category = $("f-category").value;
  if (!question || !answer) return;

  $("save-btn").disabled = true;
  let ok = false;
  if (state.editingId) {
    const idx = state.faqs.findIndex((x) => x.id === state.editingId);
    if (idx === -1) { $("save-btn").disabled = false; return; }
    const before = state.faqs[idx];
    state.faqs[idx] = { ...before, category, question, answer, updatedAt: new Date().toISOString() };
    ok = await saveData("FAQ編集: " + question.slice(0, 40));
    if (!ok) state.faqs[idx] = before;
    else cancelEdit();
  } else {
    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      category, question, answer,
      createdAt: new Date().toISOString(),
    };
    state.faqs.unshift(item);
    ok = await saveData("FAQ追加: " + question.slice(0, 40));
    if (ok) {
      $("f-question").value = "";
      $("f-answer").value = "";
    } else {
      state.faqs.shift();
    }
  }
  $("save-btn").disabled = false;
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

  // Restore session if present (only when ?admin in URL)
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (saved && location.search.includes("admin")) {
    state.password = saved;
    state.isAdmin = true;
    renderFaqs();
  }
  updateAdminUI();

  $("search").addEventListener("input", (e) => {
    state.search = e.target.value;
    renderFaqs();
  });

  $("admin-toggle").addEventListener("click", () => {
    $("admin-modal").hidden = false;
    if (state.isAdmin) {
      $("admin-login").hidden = true;
      $("admin-panel").hidden = false;
      renderCategorySelect();
      renderCatList();
      renderFaqs();
    }
  });
  const closeModal = () => {
    $("admin-modal").hidden = true;
    if (state.editingId) cancelEdit();
  };
  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
  $("admin-modal").addEventListener("click", (e) => {
    if (e.target.id === "admin-modal") closeModal();
  });
  $("admin-login-btn").addEventListener("click", adminLogin);
  $("admin-pw").addEventListener("keydown", (e) => { if (e.key === "Enter") adminLogin(); });
  $("faq-form").addEventListener("submit", addFaq);
  $("add-cat-btn").addEventListener("click", addCategory);

  if (location.search.includes("admin")) {
    $("admin-toggle").hidden = false;
  }
});
