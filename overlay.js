// Create a Shadow DOM to avoid touching page styles/DOM.
let selfTabId = null;
async function identifySelf(){
const res = await send("WHOAMI");
if (res?.ok) selfTabId = res.tabId;
}


function isBusy(status){
return status === "waiting" || status === "updating";
}


async function render(){
const res = await send("LIST_TABS");
const list = $("#list");
if (!res?.ok) return;
list.innerHTML = "";


res.tabs.forEach(t => {
const busy = isBusy(t.status);
const el = document.createElement("div");
el.className = "item";
el.innerHTML = `
<div class="xrow">
<div class="left">
${busy ? '<div class="spinner" aria-label="In progress"></div>' : ''}
<div style="flex:1; min-width:0;">
<div class="title">${(t.title||'(new chat)').replace(/</g,'&lt;')}</div>
<div class="url">${t.url.replace(/^https?:\/\//,'')}</div>
</div>
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
