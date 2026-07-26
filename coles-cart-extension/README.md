# Drein Grocery Coles Cart Helper

This is a local Chrome or Edge extension. It opens Coles, waits for login if needed, and adds the mapped items from the selected weekly grocery list. It never visits checkout or makes a purchase.

## Install for testing

1. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `coles-cart-extension` folder inside the site repository.
5. Go to `https://drein.net/groceries`, select Bread, then use **Add mapped items to Coles cart** on the Shopping list tab.

The extension opens Coles in a new tab. If Coles displays its login option, log in and use the extension's **Continue to trolley** button. When every mapped product for an item succeeds, the original grocery item turns yellow; tap it in the grocery list to confirm it and turn it green.

Coles can change its page controls. Any product that cannot be added is deliberately left unhighlighted in the grocery planner so it is easy to find and replace manually.
