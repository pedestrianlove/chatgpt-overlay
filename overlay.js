// Create a Shadow DOM to avoid touching page styles/DOM.
const root = document.createElement("div");
root.style.all = "initial";
root.style.position = "fixed";
root.style.bottom = "16px";
root.style.right = "16px";
root.style.zIndex = "2147483647"; // top
root.style.fontFamily = "system-ui, sans-serif";
root.style.fontSize = "12px";
root.attachShadow({ mode: "open" });

root.shadowRoot.innerHTML = `
  <style>
    .panel { background: white; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 6px 30px rgba(0,0,0,.15); width: 320px; }
    header { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid #f1f5f9; }
    header .title { font-weight:600; }
    header button { border:none; background:#f3f4f6; border-radius:6px; padding:4px 8px; cursor:pointer; }
    .list { max-height: 320px; overflow:auto; }
    .item { padding:8px 10px; border-bottom:1px solid #f8fafc; }
    .xrow { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .url { color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .badge { font-size:10px; border-radius:999px; padding:2px 6px; }
    .idle { background:#f3f4f6; }
    .waiting { background:#fde68a; }
    .updating { background:#bfdbfe; }
    .ready { background:#bbf7d0; }
    .controls { display:flex; gap:6px; margin-top:6px; }
    .controls button { border:none; background:#eef2ff; padding:4px 6px; border-radius:6px; cursor:pointer; }
    .toggle { position: absolute; right: 0; top: -30px; background:#111827; color:#fff; border-radius:8px 8px 0 0; padding:4px 8px; cursor:pointer; font-size:11px; }
    .muted { opacity:.6 }
  </style>
  <div class="toggle">Chats</div>
  <div class="panel">
    <header>
      <div class="title">Chat statuses</div>
      <button id="mark">I asked → waiting</button>
    </header>
    <div class="list" id="list"></div>
  </div>
`;

document.documentElement.appendChild(root);

const $ = (sel) => root.shadowRoot.querySelector(sel);

function fmtAgo(ms){
  if (!ms) return "—";
  const s = Math.max(0, Math.floor((Date.now() - ms)/1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s/60), r = s%60;
  return `${m}m ${r}s ago`;
}

function send(type, data={}) {
  return new Promise(resolve => chrome.runtime.sendMessage({ type, ...data }, resolve));
}

let selfTabId = null;
async function identifySelf(){
  const res = await send("WHOAMI");
  if (res?.ok) selfTabId = res.tabId;
}

async function render(){
  const res = await send("LIST_TABS");
  const list = $("#list");
  if (!res?.ok) return;
  list.innerHTML = "";
  res.tabs.forEach(t => {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="xrow">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; ${t.id===selfTabId?'':' '}">${(t.title||'(new chat)').replace(/</g,'&lt;')}</div>
          <div class="url">${t.url.replace(/^https?:\/\//,'')}</div>
        </div>
        <div class="badge ${t.status}">${t.status}</div>
      </div>
      <div class="controls">
        <button data-id="${t.id}" class="focus">Focus</button>
        <span class="muted">Last change: ${fmtAgo(t.lastTitleChange)}</span>
      </div>
    `;
    list.appendChild(el);
  });

  // Wire buttons
  list.querySelectorAll(".focus").forEach(btn => {
    btn.addEventListener("click", async e => {
      const tabId = Number(e.currentTarget.getAttribute("data-id"));
      await send("FOCUS_TAB", { tabId });
    });
  });
}

$("#mark").addEventListener("click", async () => {
  if (!selfTabId) await identifySelf();
  if (selfTabId) await send("MARK_WAITING", { tabId: selfTabId });
  await render();
});

// Toggle collapse
const panel = root.shadowRoot.querySelector(".panel");
const toggle = root.shadowRoot.querySelector(".toggle");
let open = true;
toggle.addEventListener("click", () => {
  open = !open;
  panel.style.display = open ? "block" : "none";
  toggle.textContent = open ? "Chats" : "Chats ▸";
});

// Kick off
(async () => {
  await identifySelf();
  await render();
  setInterval(render, 2000); // metadata-only polling; no DOM scraping
})();
