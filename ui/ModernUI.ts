/**
 * A modern presentation for a TADS 3 game in tads3js: the location's
 * picture, a status bar (location, score and turns), the story text and a command
 * line; a menu for saving, restoring and settings. Responsive: picture beside
 * the story on wide screens, above it on narrow ones.
 *
 * The game supplies the picture in an <x-ui image="..."> tag before each
 * prompt (see src/ui.t); the location, score and turns come from the status line.
 */

import { GameClient, keyName } from 'tads3js/src/web/client';
import { showFileDialog } from 'tads3js/src/web/FileDialog';

/** About the game (for the About box). */
export interface GameInfo {
  title: string;
  byline: string;
  version?: string;
  blurb?: string;
}

const HELP_HTML = `
  <p>You play by typing commands telling your character what to do, and pressing
  Enter. Commands are usually a verb and a thing:</p>
  <ul>
    <li><kbd>look</kbd> (<kbd>l</kbd>) &ndash; describe your surroundings again</li>
    <li><kbd>examine table</kbd> (<kbd>x table</kbd>) &ndash; look closely at something</li>
    <li><kbd>take letter</kbd>, <kbd>read letter</kbd>, <kbd>drop letter</kbd>, <kbd>inventory</kbd> (<kbd>i</kbd>)</li>
    <li><kbd>open door</kbd>, <kbd>put letter in basket</kbd></li>
    <li><kbd>north</kbd> (<kbd>n</kbd>), <kbd>southwest</kbd> (<kbd>sw</kbd>), <kbd>up</kbd>, <kbd>down</kbd>,
      <kbd>in</kbd>, <kbd>out</kbd> &ndash; go somewhere</li>
    <li><kbd>score</kbd>, <kbd>about</kbd>, <kbd>credits</kbd></li>
    <li><kbd>wait</kbd> (<kbd>z</kbd>), <kbd>undo</kbd>, <kbd>again</kbd> (<kbd>g</kbd>)</li>
    <li><kbd>pictures off</kbd>, <kbd>pictures on</kbd> &ndash; hide or show the pictures
      (<kbd>picture</kbd>, <kbd>image</kbd> and <kbd>illustration</kbd> work too)</li>
  </ul>
  <p>The up and down arrow keys bring back earlier commands. Your games are saved in this
  browser; you can also download a copy, and load it again later.</p>`;

type Theme = 'paper' | 'light' | 'dark';

export class ModernUI {
  private client: GameClient;
  private root: HTMLElement;
  private storyEl!: HTMLElement;
  private logEl!: HTMLElement;
  private inputEl!: HTMLInputElement;
  private formEl!: HTMLFormElement;
  private sceneEl!: HTMLElement;
  private locationEl!: HTMLElement;
  private timeEl!: HTMLElement;
  private menuEl!: HTMLElement;
  private menuButton!: HTMLButtonElement;

  /** Game text not shown yet (shown at the next prompt or request). */
  private pendingText = '';
  private history: string[] = [];
  private historyPos = 0;
  /** Commands entered while the game was busy (sent when it's ready). */
  private typedAhead: string[] = [];
  /** The echo of the last command (scrolled to the top of the story when its response comes). */
  private lastEcho: HTMLElement | null = null;
  /** The picture shown, and the one the game asks for (shown when pictures are on). */
  private image = '';
  private gameImage = '';
  private touch = matchMedia('(pointer: coarse)').matches;

  /**
   * pictures: picture key (from the game's <x-ui image=...>) -> URL; keys
   * without a picture get a placeholder.
   */
  constructor(root: HTMLElement, private info: GameInfo, private pictures: Record<string, string> = {},
              workerURL = 'tads3js-worker.js') {
    this.root = root;
    this.build();
    this.applySettings();
    this.client = new GameClient(workerURL, {
      output: (text) => { this.pendingText += text; },
      status: (left, right) => {
        this.locationEl.textContent = left;
        this.timeEl.textContent = right;
      },
      clear: () => {
        this.pendingText = '';
        this.logEl.innerHTML = '';
      },
      tag: (name, attrs) => {
        if(name == 'x-ui' && attrs.image !== undefined) {
          this.gameImage = this.pictureURL(attrs.image, attrs.room || '');
          this.showImage(this.picturesOn() ? this.gameImage : '');
        }
      },
      inputLine: () => this.readyForCommand(),
      inputKey: () => this.waitForKey('Press any key to continue'),
      more: () => this.waitForKey('Continue'),
      askFile: (prompt, save, fileType) => {
        this.flushText(true);
        showFileDialog(this.client, prompt.replace(/\s*>?\s*$/, ''), save, fileType, () => this.focusInput());
      },
      end: (error) => this.gameOver(error),
    });
  }

  async start(image: Uint8Array, name: string) {
    await this.client.start(image, name);
  }

  // ---------------------------------------------------------------------------
  // The page

  private build() {
    this.root.innerHTML = `
      <div class="app">
        <header class="topbar">
          <button class="icon-button menu-button" aria-label="Menu" aria-haspopup="true" aria-expanded="false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <div class="status">
            <span class="location"></span>
            <span class="time"></span>
          </div>
        </header>
        <nav class="menu" hidden>
          <button data-action="save">Save</button>
          <button data-action="restore">Restore</button>
          <button data-action="undo">Undo</button>
          <button data-action="restart">Restart</button>
          <div class="menu-separator"></div>
          <div class="menu-row">
            <span>Text size</span>
            <span class="menu-choices">
              <button data-action="smaller" aria-label="Smaller text">A&minus;</button>
              <button data-action="larger" aria-label="Larger text">A+</button>
            </span>
          </div>
          <div class="menu-row">
            <span>Theme</span>
            <span class="menu-choices">
              <button data-theme="paper">Paper</button>
              <button data-theme="light">Light</button>
              <button data-theme="dark">Dark</button>
            </span>
          </div>
          <div class="menu-separator"></div>
          <button data-action="help">How to play</button>
          <button data-action="about">About</button>
        </nav>
        <figure class="scene" hidden>
          <div class="picture"></div>
        </figure>
        <main class="story">
          <div class="log" aria-live="polite"></div>
          <form class="command" autocomplete="off">
            <span class="prompt" aria-hidden="true">&rsaquo;</span>
            <input type="text" aria-label="Command" placeholder="What do you do?"
                   autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send">
          </form>
        </main>
      </div>
      <dialog class="info-dialog">
        <form method="dialog">
          <div class="info-body"></div>
          <p class="info-buttons"><button>Close</button></p>
        </form>
      </dialog>`;

    const $ = <T extends HTMLElement>(sel: string) => this.root.querySelector(sel) as T;
    this.storyEl = $('.story');
    this.logEl = $('.log');
    this.formEl = $('.command');
    this.inputEl = $('.command input');
    this.sceneEl = $('.scene');
    this.locationEl = $('.location');
    this.timeEl = $('.time');
    this.menuEl = $('.menu');
    this.menuButton = $('.menu-button');
    if(!this.touch) this.inputEl.focus();

    this.formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const line = this.inputEl.value;
      this.inputEl.value = '';
      this.command(line);
    });
    this.inputEl.addEventListener('keydown', (e) => {
      if(e.key != 'ArrowUp' && e.key != 'ArrowDown') return;
      e.preventDefault();
      this.historyPos = Math.max(0, Math.min(this.history.length, this.historyPos + (e.key == 'ArrowUp' ? -1 : 1)));
      this.inputEl.value = this.history[this.historyPos] ?? '';
    });

    // Keys for "press any key" and "continue".
    document.addEventListener('keydown', (e) => {
      if(document.querySelector('dialog[open]') || e.ctrlKey || e.altKey || e.metaKey) return;
      if(this.client.waiting == 'more' || this.client.waiting == 'key') {
        const key = this.client.waiting == 'more' ? ' ' : keyName(e);
        if(key === undefined) return;
        e.preventDefault();
        this.continueAfterKey(key);
      } else if(e.key == 'Escape') {
        this.closeMenu();
      }
    });

    // Clicking the story puts the cursor on the command line (not on phones:
    // that would pop up the keyboard).
    this.storyEl.addEventListener('click', (e) => {
      if(this.client.waiting == 'more' || this.client.waiting == 'key') { this.continueAfterKey(' '); return; }
      if(!this.touch && !window.getSelection()?.toString() && !(e.target as HTMLElement).closest('button, a'))
        this.inputEl.focus();
    });

    // The menu
    this.menuButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if(this.menuEl.hidden) this.openMenu(); else this.closeMenu();
    });
    document.addEventListener('click', (e) => {
      if(!this.menuEl.hidden && !this.menuEl.contains(e.target as Node)) this.closeMenu();
    });
    this.menuEl.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('button');
      if(!button) return;
      if(button.dataset.theme) {
        this.setSetting('theme', button.dataset.theme);
        return;
      }
      switch(button.dataset.action) {
        case 'save': case 'restore': case 'undo': case 'restart':
          this.closeMenu();
          this.command(button.dataset.action);
          break;
        case 'smaller': case 'larger': {
          const size = this.textSize() + (button.dataset.action == 'larger' ? 1 : -1);
          this.setSetting('textSize', String(Math.max(-3, Math.min(5, size))));
          break;
        }
        case 'help':
          this.closeMenu();
          this.showInfo(`<h2>How to play</h2>${HELP_HTML}`);
          break;
        case 'about':
          this.closeMenu();
          this.showInfo(this.aboutHTML());
          break;
      }
    });
  }

  private openMenu() {
    this.menuEl.hidden = false;
    this.menuButton.setAttribute('aria-expanded', 'true');
    (this.menuEl.querySelector('button') as HTMLButtonElement).focus();
  }

  private closeMenu() {
    if(this.menuEl.hidden) return;
    this.menuEl.hidden = true;
    this.menuButton.setAttribute('aria-expanded', 'false');
    this.focusInput();
  }

  private showInfo(html: string) {
    const dialog = this.root.querySelector('.info-dialog') as HTMLDialogElement;
    (dialog.querySelector('.info-body') as HTMLElement).innerHTML = html;
    dialog.onclose = () => this.focusInput();
    dialog.showModal();
  }

  private aboutHTML(): string {
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    return `<h2>${esc(this.info.title)}</h2>
      <p class="byline">${esc(this.info.byline)}${this.info.version ? ` &middot; version ${esc(this.info.version)}` : ''}</p>
      ${this.info.blurb ? `<p>${esc(this.info.blurb)}</p>` : ''}
      <p class="small">Written in TADS 3; playing in tads3js, a TADS 3 interpreter for the web.</p>`;
  }

  // Settings (kept in the browser)

  private setting(name: string, fallback: string): string {
    try { return localStorage.getItem('tads3js.' + name) ?? fallback; } catch(e) { return fallback; }
  }

  private setSetting(name: string, value: string) {
    try { localStorage.setItem('tads3js.' + name, value); } catch(e) { /* (private mode) */ }
    this.applySettings();
  }

  private textSize(): number {
    return parseInt(this.setting('textSize', '0')) || 0;
  }

  private picturesOn(): boolean {
    return this.setting('pictures', 'on') != 'off';
  }

  private applySettings() {
    let theme = this.setting('theme', 'paper') as Theme;
    if(!['paper', 'light', 'dark'].includes(theme)) theme = 'paper';
    if(theme == 'paper') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = theme;
    this.menuEl.querySelectorAll('[data-theme]').forEach((b) =>
      b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.theme == theme)));
    document.documentElement.style.setProperty('--text-step', String(this.textSize()));
    this.showImage(this.picturesOn() ? this.gameImage : '');
  }

  // ---------------------------------------------------------------------------
  // The picture

  /** The URL of a picture by its key: the picture, a placeholder, or '' for none. */
  private pictureURL(key: string, room: string): string {
    if(!key) return '';
    return this.pictures[key] ?? placeholder(key, room);
  }

  /** Show a location's picture (cross-fading from the last one). */
  private showImage(src: string) {
    if(src == this.image) return;
    this.image = src;
    const picture = this.sceneEl.querySelector('.picture') as HTMLElement;
    // (Without a picture, the story takes the whole width.)
    this.sceneEl.hidden = !src;
    this.root.querySelector('.app')!.classList.toggle('no-scene', !src);
    if(!src) {
      picture.innerHTML = '';
      return;
    }
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.onload = () => {
      if(this.image != src) return;
      // (Pictures may have different shapes.)
      if(img.naturalWidth && img.naturalHeight)
        document.documentElement.style.setProperty('--ratio', String(img.naturalWidth / img.naturalHeight));
      picture.appendChild(img);
      requestAnimationFrame(() => img.classList.add('shown'));
      // Drop the old pictures once the new one has faded in.
      setTimeout(() => {
        picture.querySelectorAll('img').forEach((old) => { if(old !== img) old.remove(); });
      }, 600);
    };
    img.src = src;
  }

  // ---------------------------------------------------------------------------
  // The story

  /** Show the game's text so far. 'pause': before a request, the game's own prompt is dropped. */
  private flushText(isPrompt: boolean) {
    let text = this.pendingText;
    this.pendingText = '';
    // The game's command prompt (the command line has its own).
    if(isPrompt) text = text.replace(/\s*>\s*$/, '');
    for(const el of this.formatText(text)) this.logEl.appendChild(el);
  }

  /** Text into paragraphs (a paragraph's first line may be a room name, shown as a heading). */
  private formatText(text: string): HTMLElement[] {
    const out: HTMLElement[] = [];
    for(const para of text.split(/\n[ \t]*\n/)) {
      const lines = para.split('\n').map((l) => l.trim()).filter((l) => l);
      if(!lines.length) continue;
      if(lines.length > 1 && /^[A-Z][^.!?:"“”]{0,50}$/.test(lines[0])) {
        const h = document.createElement('h3');
        h.className = 'room-name';
        h.textContent = lines.shift()!;
        out.push(h);
      }
      const p = document.createElement('p');
      // (The VM doesn't wrap lines, so a newline is a line break in the game's text.)
      lines.forEach((line, i) => {
        if(i) p.appendChild(document.createElement('br'));
        p.appendChild(document.createTextNode(line));
      });
      if(/^\(.*\)$/.test(p.textContent)) p.className = 'aside';
      out.push(p);
    }
    return out;
  }

  /** Scroll so the latest command and its response show (the command at the top, if it doesn't all fit). */
  private scrollToLatest() {
    const story = this.storyEl;
    const target = this.lastEcho ? this.lastEcho.offsetTop - 12 : story.scrollHeight;
    story.scrollTo({ top: Math.min(target, story.scrollHeight), behavior: 'smooth' });
  }

  /** The game waits for a command. */
  private readyForCommand() {
    this.flushText(true);
    this.formEl.classList.remove('busy');
    this.scrollToLatest();
    if(this.typedAhead.length) {
      this.send(this.typedAhead.shift()!);
      return;
    }
    this.focusInput();
  }

  private focusInput() {
    if(!this.touch && this.client.waiting == 'line') this.inputEl.focus({ preventScroll: true });
  }

  /** A command from the player: sent now, or when the game is ready for it. */
  private command(line: string) {
    if(this.client.waiting == 'line') this.send(line);
    else if(this.client.waiting === null && line.trim()) this.typedAhead.push(line);
  }

  private send(line: string) {
    const echo = document.createElement('p');
    echo.className = 'echo';
    echo.textContent = line;
    this.logEl.appendChild(echo);
    this.lastEcho = echo;
    if(line.trim() && this.history[this.history.length - 1] !== line) this.history.push(line);
    this.historyPos = this.history.length;
    // Commands for the page itself (the game doesn't see them; no turn passes).
    const reply = this.pageCommand(line);
    if(reply !== null) {
      const p = document.createElement('p');
      p.className = 'aside';
      p.textContent = reply;
      this.logEl.appendChild(p);
      this.scrollToLatest();
      if(this.typedAhead.length) this.send(this.typedAhead.shift()!);
      else this.focusInput();
      return;
    }
    this.formEl.classList.add('busy');
    this.client.sendLine(line);
  }

  /**
   * A command for the page rather than the game: PICTURES ON / OFF (also
   * PICTURE, IMAGE(S), ILLUSTRATION(S); without ON or OFF it switches).
   * Returns the reply, or null when the line is for the game.
   */
  private pageCommand(line: string): string | null {
    const m = /^\s*(?:pictures?|images?|illustrations?)(?:\s+(on|off))?\s*[.!]?\s*$/i.exec(line);
    if(!m) return null;
    const on = m[1] ? m[1].toLowerCase() == 'on' : !this.picturesOn();
    this.setSetting('pictures', on ? 'on' : 'off');
    return on ? '(Pictures are on. Type PICTURES OFF to hide them.)'
              : '(Pictures are off. Type PICTURES ON to show them again.)';
  }

  /** The game waits for a key ("more" or a keystroke). */
  private waitForKey(label: string) {
    this.flushText(true);
    const button = document.createElement('button');
    button.className = 'continue';
    button.textContent = label;
    button.addEventListener('click', (e) => { e.stopPropagation(); this.continueAfterKey(' '); });
    this.logEl.appendChild(button);
    this.scrollToLatest();
    button.focus({ preventScroll: true });
  }

  private continueAfterKey(key: string) {
    this.logEl.querySelectorAll('.continue').forEach((b) => b.remove());
    this.client.sendKey(key);
  }

  private gameOver(error?: string) {
    this.flushText(true);
    this.formEl.hidden = true;
    if(error) {
      const p = document.createElement('p');
      p.className = 'error';
      p.textContent = 'Something went wrong: ' + error;
      this.logEl.appendChild(p);
    }
    const again = document.createElement('button');
    again.className = 'continue';
    again.textContent = 'Play again';
    again.addEventListener('click', () => location.reload());
    this.logEl.appendChild(again);
    this.storyEl.scrollTo({ top: this.storyEl.scrollHeight, behavior: 'smooth' });
  }
}

/** A placeholder picture for a location without one yet (an SVG data URL). */
function placeholder(key: string, room: string): string {
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
    <rect width="960" height="640" fill="#d8ccb4"/>
    <rect x="24" y="24" width="912" height="592" fill="none" stroke="#9c8a6c" stroke-width="3" stroke-dasharray="14 10"/>
    <text x="480" y="300" text-anchor="middle" font-family="Georgia, serif" font-size="56" fill="#5a4630">${esc(room || key)}</text>
    <text x="480" y="370" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" fill="#7b6750">no picture yet: images/${esc(key)}.jpg</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
