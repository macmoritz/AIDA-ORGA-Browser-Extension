async function registerScript(event) {
  event.preventDefault();
  const data = new FormData(event.target);

  let targetUrl = data.get("targetUrl");

  const granted = await chrome.permissions.request({ origins: [targetUrl] });
  if (!granted) {
    return;
  }

  browser.storage.sync.set({
    targetUrl: targetUrl,
  });

  let contentScripts = await chrome.scripting.getRegisteredContentScripts({
    ids: ["aidaFinishingTime"],
  });

  if (contentScripts.length > 0) {
    await chrome.scripting.unregisterContentScripts({
      ids: ["aidaFinishingTime"],
    });
  }

  await chrome.scripting.registerContentScripts([
    {
      id: "aidaFinishingTime",
      matches: [targetUrl],
      js: ["scripts/aida.js"],
      runAt: "document_idle",
    },
  ]);
}

function restoreOptions() {
  function setTargetUrl(result) {
    document.getElementById("targetUrl").value = result.targetUrl || "";
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  let settings = browser.storage.sync.get("targetUrl");
  settings.then(setTargetUrl, onError);

  const form = document.getElementById("form");
  form.addEventListener("submit", registerScript);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
