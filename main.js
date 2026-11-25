(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value) => Math.min(1, Math.max(0, value));

  /* Reveal on scroll, once */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px 18% 0px' });

  $$('.flow').forEach((flow) => $$('li', flow).forEach((step, i) => step.style.setProperty('--i', i)));
  $$('[data-reveal], .flow').forEach((el) => observer.observe(el));

  /* Scroll story: progress, current chapter, timeline beam */
  const header = $('.site-header');
  const chapters = $$('.chapter');
  const segments = $$('.progress i');
  const timelines = $$('.timeline');
  const projects = $$('.project');
  const cases = $$('.case').map((el) => ({
    el,
    bar: $('.reading', el),
    label: $('[data-reading]', el),
    parts: $$('.story dt', el),
  }));
  const current = $('[data-current]');
  const chapterLinks = $$('.timeline-menu .menu-panel a');
  const projectMenu = $('.project-menu');
  const projectLinks = $$('nav a', projectMenu);
  const projectLinksById = new Map(projectLinks.map((link) => [link.hash.slice(1), link]));
  let active = null;
  let activeProjectLink;
  let queued = false;

  function update() {
    queued = false;
    const vh = innerHeight;
    const readingLine = vh * 0.6;
    const atEnd = scrollY + vh >= document.documentElement.scrollHeight - 2;
    let next = -1;

    chapters.forEach((chapter, i) => {
      const box = chapter.getBoundingClientRect();
      if (box.top <= header.offsetHeight + 8) next = i;
      segments[i].style.setProperty('--p', atEnd ? 1 : clamp((readingLine - box.top) / box.height));
    });
    if (atEnd) next = chapters.length - 1;

    timelines.forEach((line) => {
      const box = line.getBoundingClientRect();
      line.style.setProperty('--fill', clamp((readingLine - box.top) / box.height));
    });
    projects.forEach((project) => {
      project.classList.toggle('is-lit', project.getBoundingClientRect().top < readingLine);
    });

    let projectLink;
    cases.forEach(({ el, bar, label, parts }) => {
      const box = el.getBoundingClientRect();
      if (box.bottom < 0 || box.top > vh) return;
      if (box.top <= readingLine && box.bottom > readingLine) projectLink = projectLinksById.get(el.id);
      let part = 'Overview';
      parts.forEach((dt) => {
        if (dt.checkVisibility() && dt.getBoundingClientRect().top < readingLine) part = dt.textContent;
      });
      if (label.textContent !== part) label.textContent = part;
      bar.style.setProperty('--read', clamp((readingLine - box.top) / box.height));
    });

    if (projectLink !== activeProjectLink) {
      activeProjectLink?.removeAttribute('aria-current');
      projectLink?.setAttribute('aria-current', 'location');
      activeProjectLink = projectLink;
    }

    if (next === active) return;
    active = next;
    header.className = `site-header ${chapters[next]?.dataset.theme ?? 't-night'}`;
    current.textContent = chapters[next]?.dataset.label ?? 'Timeline';
    chapterLinks.forEach((link, i) => {
      if (i === next) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
  }
  function queueUpdate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }
  addEventListener('scroll', queueUpdate, { passive: true });
  addEventListener('resize', queueUpdate);

  /* Dropdowns */
  const menus = $$('.menu');
  const closeMenus = (except) => menus.forEach((menu) => { if (menu !== except) menu.open = false; });
  menus.forEach((menu) => {
    menu.addEventListener('toggle', () => { if (menu.open) closeMenus(menu); });
    menu.addEventListener('click', (event) => { if (event.target.closest('a')) menu.open = false; });
    menu.addEventListener('focusout', (event) => {
      if (event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false;
    });
  });
  document.addEventListener('click', (event) => { if (!event.target.closest('.menu')) closeMenus(); });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = menus.find((menu) => menu.open);
    if (!open) return;
    open.open = false;
    $('summary', open).focus();
  });

  /* Project picker */
  const projectFilter = $('.project-filter', projectMenu);
  const projectQuery = $('input', projectFilter);
  const projectEmpty = $('.project-empty', projectMenu);
  function filterProjects() {
    const query = projectQuery.value.trim().toLowerCase();
    projectLinks.forEach((link) => { link.hidden = !link.textContent.toLowerCase().includes(query); });
    projectEmpty.textContent = projectLinks.every((link) => link.hidden) ? 'No matching projects.' : '';
  }
  projectQuery.addEventListener('input', filterProjects);
  projectQuery.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') projectLinks.find((link) => !link.hidden)?.click();
  });
  projectMenu.addEventListener('toggle', () => {
    if (projectMenu.open) return;
    projectQuery.value = '';
    filterProjects();
  });
  projectFilter.hidden = false;

  /* Galleries and lightbox */
  const lightbox = $('.lightbox');
  const largeImage = $('img', lightbox);
  const largeCaption = $('p', lightbox);

  $$('.gallery').forEach((gallery) => {
    const shot = $('.shot', gallery);
    const image = $('img', shot);
    const caption = $('figcaption', gallery);
    const thumbs = $$('.thumbs button', gallery);
    let timer;

    thumbs.forEach((thumb) => thumb.addEventListener('click', () => {
      thumbs.forEach((t) => t.setAttribute('aria-pressed', String(t === thumb)));
      shot.classList.add('is-changing');
      clearTimeout(timer);
      timer = setTimeout(() => {
        image.src = thumb.dataset.src;
        image.alt = thumb.dataset.caption;
        caption.textContent = thumb.dataset.caption;
        shot.classList.remove('is-changing');
      }, reduced ? 0 : 160);
    }));

    shot.addEventListener('click', () => {
      largeImage.src = image.src;
      largeImage.alt = image.alt;
      const owner = $('h3 > span:last-child', gallery.closest('.project'));
      largeCaption.textContent = `${owner.textContent}: ${caption.textContent}`;
      lightbox.showModal();
    });

    if (reduced || !matchMedia('(hover: hover)').matches) return;
    shot.addEventListener('pointermove', (event) => {
      const box = shot.getBoundingClientRect();
      shot.style.setProperty('--mx', `${event.clientX - box.left}px`);
      shot.style.setProperty('--my', `${event.clientY - box.top}px`);
    });
  });
  lightbox.addEventListener('click', (event) => { if (event.target === lightbox) lightbox.close(); });

  update();
})();
