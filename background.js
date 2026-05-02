chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_TEXT') {
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      func: () => {
        const clone = document.cloneNode(true);
        ['script','style','nav','footer','header','aside','noscript'].forEach(tag => {
          clone.querySelectorAll(tag).forEach(el => el.remove());
        });
        const text = clone.body?.innerText || document.body.innerText;
        return text.replace(/\s+/g, ' ').trim().slice(0, 12000);
      }
    }).then(([result]) => {
      sendResponse({ success: true, text: result.result });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
});