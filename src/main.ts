import { capabilities, experience, profile, projects } from './content';
import type { Project, ProjectCategory } from './content';
import type { MachineController } from './machine';
import type { PortraitController } from './portrait';

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Portfolio is missing a required element: ${selector}`);
  return element;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>';
let motionEnabled = true;
try {
  motionEnabled = localStorage.getItem('portfolio:motion') !== 'off';
} catch (error) {
  console.warn('Saved motion preferences are unavailable in this browser:', error);
  required('#motion-status').textContent =
    'Motion preferences cannot be saved here. The pause control still works for this visit.';
}
let machine: MachineController | undefined;
let portrait: PortraitController | undefined;
let disposed = false;
let featuredIndex = 0;
let copyResetTimer: ReturnType<typeof setTimeout> | undefined;
let hintTimer: ReturnType<typeof setTimeout> | undefined;

const motionButton = required<HTMLButtonElement>('#motion-toggle');
const motionLabel = required<HTMLElement>('#motion-label');
const grid = required<HTMLDivElement>('#project-grid');
const dialog = required<HTMLDialogElement>('#project-dialog');
const dialogContent = required<HTMLDivElement>('#dialog-content');
const dialogClose = required<HTMLButtonElement>('#dialog-close');
const featuredOpen = required<HTMLButtonElement>('#featured-open');
const featuredLabel = required<HTMLElement>('#featured-label');
const menuButton = required<HTMLButtonElement>('#menu-toggle');
const navigation = required<HTMLElement>('#main-navigation');
const heroArt = required<HTMLElement>('#hero-art');
const terminalControls = required<HTMLElement>('#terminal-controls');
const terminalHint = required<HTMLElement>('#terminal-hint');
const header = required<HTMLElement>('.site-header');
let dialogTrigger: HTMLElement | undefined;
let previousOverflow = '';

const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  },
  { threshold: 0.06, rootMargin: '0px 0px -20px 0px' },
);

function observeReveals(scope: ParentNode = document): void {
  scope.querySelectorAll('.reveal:not(.visible)').forEach((element) => {
    revealObserver.observe(element);
  });
}

function setMotion(enabled: boolean): void {
  motionEnabled = enabled;
  document.documentElement.dataset.motion = enabled ? 'on' : 'off';
  motionButton.setAttribute('aria-pressed', String(!enabled));
  motionButton.setAttribute('aria-label', enabled ? 'Pause animations' : 'Resume animations');
  motionLabel.textContent = enabled ? 'MOTION ON' : 'MOTION OFF';
  window.dispatchEvent(new CustomEvent('portfolio:motion', { detail: { enabled } }));
}

setMotion(motionEnabled);
motionButton.addEventListener('click', () => {
  setMotion(!motionEnabled);
  try {
    localStorage.setItem('portfolio:motion', motionEnabled ? 'on' : 'off');
  } catch (error) {
    console.warn('The motion preference could not be saved:', error);
    required('#motion-status').textContent =
      'Your motion choice applies to this visit; this browser could not save it.';
  }
});

function renderProjects(category: ProjectCategory | 'all'): void {
  const selected = projects.filter(
    (project) => category === 'all' || project.category === category,
  );
  grid.innerHTML = selected
    .map(
      (project) => `
        <article class="project-card reveal" data-project="${project.id}">
          <div class="project-image-wrap">
            <img src="./images/${project.id}.svg" alt="Original conceptual artwork for ${escapeHtml(project.name)}" width="1600" height="1200" loading="lazy" decoding="async" />
            <span class="project-index" aria-hidden="true">${project.number} / ${project.category === 'systems' ? 'ENGINEERING SYSTEMS' : 'IDEAS INTO INTERFACES'}</span>
            <span class="project-view" aria-hidden="true">EXPLORE<br />PROJECT${arrow}</span>
          </div>
          <div class="project-info">
            <div>
              <p class="project-context">${escapeHtml(project.context)}</p>
              <h3>${escapeHtml(project.name)}</h3>
              <p class="project-subtitle">${escapeHtml(project.subtitle)}</p>
            </div>
            <span class="project-arrow" aria-hidden="true">${arrow}</span>
          </div>
          <button class="project-hit" type="button" aria-label="Explore ${escapeHtml(project.name)}" aria-haspopup="dialog" data-open-project="${project.id}"></button>
        </article>`,
    )
    .join('');
  observeReveals(grid);
  required('#work-status').textContent =
    category === 'all'
      ? `Showing all ${selected.length} projects.`
      : `Showing ${selected.length} ${category === 'systems' ? 'systems' : 'AI and ideas'} projects.`;
}

const filters = document.querySelectorAll<HTMLButtonElement>('[data-filter]');
filters.forEach((button) => {
  button.addEventListener('click', () => {
    const category = button.dataset.filter;
    if (category !== 'all' && category !== 'systems' && category !== 'ai') {
      throw new Error(`Unknown project category: ${category}`);
    }
    for (const filter of filters) {
      const selected = filter === button;
      filter.classList.toggle('active', selected);
      filter.setAttribute('aria-pressed', String(selected));
    }
    renderProjects(category);
  });
});

function openProject(project: Project, trigger: HTMLElement): void {
  dialogTrigger = trigger;
  dialog.dataset.project = project.id;
  required('#dialog-counter').textContent =
    `PROJECT FILE ${project.number} / 05 — ${project.context.toUpperCase()}`;
  dialogContent.innerHTML = `
    <div class="dialog-hero">
      <div class="dialog-intro">
        <p class="eyebrow">${escapeHtml(project.context)}</p>
        <h2 id="dialog-title">${escapeHtml(project.name)}</h2>
        <p class="dialog-hook serif-word">${escapeHtml(project.subtitle)}</p>
        <p class="dialog-description">${escapeHtml(project.description)}</p>
      </div>
      <figure class="dialog-visual">
        <img class="dialog-image" src="./images/${project.id}.svg" alt="Original conceptual artwork for ${escapeHtml(project.name)}" width="1600" height="1200" />
        <figcaption class="mono"><span>AN IDEA, VISUALIZED.</span><span>FIG. ${project.number} / CONCEPT ART</span></figcaption>
      </figure>
    </div>
    <div class="dialog-main">
      <div class="dialog-overview">
        <div class="dialog-outcome">
          <span class="mono">THE TAKEAWAY</span>
          <strong>${escapeHtml(project.outcome.value)}</strong>
          <p>${escapeHtml(project.outcome.label)}</p>
        </div>
        <div class="dialog-toolkit">
          <p class="eyebrow">THE BUILDING BLOCKS</p>
          <div class="skill-tags">${project.tags.map((tag) => `<span class="skill-tag">${escapeHtml(tag)}</span>`).join('')}</div>
        </div>
      </div>
      <div class="dialog-story-heading">
        <p class="eyebrow">BEHIND THE BUILD</p>
        <p>The thinking. <span class="serif-word">The making.</span></p>
      </div>
      <div class="dialog-details">
        ${project.details.map((detail, index) => `<section class="dialog-detail"><span class="dialog-step serif-word" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(detail.title)}</h3><p>${escapeHtml(detail.body)}</p></section>`).join('')}
      </div>
      <div class="dialog-footer">
        <p class="dialog-footnote mono">ORIGINAL CONCEPT ARTWORK, NOT A PRODUCT SCREENSHOT. SUMMARY BASED ON MY RESUME.</p>
        <a class="text-link dialog-contact" href="mailto:${profile.email}?subject=${encodeURIComponent(`Let's talk about ${project.name}`)}">Let's build something that matters.${arrow}</a>
      </div>
    </div>`;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  dialog.showModal();
  dialog.scrollTop = 0;
  dialogClose.focus({ preventScroll: true });
}

function closeProject(): void {
  if (!dialog.open) return;
  dialog.close();
  document.body.style.overflow = previousOverflow;
  dialogTrigger?.focus({ preventScroll: true });
}

grid.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>('[data-open-project]');
  if (!button) return;
  const project = projects.find((item) => item.id === button.dataset.openProject);
  if (!project) throw new Error('The selected project could not be found.');
  openProject(project, button);
});

grid.addEventListener('pointermove', (event) => {
  if (!motionEnabled || event.pointerType !== 'mouse' || !(event.target instanceof Element)) return;
  const card = event.target.closest<HTMLElement>('.project-card');
  if (!card) return;
  const image = card.querySelector<HTMLElement>('.project-image-wrap');
  if (!image) return;
  const rect = image.getBoundingClientRect();
  const x = Math.max(50, Math.min(rect.width - 50, event.clientX - rect.left));
  const y = Math.max(50, Math.min(rect.height - 50, event.clientY - rect.top));
  image.style.setProperty('--cursor-x', `${x}px`);
  image.style.setProperty('--cursor-y', `${y}px`);
});

dialogClose.addEventListener('click', closeProject);
dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeProject();
});
dialog.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const lastControl = required<HTMLAnchorElement>('.dialog-contact');
  const wrapsBackward =
    event.shiftKey && (document.activeElement === dialogClose || document.activeElement === dialog);
  const wrapsForward = !event.shiftKey && document.activeElement === lastControl;
  if (wrapsBackward || wrapsForward) {
    event.preventDefault();
    (event.shiftKey ? lastControl : dialogClose).focus();
  }
});
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  ) {
    closeProject();
  }
});

function updateFeatured(): void {
  const project = projects[featuredIndex];
  featuredLabel.innerHTML = `<span>${project.number} / 05</span> ${escapeHtml(project.name.toUpperCase())}`;
  featuredOpen.setAttribute('aria-label', `Explore featured project: ${project.name}`);
  required<HTMLImageElement>('#terminal-artwork').src = `./images/${project.id}.svg`;
  machine?.setProject(project.id);
  heroArt.dataset.featuredProject = project.id;
}

required('#featured-previous').addEventListener('click', () => {
  featuredIndex = (featuredIndex - 1 + projects.length) % projects.length;
  updateFeatured();
});
required('#featured-next').addEventListener('click', () => {
  featuredIndex = (featuredIndex + 1) % projects.length;
  updateFeatured();
});
featuredOpen.addEventListener('click', () => openProject(projects[featuredIndex], featuredOpen));
function dismissTerminalHint(): void {
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = undefined;
  terminalHint.classList.remove('is-visible');
  terminalHint.classList.add('dismissed');
  hintObserver.disconnect();
}
terminalControls.addEventListener('click', dismissTerminalHint);
featuredOpen.addEventListener('click', dismissTerminalHint);
let terminalVisible = false;
function startTerminalHint(): void {
  if (
    !terminalVisible ||
    heroArt.dataset.terminalState === 'loading' ||
    terminalHint.classList.contains('dismissed') ||
    hintTimer
  ) {
    return;
  }
  terminalHint.classList.add('is-visible');
  hintTimer = setTimeout(dismissTerminalHint, 7000);
}
const hintObserver = new IntersectionObserver(([entry]) => {
  terminalVisible = entry.isIntersecting;
  if (!terminalVisible) terminalHint.classList.remove('is-visible');
  if (!terminalVisible && hintTimer) {
    clearTimeout(hintTimer);
    hintTimer = undefined;
  }
  startTerminalHint();
});
hintObserver.observe(terminalControls);

function setTerminalReady(ready: boolean): void {
  heroArt.dataset.terminalState = ready ? 'ready' : 'fallback';
  heroArt.classList.toggle('has-webgl', ready);
  startTerminalHint();
}

required('#capabilities').innerHTML = capabilities
  .map(
    (capability) => `
      <article class="capability reveal">
        <span class="capability-number mono">${capability.number} /</span>
        <h3>${escapeHtml(capability.title)}</h3>
        <p>${escapeHtml(capability.description)}</p>
        <div class="skill-tags">${capability.skills.map((skill) => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join('')}</div>
      </article>`,
  )
  .join('');

required('#experience-list').innerHTML = experience
  .map(
    (item, index) => `
      <details class="experience-item reveal${index === 0 ? ' current' : ''}"${index === 0 ? ' open' : ''}>
        <summary>
          <span class="experience-mark ${item.company === 'Microsoft' ? 'microsoft-mark' : 'ibm-mark'}" aria-hidden="true">${item.company === 'Microsoft' ? '<i></i><i></i><i></i><i></i>' : 'IBM'}</span>
          <span class="experience-heading">
            <span class="experience-chapter mono">CHAPTER ${String(experience.length - index).padStart(2, '0')} / ${escapeHtml(item.caption)}</span>
            <span class="experience-company">${escapeHtml(item.company)}</span>
            <span class="experience-role">${escapeHtml(item.role)}</span>
          </span>
          <span class="experience-date"><span class="experience-period mono">${escapeHtml(item.period)}</span>${index === 0 ? '<span class="chapter-status mono"><i></i> STILL BUILDING</span>' : '<span class="chapter-prompt mono">OPEN THE CHAPTER</span>'}</span>
          <span class="experience-expand" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16"/></svg></span>
        </summary>
        <div class="experience-details">
          <div class="experience-story">
            <p class="mono">${escapeHtml(item.location)}</p>
            <p>${escapeHtml(item.description)}</p>
            <div class="experience-tags">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
          </div>
          ${item.highlights.length ? `<ul>${item.highlights.map((highlight, highlightIndex) => `<li><span class="achievement-index mono">${String(highlightIndex + 1).padStart(2, '0')}</span><p>${escapeHtml(highlight)}</p></li>`).join('')}</ul>` : '<p class="experience-postscript serif-word">Built it. Shipped it.<br />Kept the curiosity.</p>'}
        </div>
      </details>`,
  )
  .join('');

function closeMenu(restoreFocus = false): void {
  navigation.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation');
  if (restoreFocus) menuButton.focus();
}

menuButton.addEventListener('click', () => {
  const isOpen = navigation.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
});
navigation
  .querySelectorAll('a')
  .forEach((link) => link.addEventListener('click', () => closeMenu()));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navigation.classList.contains('open')) closeMenu(true);
});
document.addEventListener('click', (event) => {
  if (event.target instanceof Node && !header.contains(event.target)) closeMenu();
});
document.addEventListener('focusin', (event) => {
  if (event.target instanceof Node && !header.contains(event.target)) closeMenu();
});
window.matchMedia('(min-width: 761px)').addEventListener('change', (event) => {
  if (event.matches) closeMenu();
});

const sectionObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const link of navigation.querySelectorAll<HTMLAnchorElement>('[data-nav]')) {
        const active = link.dataset.nav === entry.target.id;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }
  },
  { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
);
document.querySelectorAll('main > section').forEach((section) => sectionObserver.observe(section));

let scrollFrame = 0;
let maximumScroll = 1;
let headerScrolled = false;
function updateScroll(): void {
  scrollFrame = 0;
  const scrollY = window.scrollY;
  const scrolled = scrollY > 35;
  if (scrolled !== headerScrolled) {
    headerScrolled = scrolled;
    header.classList.toggle('scrolled', scrolled);
  }
  header.style.setProperty(
    '--scroll-progress',
    String(Math.min(1, Math.max(0, scrollY / maximumScroll))),
  );
}
function updateScrollRange(): void {
  maximumScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  updateScroll();
}
const pageSizeObserver = new ResizeObserver(updateScrollRange);
pageSizeObserver.observe(document.body);
window.addEventListener('resize', updateScrollRange);
window.addEventListener(
  'scroll',
  () => {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScroll);
  },
  { passive: true },
);

required('#copy-email').addEventListener('click', async () => {
  const status = required('#copy-status');
  if (copyResetTimer) clearTimeout(copyResetTimer);
  try {
    if (!navigator.clipboard) throw new Error('Clipboard access is unavailable in this browser.');
    await navigator.clipboard.writeText(profile.email);
    status.textContent = 'COPIED. GOOD CONVERSATIONS START HERE.';
    copyResetTimer = setTimeout(() => {
      status.textContent = '';
    }, 5000);
  } catch (error) {
    console.warn('Email could not be copied:', error);
    status.textContent = `COPY UNAVAILABLE. SELECT THE ADDRESS ABOVE, OR CLICK IT TO EMAIL ME.`;
  }
});

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
function updateClock(): void {
  const now = new Date();
  required('#local-time').textContent = `${clockFormatter.format(now)} IST / LOCAL TIME`;
  required('#footer-year').textContent = String(now.getFullYear());
}
updateClock();
setInterval(updateClock, 30_000);

renderProjects('all');
updateFeatured();
observeReveals();
document.documentElement.classList.add('js');
updateScroll();

const portraitStage = required<HTMLElement>('#playground-stage');
const portraitObserver = new IntersectionObserver(
  ([entry]) => {
    if (!entry.isIntersecting) return;
    portraitObserver.disconnect();
    void import('./portrait')
      .then(({ createPortrait }) =>
        createPortrait(
          required<HTMLCanvasElement>('#playground-canvas'),
          portraitStage,
          () => motionEnabled,
        ),
      )
      .then((controller) => {
        if (disposed) controller.dispose();
        else portrait = controller;
      })
      .catch((error: unknown) => {
        if (disposed) return;
        console.warn('The interactive portrait is unavailable:', error);
        const status = required('#playground-status');
        status.textContent =
          'The interactive portrait could not start in this browser. A static, dots-only portrait is shown instead.';
        status.classList.remove('sr-only');
        required<HTMLButtonElement>('#portrait-scatter').disabled = true;
      });
  },
  { rootMargin: '150px' },
);
portraitObserver.observe(portraitStage);

void import('./machine')
  .then(({ createMachine }) => {
    if (disposed) return;
    machine = createMachine(required('#machine-canvas'), {
      screenButton: featuredOpen,
      channelControls: terminalControls,
      initialProject: projects[featuredIndex].id,
      isMotionEnabled: () => motionEnabled,
      onReady: setTerminalReady,
      onAssetError: (message) => {
        required('#art-status').textContent = message;
      },
    });
  })
  .catch((error: unknown) => {
    if (disposed) return;
    console.warn('Interactive terminal is unavailable:', error);
    required('#art-status').textContent = 'STATIC TERMINAL / 3D IS UNAVAILABLE IN THIS BROWSER.';
    setTerminalReady(false);
  });

window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  disposed = true;
  machine?.dispose();
  portrait?.dispose();
  if (hintTimer) clearTimeout(hintTimer);
  hintObserver.disconnect();
  portraitObserver.disconnect();
  pageSizeObserver.disconnect();
  window.removeEventListener('resize', updateScrollRange);
  revealObserver.disconnect();
  sectionObserver.disconnect();
});
