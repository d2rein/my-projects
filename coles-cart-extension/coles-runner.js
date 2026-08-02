function priceFromPage() {
  const meta = document.querySelector('meta[property="product:price:amount"], meta[itemprop="price"]');
  const structured = document.querySelector('[itemprop="price"]');
  const candidates = [
    meta?.content,
    structured?.getAttribute("content"),
    ...Array.from(document.querySelectorAll('[data-testid*="price" i], [class*="price" i]'))
      .slice(0, 12)
      .map((node) => node.textContent)
  ].filter(Boolean);
  for (const candidate of candidates) {
    const match = String(candidate).replace(/,/g, "").match(/\$(\d+(?:\.\d{1,2})?)/);
    if (match) return { price: Number(match[1]), priceText: "$" + Number(match[1]).toFixed(2) };
  }
  return { price: null, priceText: "" };
}

function panel() {
  let node = document.getElementById("drein-coles-cart-panel");
  if (node) return node;
  node = document.createElement("aside");
  node.id = "drein-coles-cart-panel";
  Object.assign(node.style, {
    position: "fixed", right: "16px", bottom: "16px", zIndex: "2147483647", width: "300px",
    padding: "14px", border: "2px solid #315b39", borderRadius: "12px", background: "#fffdf5",
    color: "#1f2a20", boxShadow: "0 12px 34px rgba(0,0,0,.25)", fontFamily: "Arial,sans-serif", display: "grid", gap: "8px"
  });
  document.documentElement.append(node);
  return node;
}

function primaryButton(label, click) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  Object.assign(button.style, { border: 0, borderRadius: "8px", padding: "10px", background: "#f4c842", color: "#332600", fontWeight: "700", cursor: "pointer" });
  button.addEventListener("click", click);
  return button;
}

function secondaryButton(label, click) {
  const button = primaryButton(label, click);
  Object.assign(button.style, { background: "#ece8dc", color: "#354034" });
  return button;
}

function showLoginPanel() {
  const node = panel();
  node.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = "Guided Coles shop";
  const message = document.createElement("span");
  message.textContent = "Log in if needed. You will add each product yourself, then choose the next item.";
  node.append(title, message, primaryButton("Start guided shopping", () => {
    node.remove();
    chrome.runtime.sendMessage({ type: "coles-start-guided" });
  }));
}

function showGuidedItem(message) {
  const node = panel();
  node.replaceChildren();
  const heading = document.createElement("strong");
  heading.textContent = `${message.currentIndex + 1} of ${message.total}: ${message.item.name}`;
  const quantity = document.createElement("span");
  quantity.textContent = `Add ${message.item.quantity} to your trolley, handling any Coles offers or substitutions yourself.`;
  const price = priceFromPage();
  const priceNote = document.createElement("small");
  priceNote.textContent = price.priceText ? `Observed shelf price: ${price.priceText}` : "Price could not be read automatically on this page.";
  node.append(heading, quantity, priceNote);
  node.append(primaryButton("Added - next item", () => {
    node.remove();
    chrome.runtime.sendMessage({ type: "coles-guided-next", ...priceFromPage() });
  }));
  node.append(secondaryButton("Skip this item", () => {
    node.remove();
    chrome.runtime.sendMessage({ type: "coles-guided-skip", ...priceFromPage() });
  }));
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "coles-awaiting-login") showLoginPanel();
  if (message?.type === "coles-guided-current") showGuidedItem(message);
});

chrome.runtime.sendMessage({ type: "coles-page-ready" });
