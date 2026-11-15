(() => {
  const photos = [...document.querySelectorAll('a.photo')];
  const viewer = document.querySelector('.photo-viewer');
  const enlarged = viewer.querySelector('img');
  const caption = viewer.querySelector('.viewer-caption');
  const captionLink = caption.querySelector('a');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 819px)');
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
        if (eventLink) captionLink.href = eventLink;
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
  const galleryPhotos = [...gallery.querySelectorAll('.photo')];
  const controls = gallery.querySelector('.depth-controls');
  const counter = controls.querySelector('.depth-counter');
  const [previous, next] = controls.querySelectorAll('button');
  const positions = [[.29, -.02], [-.26, .15], [.02, -.23], [.20, .19], [-.22, -.16], [.13, .02], [-.16, -.04]];
  const total = String(galleryPhotos.length).padStart(2, '0');
  gallery.style.setProperty('--gallery-height', `${100 + (galleryPhotos.length - 1) * 80}svh`);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let frame = 0;
  let layer = 0;

  function renderGallery() {
    frame = 0;
    if (reducedMotion.matches) return;
    const stageHeight = gallery.firstElementChild.clientHeight;
    const travel = gallery.clientHeight - stageHeight;
    const progress = clamp(-gallery.getBoundingClientRect().top / Math.max(1, travel), 0, 1);
    const distance = progress * (galleryPhotos.length - 1);
    layer = Math.round(distance);
    counter.textContent = `LAYER ${String(layer + 1).padStart(2, '0')} / ${total}`;

    galleryPhotos.forEach((photo, index) => {
      const depth = index - distance;
      const scale = 1 / Math.max(.18, 1.3 + depth * .56);
      const [x, y] = positions[index];
      const fade = clamp((depth + 2.04) / .38, 0, 1);
      photo.style.left = `${50 + 100 * x * scale}%`;
      photo.style.top = `${49 + 100 * y * scale}%`;
      photo.style.transform = `translate(-50%, -50%) scale(${scale})`;
      photo.style.opacity = String(fade * clamp(1 - depth * .18, 0, 1));
      photo.style.zIndex = String(galleryPhotos.length - index);
      photo.style.visibility = fade ? 'visible' : 'hidden';
    });
  }

  function scheduleGallery() {
    if (!frame && !reducedMotion.matches) frame = requestAnimationFrame(renderGallery);
  }

  function goToLayer(index, behavior = 'smooth') {
    const top = scrollY + gallery.getBoundingClientRect().top;
    const travel = gallery.clientHeight - gallery.firstElementChild.clientHeight;
    scrollTo({ top: top + travel * clamp(index, 0, galleryPhotos.length - 1) / (galleryPhotos.length - 1), behavior });
  }

  previous.addEventListener('click', () => goToLayer(layer - 1));
  next.addEventListener('click', () => goToLayer(layer + 1));
  gallery.addEventListener('focusin', (event) => {
    const index = galleryPhotos.indexOf(event.target);
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
      const scale = 0.9 + Math.min(progress * 2, 1) * 0.1;
      image.style.transform = 'scale(' + scale + ')';
    }, { target: stage, offset: ['start end', 'end start'] });
  }
  reducedMotion.addEventListener('change', configureMotion);
  compact.addEventListener('change', configureMotion);
  configureMotion();
})();
