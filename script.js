
'use strict';

const $ = id => document.getElementById(id);

const looks = [
  ['Original', 0, 0, 0, 0, 0],
  ['Natural Pro', .06, .05, .06, .02, 0],
  ['Golden Hour', .12, .08, .12, .10, 0],
  ['Cool Blue', -.05, .04, -.08, -.13, 0],
  ['Vintage', -.06, -.13, -.14, .09, .12],
  ['Soft Glow', .10, -.12, -.03, .04, .08],
  ['Moody', -.12, .15, -.12, -.04, .08],
  ['Clean Pop', .08, .12, .14, 0, 0],
  ['Film 2026', -.04, .10, -.07, .06, .16],
  ['Rosé', .05, .02, .06, .08, .06],
  ['Cinematic', -.08, .18, -.08, -.07, .06],
  ['B&W', 0, .10, -1, 0, .02]
];

const controls = [
  ['Exposure', -100, 100, 0],
  ['Contrast', -100, 100, 0],
  ['Highlights', -100, 100, 0],
  ['Shadows', -100, 100, 0],
  ['Whites', -100, 100, 0],
  ['Blacks', -100, 100, 0],
  ['Saturation', -100, 100, 0],
  ['Vibrance', -100, 100, 0],
  ['Sharpness', 0, 100, 0]
];

const settings = Object.fromEntries(
  controls.map(c => [c[0], c[3]])
);

let image = null;
let selected = 0;
let strength = 75;
let renderTicket = 0;

const main = $('mainCanvas');

const clamp = (n, a = 0, b = 255) =>
  Math.max(a, Math.min(b, n));

function renderPixels(canvas, src, w, h, filterIdx) {
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d', {
    willReadFrequently: true
  });

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const p = img.data;

  const f = looks[filterIdx];
  const mix = filterIdx === 0 ? 0 : strength / 100;

  const exp = f[1] * mix + settings.Exposure / 100;
  const contrast = f[2] * mix + settings.Contrast / 100;
  const sat = f[3] * mix + settings.Saturation / 100;
  const warm = f[4] * mix;
  const fade = f[5] * mix;
  const vibr = settings.Vibrance / 100;

  const high = settings.Highlights / 100;
  const shadows = settings.Shadows / 100;
  const whites = settings.Whites / 100;
  const blacks = settings.Blacks / 100;

  const contrastFactor = Math.max(.1, 1 + contrast);

  for (let i = 0; i < p.length; i += 4) {
    let r = p[i] / 255;
    let g = p[i + 1] / 255;
    let b = p[i + 2] / 255;

    const lum = .2126 * r + .7152 * g + .0722 * b;
    const shadowWeight = (1 - lum) ** 2;
    const highWeight = lum ** 2;

    const adjustment =
      shadows * shadowWeight * .42 +
      high * highWeight * .42 +
      whites * Math.max(0, (lum - .55) / .45) * .28 +
      blacks * Math.max(0, (.45 - lum) / .45) * -.28;

    r += exp * .48 + adjustment + warm * .17;
    g += exp * .48 + adjustment + warm * .018;
    b += exp * .48 + adjustment - warm * .17;

    r = (r - .5) * contrastFactor + .5;
    g = (g - .5) * contrastFactor + .5;
    b = (b - .5) * contrastFactor + .5;

    const l = .2126 * r + .7152 * g + .0722 * b;
    const colorfulness =
      Math.max(r, g, b) - Math.min(r, g, b);

    const saturationFactor = Math.max(
      0,
      1 + sat +
      vibr * (1 - clamp(colorfulness, 0, 1)) * .8
    );

    r = l + (r - l) * saturationFactor;
    g = l + (g - l) * saturationFactor;
    b = l + (b - l) * saturationFactor;

    p[i] = clamp((r * (1 - fade) + .5 * fade) * 255);
    p[i + 1] = clamp((g * (1 - fade) + .5 * fade) * 255);
    p[i + 2] = clamp((b * (1 - fade) + .5 * fade) * 255);
  }

  if (settings.Sharpness > 0) {
    const original = new Uint8ClampedArray(p);
    const amt = settings.Sharpness / 100 * .48;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;

        for (let c = 0; c < 3; c++) {
          p[i + c] = clamp(
            original[i + c] +
            amt * (
              4 * original[i + c] -
              original[i - 4 + c] -
              original[i + 4 + c] -
              original[i - w * 4 + c] -
              original[i + w * 4 + c]
            )
          );
        }
      }
    }
  }

  ctx.putImageData(img, 0, 0);
}

function draw() {
  if (!image) return;

  const max = 1100;
  const factor = Math.min(
    1,
    max / Math.max(
      image.naturalWidth,
      image.naturalHeight
    )
  );

  renderPixels(
    main,
    image,
    Math.max(1, Math.round(image.naturalWidth * factor)),
    Math.max(1, Math.round(image.naturalHeight * factor)),
    selected
  );
}

function thumbnails() {
  const root = $('filters');
  root.replaceChildren();

  looks.forEach((look, i) => {
    const btn = document.createElement('button');

    btn.type = 'button';
    btn.className =
      'filter' + (i === selected ? ' selected' : '');

    btn.setAttribute(
      'aria-pressed',
      String(i === selected)
    );

    btn.title = look[0];

    const c = document.createElement('canvas');
    c.width = 80;
    c.height = 100;

    if (image) {
      const iw = image.naturalWidth;
      const ih = image.naturalHeight;

      const scale = Math.max(80 / iw, 100 / ih);
      const sw = 80 / scale;
      const sh = 100 / scale;
      const sx = (iw - sw) / 2;
      const sy = (ih - sh) / 2;

      const crop = document.createElement('canvas');
      crop.width = 80;
      crop.height = 100;

      crop.getContext('2d').drawImage(
        image, sx, sy, sw, sh, 0, 0, 80, 100
      );

      renderPixels(c, crop, 80, 100, i);
    } else {
      const ctx = c.getContext('2d');

      const grad = ctx.createLinearGradient(
        0, 0, 80, 100
      );

      grad.addColorStop(0, [
        '#6b5b84',
        '#b39f87',
        '#c58d5a',
        '#526e9d',
        '#988471',
        '#d6b2bc',
        '#45445e',
        '#ac88a9',
        '#736d67',
        '#b484a5',
        '#34435e',
        '#777777'
      ][i]);

      grad.addColorStop(1, '#151321');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 80, 100);
    }

    const label = document.createElement('span');
    label.textContent = look[0];

    btn.append(c, label);

    btn.addEventListener('click', () => {
      selected = i;
      schedule();
    });

    root.append(btn);
  });
}

function schedule() {
  cancelAnimationFrame(renderTicket);

  renderTicket = requestAnimationFrame(() => {
    draw();
    thumbnails();
  });
}

function initControls() {
  const root = $('sliders');

  controls.forEach(([name, min, max, value]) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'control';

    const head = document.createElement('div');
    head.className = 'control-head';

    const label = document.createElement('label');
    label.textContent = name;

    const id = 'slider' + name;
    label.htmlFor = id;

    const out = document.createElement('output');
    out.textContent = String(value);

    head.append(label, out);

    const input = document.createElement('input');

    input.type = 'range';
    input.min = min;
    input.max = max;
    input.value = value;
    input.id = id;

    input.addEventListener('input', () => {
      settings[name] = Number(input.value);
      out.textContent = input.value;
      draw();
    });

    wrapper.append(head, input);
    root.append(wrapper);
  });
}

function resetSliders() {
  controls.forEach(([name, , , def]) => {
    settings[name] = def;

    const slider = $('slider' + name);
    slider.value = def;

    slider.previousElementSibling
      .querySelector('output').textContent = def;
  });

  draw();
}

function loadFile(file) {
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    $('status').textContent =
      'Please select an image.';
    return;
  }

  if (file.size > 40 * 1024 * 1024) {
    $('status').textContent =
      'This file is over 40 MB.';
    return;
  }

  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    URL.revokeObjectURL(url);

    image = img;
    selected = 0;
    strength = 75;

    $('strength').value = 75;
    $('strengthValue').textContent = '75%';

    resetSliders();

    $('empty').hidden = true;
    main.hidden = false;

    $('resolution').textContent =
      img.naturalWidth + ' × ' + img.naturalHeight;

    $('download').disabled = false;

    $('status').textContent =
      'Photo ready — choose a filter.';

    schedule();
  };

  img.onerror = () => {
    URL.revokeObjectURL(url);
    $('status').textContent =
      'Could not open this photo.';
  };

  img.src = url;
}

$('choose').addEventListener('click', () => {
  $('file').click();
});

$('file').addEventListener('change', e => {
  loadFile(e.target.files[0]);
});

$('strength').addEventListener('input', e => {
  strength = Number(e.target.value);
  $('strengthValue').textContent = strength + '%';
  schedule();
});

$('resetSliders').addEventListener(
  'click',
  resetSliders
);

$('reset').addEventListener('click', () => {
  selected = 0;
  strength = 75;

  $('strength').value = 75;
  $('strengthValue').textContent = '75%';

  resetSliders();
  schedule();
});

const stage = $('stage');

stage.addEventListener('dragover', e => {
  e.preventDefault();
  stage.classList.add('drag');
});

stage.addEventListener('dragleave', () => {
  stage.classList.remove('drag');
});

stage.addEventListener('drop', e => {
  e.preventDefault();
  stage.classList.remove('drag');

  loadFile(e.dataTransfer.files[0]);
});

$('download').addEventListener('click', async () => {
  if (!image) return;

  const btn = $('download');
  btn.disabled = true;

  $('status').textContent =
    'Rendering full-resolution photo…';

  await new Promise(resolve => setTimeout(resolve, 20));

  try {
    const full = document.createElement('canvas');

    renderPixels(
      full,
      image,
      image.naturalWidth,
      image.naturalHeight,
      selected
    );

    const blob = await new Promise(resolve => {
      full.toBlob(resolve, 'image/jpeg', .95);
    });

    if (!blob) {
      throw new Error('Export failed');
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = 'DAVOSHOTIT_2026_edit.jpg';

    document.body.append(a);
    a.click();
    a.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 2000);

    $('status').textContent =
      'Export complete — full resolution JPEG.';

  } catch (err) {
    $('status').textContent =
      'Export failed. Try a smaller image.';

    console.error(err);

  } finally {
    btn.disabled = false;
  }
});

initControls();
thumbnails();
