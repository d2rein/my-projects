window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "drein-groceries" || event.data?.type !== "coles-cart-request") return;
  chrome.runtime.sendMessage({ type: "coles-cart-request", items: event.data.items }, (response) => {
    window.postMessage({
      source: "coles-cart-helper",
      type: response?.ok ? "coles-cart-ready" : "coles-cart-error",
      error: response?.error || ""
    }, window.location.origin);
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (!["coles-cart-ready", "coles-cart-progress", "coles-cart-complete"].includes(message?.type)) return;
  window.postMessage({ source: "coles-cart-helper", ...message }, window.location.origin);
});
