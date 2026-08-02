# Drein Grocery Coles Cart Helper

This is a local Chrome or Edge extension. It opens mapped Coles products one at a time, waits for you to add them yourself, and never visits checkout or makes a purchase.

## Install for testing

1. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `coles-cart-extension` folder inside the site repository.
5. Go to `https://drein.net/groceries`, select Bread, then use **Shop mapped items at Coles** on the Shopping list tab.

The extension opens Coles in a new tab. If Coles displays its login option, log in and choose **Start guided shopping**. It shows the current item and usual quantity, while preloading up to two later product pages. Add the product and handle any Coles offers yourself, then choose **Added - next item**. Press the spacebar for the same next-item action when you are not typing in a Coles control. When every mapped product for a grocery-list item is confirmed, that item turns yellow; tap it in the grocery list to confirm it and turn it green.

The extension records a visible shelf price after each confirmation and sends it to the grocery planner immediately. The shopping list displays the latest planned Coles estimate where a price has been captured. Prices are observed shelf prices, not a checkout total.

Coles can change its page controls. Any product that cannot be added is deliberately left unhighlighted in the grocery planner so it is easy to find and replace manually.
