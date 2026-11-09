
'use strict';

// ==========================================
// DAVOSHOTIT STUDIO 2026 PRO
// COMPLETE JAVASCRIPT
// ==========================================

// GENERAL HELPERS

const $ = id => document.getElementById(id);

const clamp = (value, min = 0, max = 255) =>
  Math.min(max, Math.max(min, value));

const wait = () =>
  new Promise(resolve => setTimeout(resolve, 20));

const clone = value =>
  JSON.parse(JSON.stringify(value));

function status(message) {
  $('editorStatus').textContent = message;
}

// ==========================================
// 1. PHOTOGRAPHY PORTFOLIO
// ==========================================

// These are your 7 real GitHub photo filenames.
// Keep these photos inside the "photos" folder.

const portfolioImages = [
  'DSC_0800.jpeg',
  'DSC_0813 (1).jpeg',
  'DSC_0813.jpeg',
  'DSC_0816.jpeg',
  'DSC_0837.jpeg',
  'DSC_0881.jpeg',
  'Natural_Enhanced_Photo.png'
].map(name => ({
  name,
  url: 'photos/' + encodeURIComponent(name),
  orientation: null
}));

let galleryFilter = 'all';

function renderPortfolio() {
  const gallery = $('portfolioGallery');
  const message = $('galleryStatus');

  gallery.replaceChildren();

  let visible = 0;
  let pending = 0;

  portfolioImages.forEach((photo, index) => {
    if (
      galleryFilter !== 'all' &&
      photo.orientation &&
      photo.orientation !== galleryFilter
    ) {
      return;
    }

    const figure = document.createElement('figure');
    figure.className = 'gallery-item';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery-photo-button';
    button.setAttribute(
      'aria-label',
      'View ' + photo.name
    );

    const img = document.createElement('img');
    img.className = 'gallery-photo';
    img.src = photo.url;
    img.alt = 'DAVOSHOTIT photography: ' + photo.name;
    img.loading = 'lazy';

    if (!photo.orientation) pending++;

    img.onload = () => {
      const orientation =
        img.naturalHeight >= img.naturalWidth
          ? 'portrait'
          : 'landscape';

      photo.orientation = orientation;

      if (
        galleryFilter !== 'all' &&
        galleryFilter !== orientation
      ) {
        figure.remove();
      }

      updateGalleryCount();
    };

    img.onerror = () => {
      figure.remove();
      console.warn('Photo could not load:', photo.url);
      updateGalleryCount();
    };

    button.append(img);
    button.addEventListener('click', () => {
      openLightbox(photo);
    });

    const caption = document.createElement('figcaption');

    const number = document.createElement('span');
    number.textContent =
      String(index + 1).padStart(2, '0');

    const title = document.createElement('span');
    title.textContent =
      photo.name.replace(/\.[^.]+$/, '');

    caption.append(number, title);
    figure.append(button, caption);
    gallery.append(figure);

    visible++;
  });

  message.textContent = visible
    ? `${visible} portfolio photo(s)`
    : 'No photos in this category.';
}

function updateGalleryCount() {
  const visible = Array.from(
    $('portfolioGallery').children
  ).filter(element => !element.hidden).length;

  $('galleryStatus').textContent = visible
    ? `${visible} portfolio photo(s)`
    : 'No photos in this category.';
}

function openLightbox(photo) {
  $('lightboxImage').src = photo.url;
  $('lightboxCaption').textContent =
    photo.name.replace(/\.[^.]+$/, '');

  $('lightbox').hidden = false;
  document.body.style.overflow = 'hidden';
  $('closeLightbox').focus();
}

function closeLightbox() {
  $('lightbox').hidden = true;
  $('lightboxImage').removeAttribute('src');
  document.body.style.overflow = '';
}

$('closeLightbox').addEventListener(
  'click',
  closeLightbox
);

$('lightbox').addEventListener('click', event => {
  if (event.target === $('lightbox')) {
    closeLightbox();
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' &&
      !$('lightbox').hidden) {
    closeLightbox();
  }
});

document.querySelectorAll('.gallery-filter')
  .forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.gallery-filter')
        .forEach(item =>
          item.classList.remove('active')
        );

      button.classList.add('active');
      galleryFilter = button.dataset.filter;
      renderPortfolio();
    });
  });

// ==========================================
// 2. PHOTO FILTERS
// ==========================================

const filters = [
  ['Original', 0, 0, 0, 0, 0],
  ['Natural Pro', .05, .04, .06, .02, 0],
  ['Golden Hour', .10, .06, .10, .13, 0],
  ['Cool Blue', -.03, .04, -.05, -.12, 0],
  ['Vintage', -.04, -.10, -.15, .07, .12],
  ['Soft Glow', .08, -.10, -.02, .03, .07],
  ['Moody', -.10, .15, -.10, -.03, .08],
  ['Clean Pop', .06, .10, .12, 0, 0],
  ['Film 2026', -.03, .08, -.06, .05, .12],
  ['Rosé', .04, .01, .04, .08, .04],
  ['Cinematic', -.07, .16, -.08, -.07, .06],
  ['B&W', 0, .10, -1, 0, .02]
];

const adjustments = [
  ['Exposure', -100, 100],
  ['Contrast', -100, 100],
  ['Highlights', -100, 100],
  ['Shadows', -100, 100],
  ['Whites', -100, 100],
  ['Blacks', -100, 100],
  ['Saturation', -100, 100],
  ['Vibrance', -100, 100],
  ['Sharpness', 0, 100]
];

function newSettings() {
  return {
    filter: 0,
    strength: 70,
    soft: 0,
    straighten: 0,
    rotate: 0,
    ratio: 'free',
    crop: {
      x: 0,
      y: 0,
      w: 1,
      h: 1
    },
    values: Object.fromEntries(
      adjustments.map(([name]) => [name, 0])
    )
  };
}

// ==========================================
// 3. PHOTO EDITOR STATE
// ==========================================

const uploadedPhotos = [];

let selectedIndex = -1;
let exporting = false;
let cropMode = false;
let cropDrag = null;
let previewFrame = 0;
let uploadBusy = false;

const selected = () => uploadedPhotos[selectedIndex];

// ==========================================
// 4. BUILD EDITING SLIDERS
// ==========================================

function buildSliders() {
  const root = $('adjustmentSliders');
  root.replaceChildren();

  adjustments.forEach(([name, min, max]) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'slider-row';

    const label = document.createElement('label');
    label.textContent = name;

    const output = document.createElement('output');
    output.textContent = '0';

    label.append(output);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.value = 0;
    input.dataset.adjustment = name;

    input.addEventListener('input', () => {
      if (!selected()) return;

      selected().settings.values[name] =
        Number(input.value);

      output.textContent = input.value;
      updatePreview();
    });

    wrapper.append(label, input);
    root.append(wrapper);
  });
}

// ==========================================
// 5. UPLOAD PHOTOS
// ==========================================

async function addPhotos(fileList) {
  if (uploadBusy) return;

  const files = Array.from(fileList).filter(file =>
    ['image/jpeg', 'image/png', 'image/webp']
      .includes(file.type) ||
    /\.(jpe?g|png|webp)$/i.test(file.name)
  );

  if (!files.length) {
    status('Please select JPG, PNG, or WebP images.');
    return;
  }

  uploadBusy = true;
  let added = 0;
  const firstNewIndex = uploadedPhotos.length;

  status('Opening your photos...');

  try {
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const img = new Image();

      try {
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });

        if (!img.naturalWidth || !img.naturalHeight) {
          throw new Error('Invalid image dimensions');
        }

        uploadedPhotos.push({
          file,
          img,
          url,
          settings: newSettings()
        });

        added++;
      } catch (error) {
        URL.revokeObjectURL(url);
        console.error(
          'Could not open ' + file.name,
          error
        );
      }
    }

    if (added > 0) {
      selectPhoto(firstNewIndex);

      status(
        `${added} photo(s) uploaded successfully. ` +
        `${uploadedPhotos.length} total.`
      );
    } else {
      status(
        'No photos could be opened. ' +
        'Try a JPG or PNG image.'
      );
    }
  } finally {
    uploadBusy = false;
    $('photoInput').value = '';
  }
}

function selectPhoto(index) {
  if (!uploadedPhotos[index]) return;

  cropMode = false;
  selectedIndex = index;

  $('uploadPlaceholder').hidden = true;
  $('editorCanvas').hidden = false;
  $('cropOverlay').hidden = true;
  $('cropButton').textContent = 'Edit Crop';

  $('downloadOne').disabled = false;
  $('downloadAll').disabled = false;
  $('removePhoto').disabled = false;

  const photo = selected();

  $('imageInfo').textContent =
    `${photo.img.naturalWidth} × ` +
    `${photo.img.naturalHeight} · ` +
    `${index + 1}/${uploadedPhotos.length}`;

  syncControls();
}

function renderThumbnails() {
  const root = $('photoThumbnails');
  root.replaceChildren();

  uploadedPhotos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.type = 'button';

    button.className =
      'photo-thumb' +
      (index === selectedIndex ? ' active' : '');

    const image = document.createElement('img');
    image.src = photo.url;
    image.alt = photo.file.name;

    const label = document.createElement('span');
    label.textContent = photo.file.name;

    button.append(image, label);

    button.addEventListener('click', () => {
      selectPhoto(index);
    });

    root.append(button);
  });
}

// ==========================================
// 6. SYNC EDITOR CONTROLS
// ==========================================

function syncControls() {
  if (!selected()) return;

  const settings = selected().settings;

  document.querySelectorAll(
    '#adjustmentSliders input'
  ).forEach(input => {
    const value =
      settings.values[input.dataset.adjustment];

    input.value = value;

    input.previousElementSibling
      .querySelector('output')
      .textContent = value;
  });

  $('filterStrength').value = settings.strength;
  $('filterStrengthValue').textContent =
    settings.strength + '%';

  $('softening').value = settings.soft;
  $('softeningValue').textContent = settings.soft;

  $('straighten').value = settings.straighten;
  $('straightenValue').textContent =
    settings.straighten + '°';

  $('aspectRatio').value = settings.ratio;

  drawFilters();
  renderThumbnails();
  updatePreview();
}

// ==========================================
// 7. APPLY PHOTO ADJUSTMENTS
// ==========================================

function adjustPixels(canvas, settings) {
  const ctx = canvas.getContext('2d', {
    willReadFrequently: true
  });

  const width = canvas.width;
  const height = canvas.height;

  if (!width || !height) return;

  const image = ctx.getImageData(
    0, 0, width, height
  );

  const data = image.data;
  const filter = filters[settings.filter];

  const mix = settings.filter === 0
    ? 0
    : settings.strength / 100;

  const exposure =
    filter[1] * mix +
    settings.values.Exposure / 100;

  const contrast =
    filter[2] * mix +
    settings.values.Contrast / 100;

  const saturation =
    filter[3] * mix +
    settings.values.Saturation / 100;

  const warmth = filter[4] * mix;
  const fade = filter[5] * mix;

  const vibrance =
    settings.values.Vibrance / 100;

  const highlights =
    settings.values.Highlights / 100;

  const shadows =
    settings.values.Shadows / 100;

  const whites =
    settings.values.Whites / 100;

  const blacks =
    settings.values.Blacks / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255;
    let g = data[i + 1] / 255;
    let b = data[i + 2] / 255;

    const lum =
      .2126 * r +
      .7152 * g +
      .0722 * b;

    const light =
      shadows * (1 - lum) ** 2 * .42 +
      highlights * lum ** 2 * .42 +
      whites *
        Math.max(0, (lum - .55) / .45) * .28 -
      blacks *
        Math.max(0, (.45 - lum) / .45) * .28;

    r = (
      r + exposure * .48 +
      light + warmth * .17 - .5
    ) * (1 + contrast) + .5;

    g = (
      g + exposure * .48 +
      light + warmth * .018 - .5
    ) * (1 + contrast) + .5;

    b = (
      b + exposure * .48 +
      light - warmth * .17 - .5
    ) * (1 + contrast) + .5;

    const l =
      .2126 * r +
      .7152 * g +
      .0722 * b;

    const colorRange = clamp(
      Math.max(r, g, b) - Math.min(r, g, b),
      0, 1
    );

    const colorFactor = Math.max(
      0,
      1 + saturation +
      vibrance * (1 - colorRange) * .8
    );

    data[i] = clamp(
      (l + (r - l) * colorFactor) *
      (1 - fade) * 255 + fade * 127.5
    );

    data[i + 1] = clamp(
      (l + (g - l) * colorFactor) *
      (1 - fade) * 255 + fade * 127.5
    );

    data[i + 2] = clamp(
      (l + (b - l) * colorFactor) *
      (1 - fade) * 255 + fade * 127.5
    );
  }

  // Gentle smoothing and sharpening
  if (
    settings.soft > 0 ||
    settings.values.Sharpness > 0
  ) {
    const original =
      new Uint8ClampedArray(data);

    const softness =
      settings.soft / 35 * .45;

    const sharpness =
      settings.values.Sharpness / 100 * .35;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;

        for (let channel = 0; channel < 3; channel++) {
          const avg = (
            original[i + channel] +
            original[i - 4 + channel] +
            original[i + 4 + channel] +
            original[i - width * 4 + channel] +
            original[i + width * 4 + channel]
          ) / 5;

          const softened =
            original[i + channel] *
              (1 - softness) +
            avg * softness;

          data[i + channel] = clamp(
            softened +
            sharpness *
            (original[i + channel] - avg) * 4
          );
        }
      }
    }
  }

  ctx.putImageData(image, 0, 0);
}

// ==========================================
// 8. FILTER PREVIEW BUTTONS
// ==========================================

function drawFilters() {
  const root = $('filterGrid');
  root.replaceChildren();

  filters.forEach((filter, index) => {
    const button = document.createElement('button');
    button.type = 'button';

    button.className =
      'filter-tile' +
      (selected()?.settings.filter === index
        ? ' active'
        : '');

    const canvas = document.createElement('canvas');
    canvas.width = 65;
    canvas.height = 80;

    const ctx = canvas.getContext('2d');

    if (selected()) {
      const img = selected().img;

      const scale = Math.max(
        65 / img.naturalWidth,
        80 / img.naturalHeight
      );

      const sourceWidth = 65 / scale;
      const sourceHeight = 80 / scale;

      ctx.drawImage(
        img,
        (img.naturalWidth - sourceWidth) / 2,
        (img.naturalHeight - sourceHeight) / 2,
        sourceWidth,
        sourceHeight,
        0, 0, 65, 80
      );

      const settings = newSettings();
      settings.filter = index;

      adjustPixels(canvas, settings);
    } else {
      ctx.fillStyle = '#4c405c';
      ctx.fillRect(0, 0, 65, 80);
    }

    const name = document.createElement('span');
    name.textContent = filter[0];

    button.append(canvas, name);

    button.addEventListener('click', () => {
      if (!selected()) return;

      selected().settings.filter = index;
      drawFilters();
      updatePreview();
    });

    root.append(button);
  });
}

// ==========================================
// 9. ROTATION AND PHOTO RENDERING
// ==========================================

function rotatedDimensions(img, settings) {
  const quarter =
    ((settings.rotate % 4) + 4) % 4;

  return quarter % 2
    ? [img.naturalHeight, img.naturalWidth]
    : [img.naturalWidth, img.naturalHeight];
}

function makeSourceCanvas(
  img,
  settings,
  maxSide = 1100
) {
  const [rw, rh] = rotatedDimensions(
    img, settings
  );

  const scale = Math.min(
    1,
    maxSide / Math.max(rw, rh)
  );

  const width = Math.max(
    1, Math.round(rw * scale)
  );

  const height = Math.max(
    1, Math.round(rh * scale)
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');

  ctx.translate(width / 2, height / 2);

  ctx.rotate(
    settings.rotate * Math.PI / 2 +
    settings.straighten * Math.PI / 180
  );

  ctx.drawImage(
    img,
    -img.naturalWidth * scale / 2,
    -img.naturalHeight * scale / 2,
    img.naturalWidth * scale,
    img.naturalHeight * scale
  );

  return canvas;
}

function renderPhoto(
  img,
  settings,
  maxSide = 1100
) {
  const source = makeSourceCanvas(
    img, settings, maxSide
  );

  const crop = settings.crop;

  const sx = clamp(
    Math.floor(crop.x * source.width),
    0,
    source.width - 1
  );

  const sy = clamp(
    Math.floor(crop.y * source.height),
    0,
    source.height - 1
  );

  const sw = Math.max(
    1,
    Math.min(
      source.width - sx,
      Math.round(crop.w * source.width)
    )
  );

  const sh = Math.max(
    1,
    Math.min(
      source.height - sy,
      Math.round(crop.h * source.height)
    )
  );

  const output = document.createElement('canvas');
  output.width = sw;
  output.height = sh;

  output.getContext('2d').drawImage(
    source,
    sx, sy, sw, sh,
    0, 0, sw, sh
  );

  source.width = 0;
  source.height = 0;

  adjustPixels(output, settings);

  return output;
}

function updatePreview() {
  if (!selected()) return;

  if (cropMode) {
    enterCropMode();
    return;
  }

  cancelAnimationFrame(previewFrame);

  previewFrame = requestAnimationFrame(() => {
    if (!selected()) return;

    try {
      const result = renderPhoto(
        selected().img,
        selected().settings
      );

      const canvas = $('editorCanvas');
      canvas.width = result.width;
      canvas.height = result.height;

      canvas.getContext('2d').drawImage(
        result, 0, 0
      );

      result.width = 0;
      result.height = 0;
    } catch (error) {
      console.error(error);
      status('Could not render preview.');
    }
  });
}

// ==========================================
// 10. CROP TOOLS
// ==========================================

function cropForRatio(ratio) {
  if (!selected() || ratio === 'free') {
    return { x: 0, y: 0, w: 1, h: 1 };
  }

  const [width, height] = rotatedDimensions(
    selected().img,
    selected().settings
  );

  const target = Number(ratio);
  let cw = 1;
  let ch = 1;

  if (width / height > target) {
    cw = target / (width / height);
  } else {
    ch = (width / height) / target;
  }

  return {
    x: (1 - cw) / 2,
    y: (1 - ch) / 2,
    w: cw,
    h: ch
  };
}

function drawCropOverlay() {
  if (!cropMode || !selected()) {
    $('cropOverlay').hidden = true;
    return;
  }

  const overlay = $('cropOverlay');
  const canvas = $('editorCanvas');
  const stage = $('dropZone');

  const canvasRect = canvas.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();

  const crop = selected().settings.crop;

  overlay.hidden = false;

  overlay.style.left =
    canvasRect.left -
    stageRect.left +
    crop.x * canvasRect.width + 'px';

  overlay.style.top =
    canvasRect.top -
    stageRect.top +
    crop.y * canvasRect.height + 'px';

  overlay.style.width =
    crop.w * canvasRect.width + 'px';

  overlay.style.height =
    crop.h * canvasRect.height + 'px';
}

function enterCropMode() {
  if (!selected()) return;

  cropMode = true;
  cancelAnimationFrame(previewFrame);

  const source = makeSourceCanvas(
    selected().img,
    selected().settings
  );

  const canvas = $('editorCanvas');

  canvas.width = source.width;
  canvas.height = source.height;

  canvas.getContext('2d').drawImage(
    source, 0, 0
  );

  source.width = 0;
  source.height = 0;

  $('cropButton').textContent = 'Apply Crop';

  requestAnimationFrame(drawCropOverlay);
}

function exitCropMode() {
  cropMode = false;

  $('cropOverlay').hidden = true;
  $('cropButton').textContent = 'Edit Crop';

  updatePreview();
}

$('cropButton').addEventListener('click', () => {
  if (!selected()) return;

  if (cropMode) exitCropMode();
  else enterCropMode();
});

$('aspectRatio').addEventListener('change', () => {
  if (!selected()) return;

  selected().settings.ratio =
    $('aspectRatio').value;

  selected().settings.crop =
    cropForRatio($('aspectRatio').value);

  enterCropMode();
});

const cropOverlay = $('cropOverlay');

cropOverlay.addEventListener('pointerdown', event => {
  if (!selected()) return;

  event.preventDefault();

  cropOverlay.setPointerCapture(
    event.pointerId
  );

  cropDrag = {
    x: event.clientX,
    y: event.clientY,
    rect: $('editorCanvas').getBoundingClientRect(),
    crop: { ...selected().settings.crop },
    corner: [...event.target.classList]
      .find(c => ['tl', 'tr', 'bl', 'br'].includes(c))
      || null
  };
});

cropOverlay.addEventListener('pointermove', event => {
  if (!cropDrag || !selected()) return;

  const dx =
    (event.clientX - cropDrag.x) /
    cropDrag.rect.width;

  const dy =
    (event.clientY - cropDrag.y) /
    cropDrag.rect.height;

  const base = cropDrag.crop;

  let { x, y, w, h } = base;

  if (!cropDrag.corner) {
    x = clamp(x + dx, 0, 1 - w);
    y = clamp(y + dy, 0, 1 - h);
  } else {
    let left = x;
    let top = y;
    let right = x + w;
    let bottom = y + h;

    if (cropDrag.corner.includes('l')) {
      left = clamp(
        left + dx, 0, right - .05
      );
    } else {
      right = clamp(
        right + dx, left + .05, 1
      );
    }

    if (cropDrag.corner.includes('t')) {
      top = clamp(
        top + dy, 0, bottom - .05
      );
    } else {
      bottom = clamp(
        bottom + dy, top + .05, 1
      );
    }

    x = left;
    y = top;
    w = right - left;
    h = bottom - top;

    const ratio = selected().settings.ratio;

    if (ratio !== 'free') {
      const [iw, ih] = rotatedDimensions(
        selected().img,
        selected().settings
      );

      const target = Number(ratio) * ih / iw;

      h = Math.min(h, w / target);
      w = h * target;

      if (cropDrag.corner.includes('l')) {
        x = right - w;
      }

      if (cropDrag.corner.includes('t')) {
        y = bottom - h;
      }
    }
  }

  selected().settings.crop = { x, y, w, h };
  drawCropOverlay();
});

cropOverlay.addEventListener(
  'pointerup',
  () => cropDrag = null
);

cropOverlay.addEventListener(
  'pointercancel',
  () => cropDrag = null
);

// ==========================================
// 11. ROTATE AND STRAIGHTEN
// ==========================================

function rotatePhoto(direction) {
  if (!selected()) return;

  selected().settings.rotate += direction;

  selected().settings.crop = {
    x: 0, y: 0, w: 1, h: 1
  };

  exitCropMode();
}

$('rotateLeft').addEventListener(
  'click',
  () => rotatePhoto(-1)
);

$('rotateRight').addEventListener(
  'click',
  () => rotatePhoto(1)
);

for (const [id, key, output, suffix] of [
  ['filterStrength', 'strength', 'filterStrengthValue', '%'],
  ['softening', 'soft', 'softeningValue', ''],
  ['straighten', 'straighten', 'straightenValue', '°']
]) {
  $(id).addEventListener('input', () => {
    if (!selected()) return;

    selected().settings[key] =
      Number($(id).value);

    $(output).textContent =
      $(id).value + suffix;

    if (key === 'straighten') {
      selected().settings.crop = {
        x: 0, y: 0, w: 1, h: 1
      };

      exitCropMode();
    } else {
      updatePreview();
    }
  });
}

// ==========================================
// 12. RESET EDITS
// ==========================================

$('resetEdits').addEventListener('click', () => {
  if (!selected()) return;

  selected().settings = newSettings();

  cropMode = false;
  $('cropOverlay').hidden = true;
  $('cropButton').textContent = 'Edit Crop';

  syncControls();
  status('Photo edits reset.');
});

// ==========================================
// 13. WORKING PHOTO UPLOAD
// ==========================================

// The HTML label opens the native file picker.
// This handler supports keyboard activation.

$('choosePhotos').addEventListener(
  'keydown',
  event => {
    if (
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      $('photoInput').click();
    }
  }
);

$('photoInput').addEventListener(
  'change',
  event => {
    if (event.target.files.length) {
      addPhotos(event.target.files);
    }
  }
);

// Drag and drop

const dropZone = $('dropZone');

dropZone.addEventListener('dragover', event => {
  event.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', event => {
  event.preventDefault();
  dropZone.classList.remove('dragover');

  if (event.dataTransfer.files.length) {
    addPhotos(event.dataTransfer.files);
  }
});

// ==========================================
// 14. REMOVE PHOTO
// ==========================================

$('removePhoto').addEventListener('click', () => {
  if (!selected()) return;

  const removed = uploadedPhotos.splice(
    selectedIndex, 1
  )[0];

  URL.revokeObjectURL(removed.url);

  if (!uploadedPhotos.length) {
    selectedIndex = -1;
    cropMode = false;

    $('cropOverlay').hidden = true;
    $('editorCanvas').hidden = true;
    $('uploadPlaceholder').hidden = false;

    $('imageInfo').textContent =
      'No photo selected';

    [
      'downloadOne',
      'downloadAll',
      'removePhoto'
    ].forEach(id => {
      $(id).disabled = true;
    });

    renderThumbnails();
    status('All photos removed.');
    return;
  }

  selectPhoto(
    Math.min(
      selectedIndex,
      uploadedPhotos.length - 1
    )
  );
});

// ==========================================
// 15. EXPORT PHOTO
// ==========================================

function exportName(photo, index) {
  const base = photo.file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_-]/gi, '_')
    .slice(0, 60);

  return (
    String(index + 1).padStart(3, '0') +
    '_' + base + '_DAVOSHOTIT.jpg'
  );
}

async function exportPhoto(photo, settings) {
  const dimensions = rotatedDimensions(
    photo.img, settings
  );

  const longest = Math.max(...dimensions);

  // Cap large exports to reduce browser crashes.
  const maxPixels = 36000000;

  const pixelScale = Math.min(
    1,
    Math.sqrt(
      maxPixels /
      (dimensions[0] * dimensions[1])
    )
  );

  const canvas = renderPhoto(
    photo.img,
    settings,
    longest * pixelScale
  );

  const blob = await new Promise(resolve => {
    canvas.toBlob(
      resolve,
      'image/jpeg',
      .93
    );
  });

  canvas.width = 0;
  canvas.height = 0;

  if (!blob) {
    throw new Error('Could not export JPEG');
  }

  return blob;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 30000);
}

// ==========================================
// 16. DOWNLOAD ONE PHOTO
// ==========================================

$('downloadOne').addEventListener(
  'click',
  async () => {
    if (!selected() || exporting) return;

    exporting = true;
    $('downloadOne').disabled = true;

    try {
      status('Exporting photo...');
      await wait();

      const photo = selected();

      const blob = await exportPhoto(
        photo,
        photo.settings
      );

      saveBlob(
        blob,
        exportName(photo, selectedIndex)
      );

      status('Photo downloaded successfully.');
    } catch (error) {
      console.error(error);

      status(
        'Export failed. Try a smaller image.'
      );
    } finally {
      exporting = false;
      $('downloadOne').disabled = false;
    }
  }
);

// ==========================================
// 17. DOWNLOAD ALL PHOTOS AS ZIP
// ==========================================

$('downloadAll').addEventListener(
  'click',
  async () => {
    if (!uploadedPhotos.length || exporting) {
      return;
    }

    if (typeof JSZip === 'undefined') {
      status(
        'ZIP library unavailable. ' +
        'Check your internet connection.'
      );
      return;
    }

    exporting = true;

    $('downloadAll').disabled = true;
    $('exportProgress').hidden = false;
    $('progressFill').style.width = '0%';

    const zip = new JSZip();

    const sharedSettings = clone(
      selected().settings
    );

    let completed = 0;

    try {
      for (
        let i = 0;
        i < uploadedPhotos.length;
        i++
      ) {
        const photo = uploadedPhotos[i];

        status(
          `Processing ${i + 1} of ` +
          `${uploadedPhotos.length} photos...`
        );

        await wait();

        try {
          const settings =
            $('applyToAll').checked
              ? sharedSettings
              : photo.settings;

          const blob = await exportPhoto(
            photo,
            settings
          );

          zip.file(
            exportName(photo, i),
            blob
          );

          completed++;
        } catch (error) {
          console.error(
            'Failed to export ' + photo.file.name,
            error
          );
        }

        $('progressFill').style.width =
          Math.round(
            (i + 1) /
            uploadedPhotos.length * 75
          ) + '%';
      }

      if (!completed) {
        throw new Error(
          'No photos were exported'
        );
      }

      status('Creating ZIP file...');

      const blob = await zip.generateAsync(
        {
          type: 'blob',
          compression: 'STORE'
        },
        progress => {
          $('progressFill').style.width =
            (
              75 +
              Math.round(progress.percent * .25)
            ) + '%';
        }
      );

      saveBlob(
        blob,
        'DAVOSHOTIT_Edited_Photos.zip'
      );

      status(
        `ZIP downloaded with ${completed} photos.`
      );
    } catch (error) {
      console.error(error);

      status(
        'ZIP export failed. Try fewer photos.'
      );
    } finally {
      exporting = false;
      $('downloadAll').disabled = false;

      setTimeout(() => {
        $('exportProgress').hidden = true;
        $('progressFill').style.width = '0%';
      }, 1200);
    }
  }
);

// ==========================================
// 18. RESPONSIVE CROP OVERLAY
// ==========================================

window.addEventListener('resize', () => {
  if (cropMode) {
    drawCropOverlay();
  }
});

// ==========================================
// 19. START DAVOSHOTIT STUDIO
// ==========================================

renderPortfolio();
buildSliders();
drawFilters();

console.log(
  'DAVOSHOTIT Studio 2026 Pro loaded successfully.'
);
