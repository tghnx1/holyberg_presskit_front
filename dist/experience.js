(() => {
  const photos = [...document.querySelectorAll('a.photo')];
  const viewer = document.querySelector('.photo-viewer');
  const enlarged = viewer.querySelector('img');
  const caption = viewer.querySelector('.viewer-caption');
  const captionLink = caption.querySelector('a');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 819px)');

  document.querySelectorAll('.navigation a[href^="#"]').forEach((link) => link.addEventListener('click', (event) => {
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    history.pushState(null, '', link.hash);
    target.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
  }));
  let opener;
  let startedOnBackdrop;

  if (typeof viewer.showModal === 'function') {
    for (const photo of photos) {
      photo.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        opener = photo;
        enlarged.alt = photo.querySelector('img').alt;
        enlarged.src = photo.href;
        const label = photo.querySelector('.photo-caption')?.textContent;
        const eventLink = photo.dataset.captionLink;
        caption.hidden = !label;
        viewer.classList.toggle('has-caption', Boolean(label));
        caption.querySelector('span').textContent = label || '';
        captionLink.hidden = !eventLink;
        captionLink.textContent = photo.dataset.captionLinkLabel || 'Resident Advisor ↗';
        if (eventLink) { captionLink.href = eventLink; captionLink.target = '_blank'; captionLink.rel = 'noopener noreferrer'; }
        viewer.showModal();
      });
    }

    viewer.querySelector('.viewer-close').addEventListener('click', () => viewer.close());
    viewer.addEventListener('pointerdown', (event) => {
      startedOnBackdrop = event.target === viewer;
    });
    viewer.addEventListener('click', (event) => {
      if (startedOnBackdrop && event.target === viewer) viewer.close();
      startedOnBackdrop = false;
    });
    viewer.addEventListener('close', () => {
      enlarged.removeAttribute('src');
      opener?.focus({ preventScroll: true });
    });
  }


  const gallery = document.querySelector('.depth-gallery');
  const galleryPhotos = [...gallery.querySelectorAll('.photo, .gallery-clip')];
  const galleryGrid = gallery.querySelector('.installation-grid');
  const groupOrder = ['visuals', 'people-process', 'party-videos', 'promo'];
  galleryPhotos.sort((a, b) => groupOrder.indexOf(a.dataset.gallery) - groupOrder.indexOf(b.dataset.gallery));
  galleryPhotos.forEach((item) => galleryGrid.append(item));
  const galleryTabs = [...gallery.querySelectorAll('[data-gallery-group]')];
  const controls = gallery.querySelector('.depth-controls');
  const counter = controls.querySelector('.depth-counter');
  const [previous, next] = controls.querySelectorAll('button');
  const positions = [[.34, -.03], [-.33, .17], [.02, -.25], [.29, .22], [-.31, -.18], [.13, .02], [-.12, -.04], [.38, .02], [-.38, .08]];
  const total = String(galleryPhotos.length).padStart(2, '0');
  const exitHold = () => innerHeight * .8;
  function updateGalleryHeight() { gallery.style.setProperty('--gallery-height', `${180 + (galleryPhotos.length - 1) * 100}svh`); }
  function activeGalleryTravel() { return Math.max(1, gallery.clientHeight - gallery.firstElementChild.clientHeight - exitHold()); }
  updateGalleryHeight();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let frame = 0;
  let layer = 0;

  function renderGallery() {
    frame = 0;
    if (reducedMotion.matches) return;
    const stageHeight = gallery.firstElementChild.clientHeight;
    const travel = activeGalleryTravel();
    const progress = clamp(-gallery.getBoundingClientRect().top / travel, 0, 1);
    const distance = progress * (galleryPhotos.length - 1);
    layer = Math.round(distance);
    counter.textContent = `LAYER ${String(layer + 1).padStart(2, '0')} / ${String(galleryPhotos.length).padStart(2, '0')}`;
    updateActiveGroup();

    galleryPhotos.forEach((photo, index) => {
      const depth = index - distance;
      const scale = 1 / Math.max(.18, 1.3 + depth * .56);
      const [x, y] = positions[index % positions.length];
      const fade = clamp((2.04 - Math.abs(depth)) / .38, 0, 1);
      photo.style.left = `${50 + 100 * x * scale}%`;
      photo.style.top = `${49 + 100 * y * scale}%`;
      photo.style.transform = `translate(-50%, -50%) scale(${scale})`;
      photo.style.opacity = String(fade * clamp(1 - depth * .18, 0, 1));
      photo.style.zIndex = String(Math.round(1000 - Math.abs(depth) * 100));
      photo.style.visibility = fade ? 'visible' : 'hidden';
    });
  }

  function scheduleGallery() {
    if (!frame && !reducedMotion.matches) frame = requestAnimationFrame(renderGallery);
  }

  function goToLayer(index, behavior = 'smooth') {
    const top = scrollY + gallery.getBoundingClientRect().top;
    const travel = activeGalleryTravel();
    scrollTo({ top: top + travel * clamp(index, 0, galleryPhotos.length - 1) / (galleryPhotos.length - 1), behavior });
  }

  function goToGroup(group) {
    const index = galleryPhotos.findIndex((item) => item.dataset.gallery === group);
    if (index >= 0) goToLayer(index);
  }
  let entryDirection = 1;
  let lastScroll = scrollY;
  let previouslyInside = false;
  addEventListener('scroll', () => {
    const rect = gallery.getBoundingClientRect();
    const inside = rect.top <= 0 && rect.bottom > innerHeight;
    if (inside && !previouslyInside && scrollY !== lastScroll) entryDirection = scrollY > lastScroll ? 1 : -1;
    previouslyInside = inside;
    lastScroll = scrollY;
  }, { passive: true });
  const exitLink = controls.querySelector('a');
  exitLink.addEventListener('click', (event) => {
    if (reducedMotion.matches) return;
    event.preventDefault();
    let completed = false;
    let fallback;
    const finishRewind = () => {
      if (completed) return;
      completed = true;
      clearTimeout(fallback);
      removeEventListener('scrollend', finishRewind);
      const top = scrollY + gallery.getBoundingClientRect().top;
      scrollTo({ top: entryDirection > 0 ? top + gallery.offsetHeight + innerHeight * .1 : Math.max(0, top - innerHeight * .2), behavior: 'smooth' });
    };
    addEventListener('scrollend', finishRewind, { once: true });
    fallback = setTimeout(finishRewind, 2600);
    goToLayer(0);
  });
  galleryTabs.forEach((tab) => tab.addEventListener('click', () => goToGroup(tab.dataset.galleryGroup)));
  document.querySelectorAll('[data-gallery-target]').forEach((link) => link.addEventListener('click', (event) => {
    const item = document.getElementById(link.dataset.galleryTarget);
    const index = galleryPhotos.indexOf(item);
    if (index < 0) return;
    event.preventDefault();
    goToLayer(index);
  }));
  function updateActiveGroup() {
    const item = galleryPhotos[layer];
    const group = item?.dataset.gallery || 'visuals';
    galleryTabs.forEach((tab) => tab.setAttribute('aria-pressed', String(tab.dataset.galleryGroup === group)));
  }
  previous.addEventListener('click', () => goToLayer(layer - 1));
  next.addEventListener('click', () => goToLayer(layer + 1));
  gallery.addEventListener('focusin', (event) => {
    const index = galleryPhotos.findIndex((item) => item === event.target || item.contains(event.target));
    if (index >= 0 && !reducedMotion.matches && !viewer.open && event.target.matches(':focus-visible')) {
      goToLayer(index, 'instant');
    }
  });

  function setGalleryMode() {
    gallery.classList.toggle('is-spatial', !reducedMotion.matches);
    controls.hidden = reducedMotion.matches;
    if (reducedMotion.matches) {
      galleryPhotos.forEach((photo) => photo.removeAttribute('style'));
    } else {
      renderGallery();
    }
  }

  addEventListener('scroll', scheduleGallery, { passive: true });
  addEventListener('resize', scheduleGallery);
  reducedMotion.addEventListener('change', setGalleryMode);
  setGalleryMode();

  if (!window.Motion) return;
  const { scroll } = window.Motion;
  const stage = document.querySelector('.red-stage');
  const image = stage.querySelector('.red-image');
  let stopScroll;
  function configureMotion() {
    stopScroll?.();
    image.style.transform = '';
    if (reducedMotion.matches || compact.matches) return;
    stopScroll = scroll((progress) => {
      const scale = 0.94 + Math.min(progress * 4, 1) * 0.06;
      image.style.transform = 'scale(' + scale + ')';
    }, { target: stage, offset: ['start end', 'end start'] });
  }
  reducedMotion.addEventListener('change', configureMotion);
  compact.addEventListener('change', configureMotion);
  configureMotion();

  const moving = [...document.querySelectorAll('.manifesto h2, .manifesto-photo, .manifesto-copy h3, .manifesto-copy p, .people .story-copy, .people .photo, .visual-intro h3, .visual-intro p')];
  let motionFrame = 0;
  function moveContent() {
    motionFrame = 0;
    moving.forEach((element, index) => {
      if (reducedMotion.matches) { element.style.translate = ''; return; }
      const rect = element.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > innerHeight + 100) return;
      const progress = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight));
      element.style.translate = `0 ${progress * [20, -30, 12, -15, 24][index % 5]}px`;
    });
  }
  function scheduleContentMotion() { if (!motionFrame) motionFrame = requestAnimationFrame(moveContent); }
  addEventListener('scroll', scheduleContentMotion, { passive: true });
  addEventListener('resize', scheduleContentMotion);
  reducedMotion.addEventListener('change', scheduleContentMotion);
  moveContent();
})();
