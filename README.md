# Korenvliet (web)

*Korenvliet*, a TADS 3 (adv3) text adventure by Alexander van Oostenrijk,
playing in the browser on [tads3js](../tads3js), with a picture of each
location. The game's source was copied from `../korenvliet` (version 1.2).

## Layout

```
src/                the game (TADS 3); ui.t and debug.t are the additions:
  ui.t              <x-ui image=... room=...> before each prompt (the picture)
  debug.t           debugging verbs (debug builds only): FETCH, TELEPORT/GOTO
korenvliet.t3m      t3make makefile (korenvliet-debug.t3m: debug build)
ui/                 the page's scripts (TypeScript): ModernUI.ts, main.ts
web/                the site: index.html, modern.css, images/, plus the built
                    korenvliet.js, tads3js-worker.js, korenvliet.t3, images.json
tools/              build.js, serve.js, test.js
```

## Building and playing

Needs the TADS 3 author's kit (t3make; set `T3MAKE` if it isn't in
`C:/Program Files (x86)/TADS 3`), and tads3js next to this directory (built).

```
npm install
npm run build        # compile the game, list the pictures, bundle the page into web/
npm run build:debug  # the same with the debug build (FETCH, TELEPORT/GOTO)
npm run serve        # http://localhost:8083/
npm test             # play tests/walkthrough.in on tads3js, compare with tests/walkthrough.out
node tools/test.js --record    # record the transcript with the reference interpreter (t3run)
```

## Pictures

Each room's picture key is its object name in the source (`mainStreet`,
`foyer`, `sewerFork`, ...). Put the picture in `web/images/<key>.jpg` (or
`.png`, `.webp`, `.avif`, `.gif`, `.svg`) and run the build again; it lists
the pictures in `web/images.json`. Rooms without a picture show a
placeholder with the file name it expects. `TELEPORT` in the debug build
lists all rooms and their keys.

A room can choose another picture, also depending on the game state, with
`roomImage` (see `src/ui.t`):

```
roomImage = (panelledDoorOutside.isOpen ? 'foyer-open' : 'foyer')
roomImage = 'sewer'     // several rooms sharing a picture
roomImage = nil         // no picture
```

## Publishing

Copy `web/` to any static web host. With cross-origin isolation headers
(COOP/COEP) the game runs in a Web Worker, otherwise on the page itself
(which works anywhere, including itch.io). Saved games are kept in the
browser (IndexedDB) and can be downloaded and loaded from files.

## License

GPL 3.0 (see LICENSE).
