# primal

A small personal app for a raw primal diet. Five sections:

- **Recipes** – a categorized, searchable recipe collection. Add your own, edit or delete any
  recipe, attach photos, and mark favourites.
- **Plan** – your daily meal plan as free-text blocks, one per meal. Tick a block when it is
  eaten; the ticks clear each new day and the text stays until you edit it.
- **Food** – a log of what you ate and when, with an optional amount (grams, or a count for eggs). Foods are picked from a list
  of what is common on Aajonus Vonderplanitz's raw primal diet plus every recipe ingredient.
  No calories, nutrients or macros.
- **Habits** – daily habits (sunlight, walking, …) to tick off, each with an emoji of your choice.
- **Weight** – body weight over time, with a chart.
- **Lists** – a to-do list and a to-buy list.
- **Notes** – free-text notes, shown with Markdown formatting (headings, bold, italics, dividers, lists).

Settings has six quiet colour themes; light and dark follow the device.

## Running it

It is a plain website: no build step and no dependencies. Serve the folder with any static
web server, for example:

```
python3 -m http.server 8000
```

then open <http://localhost:8000>. Hosted on GitHub Pages (or any HTTPS host) it also works
offline and can be added to a phone's home screen.

## Android app

The newest APK is always at
<https://github.com/RotFarmer/Cook-book/releases/latest/download/primal-cookbook.apk>.
Install it once; after that the app offers its own updates. See `android/README.md`.

## Where entries are kept

Entries stay in the browser they were typed into (`localStorage`). **Settings → Copy backup**
gives one block of text holding everything, and **Restore from backup** puts it back, which is
also how to move entries to another device.

When the page is published as a Claude artifact, entries are instead kept in the signed-in
person's private store, so every device shows the same thing.

## Layout

```
index.html            page shell
css/styles.css        all styling (light and dark)
js/app.js             start-up, tabs, settings
js/store.js           saving and loading
js/util.js            small shared helpers
js/views/*.js         one file per section
js/data/foods.js      the food list for the food log
js/data/recipes.js    built-in recipes
sw.js                 offline cache
js/update.js          update check for the Android app
js/unlock.js          opens the locked recipe collection
js/metric.js          rewrites ounces and pounds in recipes as grams
js/markdown.js        Markdown rendering for notes
js/data/recipes.pack.js  the recipe collection, locked (made by tools/pack-recipes.mjs)
js/data/corrections.js   corrections applied once to collections already stored
android/              the Android shell and its build
```

To add or change built-in recipes, edit `js/data/recipes.js`; the format is described at the
top of that file. The recipe collection taken from books ships in locked form
(`js/data/recipes.pack.js`) and is opened once per device with the owner's code; after that it
is kept with the rest of your entries and travels with backups. To change the food list, edit `js/data/foods.js`.
