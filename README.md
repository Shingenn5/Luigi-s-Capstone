# Luigi's Pizzeria — frontend starter

A small pizza restaurant demo built with **HTML, Bootstrap 5.3.8, and plain JavaScript**. Zero custom CSS. No backend, database, package installation, or build step.

## Start hand coding

- `index.html`: all page sections and menu cards. Change text and Bootstrap classes here.
- `js/app.js`: menu filters and the in-memory demo order panel. JavaScript uses camelCase.
- `menu.html` and `js/menu.js`: pizza size, proposed toppings, quantity, service type, and an in-memory order review. Sample base subtotals exclude unconfirmed topping prices and tax; this preview does not submit orders.
- `assets/pizza.jpg`: sample hero photograph. Replace with restaurant-owned photography later.

Open `index.html` in your browser to preview locally. Refresh after edits. A local static preview extension in your editor works too.

Menu prices are sample USD prices. Each add button's `data-price` is in cents; update both that value and the visible price when editing an item. `data-item` must be unique. Category values connect the filter buttons to the cards.

The order panel supports adding items, calculating a subtotal, and clearing the order. Selections reset on reload. It never places an order or collects payment. Real contact details, opening hours, and restaurant history are intentionally left as clearly marked placeholders.

All pages share `assets/bootswatch-simplex.min.css`: the unmodified Bootswatch Simplex 5.3.8 theme, which includes Bootstrap CSS. Use this one stylesheet on new pages too; do not also load the default Bootstrap CSS. The bundled Bootstrap JavaScript is also 5.3.8. Simplex keeps the red-and-white look without custom CSS. Its optional Open Sans font loads from Google Fonts, with local font fallbacks when offline. All asset paths are relative so the frontend works under a GitHub Pages repository URL.

## GitHub Pages hosting

Publish the `main` branch from `/ (root)` in **Settings → Pages → Build and deployment → Deploy from a branch**. Enable **Enforce HTTPS**. The `.nojekyll` file tells Pages to serve this as plain static files.

Project URL: https://shingenn5.github.io/Luigi-s-Capstone/

GitHub Pages hosts this frontend. Node.js and SQL remain planned for a later phase; Pages cannot run either as a backend. See [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Suggested next edits

1. Replace the sample menu with the restaurant's real menu.
2. Fill in confirmed address, phone, hours, and story.
3. Extend one frontend interaction at a time.

## Photo source

Sample image downloaded from [Unsplash's image endpoint](https://images.unsplash.com/photo-1513104890138-7c749659a591). It is illustrative and does not depict this restaurant's actual food.
