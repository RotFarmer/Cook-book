# Primal Cookbook

A small personal app for a raw primal diet. Five sections:

- **Recipes** – a categorized recipe collection, searchable, with favourites and your own additions.
- **Plan** – your meal plan for each day of the week.
- **Food** – a log of what you ate and when. Foods are picked from a list of what is common on
  Aajonus Vonderplanitz's raw primal diet. No calories, nutrients or macros.
- **Habits** – daily habits (sunlight, walking, …) to tick off.
- **Weight** – body weight over time, with a chart.

## Running it

It is a plain website: no build step and no dependencies. Serve the folder with any static
web server, for example:

```
python3 -m http.server 8000
```

then open <http://localhost:8000>. Hosted on GitHub Pages (or any HTTPS host) it also works
offline and can be added to a phone's home screen.

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
```

To add or change built-in recipes, edit `js/data/recipes.js`; the format is described at the
top of that file. Recipes imported from your own books are kept with your private entries
instead of in this repository, and travel with backups. To change the food list, edit `js/data/foods.js`.
