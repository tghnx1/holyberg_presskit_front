(() => {
  const photos = [...document.querySelectorAll('a.photo')];
  const viewer = document.querySelector('.photo-viewer');
  const enlarged = viewer.querySelector('img');
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

  if (!window.Motion) return;
  const { animate, inView, scroll } = window.Motion;
  const cover = document.querySelector('.cover');
  const collage = document.querySelector('.installations');
  let layersReady = false;
  let stopParallax;

  async function prepareCover() {
    const layers = document.createElement('div');
    layers.className = 'cover-layers';
    layers.setAttribute('aria-hidden', 'true');
    const artwork = [
      ['sky', 28, 7],
      ['mountains', 7, 2],
      ['wordmark', 64, 16],
    ].map(([name, desktopDistance, phoneDistance]) => {
      const image = new Image();
      image.className = 'cover-' + name;
      image.alt = '';
      image.fetchPriority = 'low';
      image.src = 'assets/cover-' + name + '.webp';
      layers.append(image);
      return { image, desktopDistance, phoneDistance };
    });
    try {
      await Promise.all(artwork.map(({ image }) => image.decode()));
    } catch {
      return;
    }
    cover.append(layers);
    layersReady = true;
    updateCover();

    function updateCover() {
      stopParallax?.();
      cover.classList.toggle('is-layered', !reducedMotion.matches);
      if (reducedMotion.matches) return;
      stopParallax = scroll((progress) => {
        for (const { image, desktopDistance, phoneDistance } of artwork) {
          const distance = compact.matches ? phoneDistance : desktopDistance;
          image.style.transform = 'translateY(' + (-progress * distance) + 'px)';
        }
      }, { target: cover, offset: ['start start', 'end start'] });
    }

    reducedMotion.addEventListener('change', updateCover);
  }

  function reveal(photo, delay = 0) {
    if (reducedMotion.matches) return;
    const image = photo.querySelector('img');
    const distance = compact.matches ? 0 : 16;
    animate(image, {
      opacity: [0.35, 1],
      transform: ['translateY(' + distance + 'px)', 'translateY(0px)'],
    }, { duration: compact.matches ? 0.32 : 0.56, delay, ease: 'easeOut' });
  }

  for (const spread of document.querySelectorAll('.spread:not(.installations)')) {
    [...spread.querySelectorAll('a.photo')].forEach((photo, index) => {
      inView(photo, () => reveal(photo, index * 0.055), { amount: 0.18 });
    });
  }

  inView(collage, () => {
    if (reducedMotion.matches) return;
    [...collage.querySelectorAll('a.photo')].forEach((photo, index) => {
      reveal(photo, index * (compact.matches ? 0.045 : 0.09));
    });
    if (!compact.matches) {
      animate(collage.querySelector('.laser-sweep'), {
        opacity: [0, 0.85, 0],
        transform: ['translateX(-70%)', 'translateX(70%)'],
      }, { duration: 1.02, ease: 'easeInOut' });
    }
  }, { amount: 0.22 });

  function loadCoverMotion() {
    if (layersReady || reducedMotion.matches) return;
    reducedMotion.removeEventListener('change', loadCoverMotion);
    prepareCover();
  }

  reducedMotion.addEventListener('change', loadCoverMotion);
  loadCoverMotion();
})();
