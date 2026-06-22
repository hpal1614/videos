// Forwards the keyboard command to the active tab's content script.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-bot") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggle" });
  } catch (e) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await chrome.tabs.sendMessage(tab.id, { type: "toggle" });
    } catch (_) { /* unsupported page */ }
  }
});
