window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "drein-groceries" || event.data?.type !== "coles-cart-request") return;
  try {
    chrome.runtime.sendMessage({ type: "coles-cart-request", items: event.data.items }, (response) => {
      try {
        const error = chrome.runtime.lastError?.message || response?.error || "";
        window.postMessage({
          source: "coles-cart-helper",
          type: response?.ok ? "coles-cart-ready" : "coles-cart-error",
          error
        }, window.location.origin);
      } catch (error) {
        window.postMessage({
          source: "coles-cart-helper",
          type: "coles-cart-error",
          error: "The Coles helper was reloaded. Refresh this grocery page, then try again."
        }, window.location.origin);
      }
    });
  } catch (error) {
    // Chrome invalidates existing content scripts after an extension reload.
    window.postMessage({
      source: "coles-cart-helper",
      type: "coles-cart-error",
      error: "The Coles helper was reloaded. Refresh this grocery page, then try again."
    }, window.location.origin);
  }
});

try {
  chrome.runtime.onMessage.addListener((message) => {
    if (!["coles-cart-ready", "coles-cart-progress", "coles-cart-complete"].includes(message?.type)) return;
    window.postMessage({ source: "coles-cart-helper", ...message }, window.location.origin);
  });
} catch (error) {
  // Chrome removes this listener with the old extension context during a reload.
}
