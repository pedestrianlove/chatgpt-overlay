const CHAT_RE = /(?:chat\.openai\.com|chatgpt\.com)/;

// tabId -> { status: "idle"|"waiting"|"updating"|"ready", lastTitleChange, debounce, lastTitle }
const chatState = new Map();

function isChat(tab){ return tab?.url && CHAT_RE.test(tab.url); }
function ensure(tabId){
  if (!chatState.has(tabId)) chatState.set(tabId, { status:"idle", lastTitleChange:0, debounce:null, lastTitle:"" });
  return chatState.get(tabId);
}

async function listChatTabs(){
  const tabs = await chrome.tabs.query({});
  return tabs.filter(isChat).map(t => {
    const st = ensure(t.id);
    return { id:t.id, title:t.title || "(new chat)", url:t.url, windowId:t.windowId, status:st.status, lastTitleChange:st.lastTitleChange };
  });
}

async function focusTab(tabId){
  const t = await chrome.tabs.get(tabId);
  await chrome.windows.update(t.windowId, { focused: true });
  await chrome.tabs.update(tabId, { active: true });
}

// Heuristic: title changing ⇒ updating; stable for ~2s ⇒ ready
function markUpdatingThenReady(tabId, newTitle){
  const st = ensure(tabId);
  st.status = "updating";
  st.lastTitle = newTitle;
  st.lastTitleChange = Date.now();
  if (st.debounce) clearTimeout(st.debounce);
  st.debounce = setTimeout(() => {
    if (Date.now() - st.lastTitleChange >= 1800) {
      st.status = "ready";
      chrome.notifications.create(`chat-${tabId}-${Date.now()}`, {
        type: "basic",
        iconUrl: "icon128.png",
        title: "Chat likely finished",
        message: (newTitle || "Chat updated").slice(0, 120)
      });
    }
  }, 2000);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!isChat(tab)) return;
  if (typeof changeInfo.title === "string") markUpdatingThenReady(tabId, changeInfo.title);
});

chrome.tabs.onRemoved.addListener((tabId) => chatState.delete(tabId));

// Simple message API for popup/content scripts
chrome.runtime.onMessage.addListener((msg, sender, send) => {
  (async () => {
    if (msg.type === "LIST_TABS") {
      send({ ok:true, tabs: await listChatTabs() });
    } else if (msg.type === "FOCUS_TAB") {
      await focusTab(msg.tabId);
      send({ ok:true });
    } else if (msg.type === "MARK_WAITING") {
      const st = ensure(msg.tabId);
      st.status = "waiting";
      st.lastTitleChange = Date.now();
      send({ ok:true });
    } else if (msg.type === "WHOAMI") {
      // Give the content script its own tabId without reading the DOM
      send({ ok:true, tabId: sender.tab?.id || null });
    }
  })();
  return true;
});
