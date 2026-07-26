const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function buttonByText(pattern) {
  return Array.from(document.querySelectorAll("button")).find((button) => !button.disabled && pattern.test(button.textContent.trim()));
}

async function waitFor(getValue, timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = getValue();
    if (value) return value;
    await sleep(250);
  }
  return null;
}

function findAddButton() {
  return buttonByText(/^add to trolley$/i) || buttonByText(/^add$/i);
}

function findIncreaseButton() {
  return document.querySelector('[aria-label*="increase quantity" i], [aria-label*="add one" i], [data-testid*="increment" i]') ||
    Array.from(document.querySelectorAll("button")).find((button) => !button.disabled && button.textContent.trim() === "+");
}

async function addCurrentProduct(item) {
  const unavailable = /currently unavailable|out of stock/i.test(document.body.innerText);
  if (unavailable) return { ok: false, error: "This product is unavailable." };

  const addButton = await waitFor(findAddButton);
  if (!addButton) return { ok: false, error: "Could not find Coles' Add to trolley button." };
  addButton.click();
  await sleep(800);

  for (let count = 1; count < item.quantity; count += 1) {
    const increaseButton = await waitFor(findIncreaseButton, 5000);
    if (!increaseButton) return { ok: false, error: "Added one, but could not increase the trolley quantity to " + item.quantity + "." };
    increaseButton.click();
    await sleep(500);
  }
  return { ok: true };
}

function showLoginPanel() {
  if (document.getElementById("drein-coles-cart-panel")) return;
  const panel = document.createElement("div");
  panel.id = "drein-coles-cart-panel";
  panel.innerHTML = "<strong>Grocery list ready</strong><span>Log in to Coles if needed, then continue adding your mapped items.</span><button type=\"button\">Continue to trolley</button>";
  Object.assign(panel.style, { position:"fixed", right:"16px", bottom:"16px", zIndex:"2147483647", width:"280px", padding:"14px", border:"2px solid #315b39", borderRadius:"12px", background:"#fffdf5", color:"#1f2a20", boxShadow:"0 12px 34px rgba(0,0,0,.25)", fontFamily:"Arial,sans-serif", display:"grid", gap:"8px" });
  const button = panel.querySelector("button");
  Object.assign(button.style, { border:0, borderRadius:"8px", padding:"10px", background:"#f4c842", color:"#332600", fontWeight:"700", cursor:"pointer" });
  button.addEventListener("click", () => {
    panel.remove();
    chrome.runtime.sendMessage({ type: "coles-start" });
  });
  document.documentElement.append(panel);
}

function pageShowsLogin() {
  return /log in\s*\/\s*sign up/i.test(document.body.innerText);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "coles-awaiting-login") {
    if (pageShowsLogin()) showLoginPanel();
    else chrome.runtime.sendMessage({ type: "coles-start" });
    return;
  }
  if (message?.type === "coles-add-current") {
    addCurrentProduct(message.item)
      .then((result) => chrome.runtime.sendMessage({ type: "coles-product-result", url: message.item.url, ...result }))
      .catch((error) => chrome.runtime.sendMessage({ type: "coles-product-result", url: message.item.url, ok:false, error:error.message }));
  }
});

chrome.runtime.sendMessage({ type: "coles-page-ready" });
