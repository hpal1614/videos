document.getElementById("toggle").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggle" });
  } catch (e) {
    // content script not present (e.g. chrome:// page or it loaded before nav)
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["bot-core.js", "content.js"] })
      .then(() => chrome.tabs.sendMessage(tab.id, { type: "toggle" }))
      .catch(() => alert("Can't run here. Open the actual game page (http/https) and try again."));
  }
  window.close();
});
