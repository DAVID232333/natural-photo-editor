
"use strict";

const $ = id => document.getElementById(id);

const controls = {
  exposure: ["Exposure", -100, 100, 0],
  contrast: ["Contrast", -100, 100, 0],
  highlights: ["Highlights", -100, 100, 0],
  shadows: ["Shadows", -100, 100, 0],
  saturation: ["Saturation", -100, 100, 0],
  temperature: ["Temperature", -100, 100, 0],
  clarity: ["Clarity", 0, 100, 15]
};

const presets = {
  natural: [0, 0, 0, 0, 0, 0, 15],
  portrait: [8, 4, -15, 12, -3, 3, 8],
  golden: [8, 8, -18, 8, 10, 18, 12],
  cinematic: [-5, 18, -25, 8, -12, -5, 20],
  night: [12, 8, -20, 24, 3, -4, 10]
};

let photos = [];
let activeIndex = 0;
let renderToken = 0;
let uploadToken = 0;

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

const maxPixels = 35000000;

// CREATE EDITING SLIDERS

Object.entries(controls).forEach(([id, config]) => {
  const [name, min, max, value] = config;

  const wrapper = document.createElement("div");

  wrapper.innerHTML = `
    <label for="${id}">
      ${name} <span id="${id}Value">${value}</span>
    </label>
    <input type="range" id="${id}"
      min="${min}" max="${max}" value="${value}">
  `;

  $("sliders").appendChild(wrapper);

  wrapper.querySelector("input").addEventListener(
    "input",
    event => {
      $(`${id}Value`).textContent = event.target.value;
      scheduleRender();
    }
  );
});

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function settings() {
  const result = {};

  Object.keys(controls).forEach(id => {
    result[id] = Number($(id).value);
  });

  result.strength = Number($("strength").value);
  result.skin = $("skin").checked;
  result.sharpen = $("sharpen").checked;
  result.ratio = $("ratio").value;
  result.angle = Number($("angle").value);

  return result;
}

function setControl(id, value) {
  $(id).value = value;

  const display = $(`${id}Value`);

  if (display) {
    display.textContent = value;
  }
}

// PRESETS

$("preset").addEventListener("change", () => {
  const values = presets[$("preset").value];

  Object.keys(controls).forEach((id, index) => {
    setControl(id, values[index]);
  });

  scheduleRender();
});

$("strength").addEventListener("input", () => {
  $("strengthValue").textContent = $("strength").value;
  scheduleRender();
});

$("angle").addEventListener("input", () => {
  $("angleValue").textContent = $("angle").value;
  scheduleRender();
});

["skin", "sharpen", "ratio"].forEach(id => {
  $(id).addEventListener("change", scheduleRender);
});

$("enhanceBtn").addEventListener("click", scheduleRender);

// RESET EDITS

$("resetBtn").addEventListener("click", () => {
  $("preset").value = "natural";

  Object.keys(controls).forEach(id => {
    setControl(id, controls[id][3]);
  });

  setControl("strength", 35);
  setControl("angle", 0);

  $("strengthValue").textContent = "35";
  $("angleValue").textContent = "0";

  $("skin").checked = true;
  $("sharpen").checked = true;
  $("ratio").value = "original";

  scheduleRender();
});

// PRIVATE PHOTO UPLOAD

const uploadInput = $("upload");
const dropZone = $("dropZone");

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Cannot open image"));
    };

    img.src = url;
  });
}

async function handleFiles(files) {
  const token = ++uploadToken;
  const validFiles = Array.from(files).filter(
    file => allowedTypes.includes(file.type)
  );

  // Invalidate previous preview work.
  renderToken++;

  photos = [];
  activeIndex = 0;

  $("gallery").innerHTML = "";
  $("downloadBtn").disabled = true;
  $("batchBtn").disabled = true;

  const preview = $("editedCanvas");
  preview.width = 0;
  preview.height = 0;

  if (!validFiles.length) {
    $("status").textContent = "No supported photos selected";
    return;
  }

  $("status").textContent = "Loading photos...";

  const loaded = [];

  for (const file of validFiles) {
    if (token !== uploadToken) return;

    try {
      const img = await loadImage(file);

      if (token !== uploadToken) return;

      if (img.naturalWidth * img.naturalHeight > maxPixels) {
        console.warn("Photo too large:", file.name);
        continue;
      }

      loaded.push({ file, img });
    } catch (error) {
      console.error(error);
    }
  }

  if (token !== uploadToken) return;

  photos = loaded;

  buildGallery();

  const hasPhotos = photos.length > 0;

  $("downloadBtn").disabled = !hasPhotos;
  $("batchBtn").disabled = !hasPhotos;

  if (hasPhotos) {
    scheduleRender();
  } else {
    $("status").textContent = "No supported photos loaded";
  }
}

uploadInput.addEventListener("change", event => {
  handleFiles(event.target.files);
});

// DRAG AND DROP

dropZone.addEventListener("dragover", event => {
  event.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", event => {
  if (!dropZone.contains(event.relatedTarget)) {
    dropZone.classList.remove("dragover");
  }
});

dropZone.addEventListener("drop", event => {
  event.preventDefault();
  dropZone.classList.remove("dragover");

  handleFiles(event.dataTransfer.files);
});

// CLEAR PRIVATE PHOTOS

$("clearPhotosBtn").addEventListener("click", () => {
  uploadToken++;
  renderToken++;

  photos = [];
  activeIndex = 0;

  uploadInput.value = "";
  $("gallery").innerHTML = "";

  const canvas = $("editedCanvas");
  canvas.width = 0;
  canvas.height = 0;

  $("downloadBtn").disabled = true;
  $("batchBtn").disabled = true;

  $("status").textContent = "Your photos have been cleared.";
});

// UPLOADED PHOTO GALLERY

function buildGallery() {
  const gallery = $("gallery");
  gallery.innerHTML = "";

  photos.forEach((photo, index) => {
    const button = document.createElement("button");
    button.type = "button";

    const thumb = document.createElement("img");
    thumb.src = photo.img.src;
    thumb.alt = photo.file.name;

    const name = document.createElement("small");
    name.textContent = photo.file.name;

    button.append(thumb, name);

    if (index === activeIndex) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      activeIndex = index;
      buildGallery();
      scheduleRender();
    });

    gallery.appendChild(button);
  });
}

// CROP AND STRAIGHTEN

function getSourceCanvas(img, s) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const rotated = document.createElement("canvas");
  rotated.width = w;
  rotated.height = h;

  const ctx = rotated.getContext("2d");
  const radians = s.angle * Math.PI / 180;

  const zoom =
    Math.abs(Math.cos(radians)) +
    Math.abs(Math.sin(radians)) * Math.max(w / h, h / w);

  ctx.translate(w / 2, h / 2);
  ctx.rotate(radians);
  ctx.scale(zoom, zoom);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);

  if (s.ratio === "original") {
    return rotated;
  }

  const ratio = Number(s.ratio);
  const originalRatio = w / h;

  let cropW = w;
  let cropH = h;

  if (originalRatio > ratio) {
    cropW = Math.round(h * ratio);
  } else {
    cropH = Math.round(w / ratio);
  }

  const cropped = document.createElement("canvas");
  cropped.width = cropW;
  cropped.height = cropH;

  cropped.getContext("2d").drawImage(
    rotated,
    Math.floor((w - cropW) / 2),
    Math.floor((h - cropH) / 2),
    cropW,
    cropH,
    0,
    0,
    cropW,
    cropH
  );

  return cropped;
}

// PHOTO ENHANCEMENT

function processImage(img, s) {
  const original = getSourceCanvas(img, s);

  const output = document.createElement("canvas");
  output.width = original.width;
  output.height = original.height;

  const ctx = output.getContext("2d", {
    willReadFrequently: true
  });

  ctx.drawImage(original, 0, 0);

  const frame = ctx.getImageData(
    0, 0, output.width, output.height
  );

  const d = frame.data;
  const strength = s.strength / 100;

  // Estimate brightness.
  let total = 0;
  let count = 0;

  for (let i = 0; i < d.length; i += 160) {
    total += (
      0.2126 * d[i] +
      0.7152 * d[i + 1] +
      0.0722 * d[i + 2]
    );

    count++;
  }

  const average = count ? total / count : 128;

  const autoExposure = Math.max(
    -12,
    Math.min(12, (128 - average) * 0.20)
  );

  const exposure =
    autoExposure * strength + s.exposure * 0.35;

  const contrast = 1 + (s.contrast / 100) * 0.45;
  const saturation = 1 + (s.saturation / 100) * 0.45;
  const temperature = s.temperature * 0.18;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    const luminance = (
      0.2126 * r +
      0.7152 * g +
      0.0722 * b
    ) / 255;

    const shadowWeight = Math.pow(1 - luminance, 2);
    const highlightWeight = Math.pow(luminance, 2);

    const tonal =
      s.shadows * shadowWeight * 0.45 +
      s.highlights * highlightWeight * 0.45;

    r += exposure + tonal + temperature;
    g += exposure + tonal;
    b += exposure + tonal - temperature;

    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    // Reduce aggressive color changes on skin-like pixels.
    const skinLike =
      r > 55 &&
      r > g * 1.06 &&
      g > b * 0.88 &&
      r - b > 12;

    const colorFactor =
      s.skin && skinLike
        ? 1 + (saturation - 1) * 0.3
        : saturation;

    const gray =
      0.299 * r + 0.587 * g + 0.114 * b;

    r = gray + (r - gray) * colorFactor;
    g = gray + (g - gray) * colorFactor;
    b = gray + (b - gray) * colorFactor;

    d[i] = clamp(r);
    d[i + 1] = clamp(g);
    d[i + 2] = clamp(b);
  }

  ctx.putImageData(frame, 0, 0);

  // Gentle sharpening.
  const amount = s.sharpen
    ? (s.clarity / 100) * strength * 0.4
    : 0;

  if (amount > 0) {
    const blurCanvas = document.createElement("canvas");
    blurCanvas.width = output.width;
    blurCanvas.height = output.height;

    const blurCtx = blurCanvas.getContext("2d", {
      willReadFrequently: true
    });

    blurCtx.filter = "blur(1px)";
    blurCtx.drawImage(output, 0, 0);

    const sharp = ctx.getImageData(
      0, 0, output.width, output.height
    );

    const blurred = blurCtx.getImageData(
      0, 0, output.width, output.height
    );

    for (let i = 0; i < sharp.data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const difference =
          sharp.data[i + c] - blurred.data[i + c];

        if (Math.abs(difference) > 3) {
          sharp.data[i + c] = clamp(
            sharp.data[i + c] + amount * difference
          );
        }
      }
    }

    ctx.putImageData(sharp, 0, 0);
  }

  return output;
}

// RENDER PREVIEW

function scheduleRender() {
  const token = ++renderToken;

  setTimeout(() => {
    if (token === renderToken) {
      renderCurrent();
    }
  }, 100);
}

function renderCurrent() {
  if (!photos.length) return;

  $("status").textContent = "Editing...";

  try {
    const photo = photos[activeIndex];
    const output = processImage(photo.img, settings());

    const canvas = $("editedCanvas");
    canvas.width = output.width;
    canvas.height = output.height;

    canvas.getContext("2d").drawImage(output, 0, 0);

    $("status").textContent =
      `${output.width} × ${output.height} pixels`;
  } catch (error) {
    console.error(error);
    $("status").textContent = "Editing failed";
  }
}

// DOWNLOAD HELPERS

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Export failed"));
    }, "image/png");
  });
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// DOWNLOAD SINGLE PHOTO

$("downloadBtn").addEventListener("click", async () => {
  if (!photos.length) return;

  const button = $("downloadBtn");
  button.disabled = true;
  button.textContent = "Preparing download...";

  try {
    const photo = photos[activeIndex];
    const output = processImage(photo.img, settings());
    const blob = await canvasBlob(output);

    saveBlob(blob, "DAVOSHOTIT_Enhanced.png");
    $("status").textContent = "Download ready!";
  } catch (error) {
    console.error(error);
    alert("Download failed: " + error.message);
  } finally {
    button.disabled = photos.length === 0;
    button.textContent = "Download Photo";
  }
});

// DOWNLOAD ALL AS ZIP

$("batchBtn").addEventListener("click", async () => {
  if (!photos.length) return;

  if (typeof JSZip === "undefined") {
    alert("ZIP library failed to load.");
    return;
  }

  const button = $("batchBtn");
  button.disabled = true;

  try {
    const zip = new JSZip();
    const s = settings();

    // Snapshot the current selection.
    const selectedPhotos = [...photos];

    for (let i = 0; i < selectedPhotos.length; i++) {
      $("status").textContent =
        `Processing ${i + 1} of ${selectedPhotos.length}`;

      const output = processImage(selectedPhotos[i].img, s);
      const blob = await canvasBlob(output);

      const base = selectedPhotos[i].file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-z0-9_-]/gi, "_");

      zip.file(`${i + 1}_${base}_edited.png`, blob);

      await new Promise(resolve => setTimeout(resolve, 0));
    }

    $("status").textContent = "Creating ZIP...";

    const archive = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 3 }
    });

    saveBlob(archive, "DAVOSHOTIT_Photo_Edits.zip");
    $("status").textContent = "Batch complete!";
  } catch (error) {
    console.error(error);
    alert("Batch processing failed. Try fewer photos.");
    $("status").textContent = "Batch failed";
  } finally {
    button.disabled = photos.length === 0;
  }
});

// PUBLIC PORTFOLIO LIGHTBOX

const portfolioItems = [
  ...document.querySelectorAll(".portfolio-photo")
];

const lightbox = $("lightbox");
const lightboxImage = $("lightboxImage");

let currentPortfolioIndex = 0;
let previousFocus = null;

function showPortfolioPhoto(index) {
  if (!portfolioItems.length) return;

  currentPortfolioIndex =
    (index + portfolioItems.length) % portfolioItems.length;

  const item = portfolioItems[currentPortfolioIndex];

  lightboxImage.src = item.dataset.image;
  lightboxImage.alt = item.querySelector("img").alt;
}

function openLightbox(index) {
  previousFocus = document.activeElement;
  showPortfolioPhoto(index);

  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
  $("closeLightbox").focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = "";
  lightboxImage.removeAttribute("src");

  if (previousFocus) previousFocus.focus();
}

portfolioItems.forEach((item, index) => {
  item.addEventListener("click", () => {
    openLightbox(index);
  });
});

$("closeLightbox").addEventListener("click", closeLightbox);

$("prevPhoto").addEventListener("click", () => {
  showPortfolioPhoto(currentPortfolioIndex - 1);
});

$("nextPhoto").addEventListener("click", () => {
  showPortfolioPhoto(currentPortfolioIndex + 1);
});

lightbox.addEventListener("click", event => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});

document.addEventListener("keydown", event => {
  if (lightbox.hidden) return;

  if (event.key === "Escape") closeLightbox();

  if (event.key === "ArrowLeft") {
    showPortfolioPhoto(currentPortfolioIndex - 1);
  }

  if (event.key === "ArrowRight") {
    showPortfolioPhoto(currentPortfolioIndex + 1);
  }

  // Keep keyboard focus inside the open viewer.
  if (event.key === "Tab") {
    const buttons = [
      $("closeLightbox"),
      $("prevPhoto"),
      $("nextPhoto")
    ];

    const current = buttons.indexOf(document.activeElement);

    if (event.shiftKey && current === 0) {
      event.preventDefault();
      buttons[2].focus();
    } else if (!event.shiftKey && current === 2) {
      event.preventDefault();
      buttons[0].focus();
    }
  }
});

