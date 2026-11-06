
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
let uploadToken = 0;
let renderToken = 0;
let renderTimer = null;
let busy = false;

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

const maxPixels = 35000000;

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function setStatus(message) {
  $("status").textContent = message;
}

function setDownloadButtons() {
  $("downloadBtn").disabled = busy || photos.length === 0;
  $("batchBtn").disabled = busy || photos.length === 0;
}

// CREATE EDITING CONTROLS

Object.entries(controls).forEach(([id, config]) => {
  const [label, min, max, initial] = config;
  const wrapper = document.createElement("div");

  const text = document.createElement("label");
  text.htmlFor = id;
  text.textContent = label + " ";

  const value = document.createElement("span");
  value.id = id + "Value";
  value.textContent = initial;
  text.appendChild(value);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.id = id;
  slider.min = min;
  slider.max = max;
  slider.value = initial;

  slider.addEventListener("input", () => {
    value.textContent = slider.value;
    scheduleRender();
  });

  wrapper.append(text, slider);
  $("sliders").appendChild(wrapper);
});

function setControl(id, value) {
  $(id).value = value;

  const display = $(id + "Value");
  if (display) display.textContent = value;
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

// PRESETS AND SLIDERS

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

$("resetBtn").addEventListener("click", () => {
  $("preset").value = "natural";

  Object.keys(controls).forEach(id => {
    setControl(id, controls[id][3]);
  });

  $("strength").value = 35;
  $("strengthValue").textContent = 35;

  $("angle").value = 0;
  $("angleValue").textContent = 0;

  $("skin").checked = true;
  $("sharpen").checked = true;
  $("ratio").value = "original";

  scheduleRender();
});

// PRIVATE VISITOR PHOTO UPLOAD

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({
        file,
        image,
        url
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load " + file.name));
    };

    image.src = url;
  });
}

function releasePhotos() {
  photos.forEach(photo => {
    URL.revokeObjectURL(photo.url);
  });

  photos = [];
  activeIndex = 0;
}

function clearPreview() {
  const canvas = $("editedCanvas");
  canvas.width = 0;
  canvas.height = 0;
}

async function handleFiles(fileList) {
  const token = ++uploadToken;
  const selected = Array.from(fileList).filter(file =>
    allowedTypes.includes(file.type)
  );

  clearTimeout(renderTimer);
  renderToken++;
  releasePhotos();
  clearPreview();

  $("gallery").innerHTML = "";
  setDownloadButtons();

  if (!selected.length) {
    setStatus("Please choose JPG, PNG or WebP photos.");
    return;
  }

  setStatus("Loading photos...");

  const loaded = [];

  for (const file of selected) {
    if (token !== uploadToken) break;

    try {
      const photo = await loadImage(file);

      if (token !== uploadToken) {
        URL.revokeObjectURL(photo.url);
        break;
      }

      const pixels =
        photo.image.naturalWidth *
        photo.image.naturalHeight;

      if (pixels > maxPixels) {
        URL.revokeObjectURL(photo.url);
        console.warn("Image too large:", file.name);
        continue;
      }

      loaded.push(photo);
    } catch (error) {
      console.error(error);
    }
  }

  if (token !== uploadToken) {
    loaded.forEach(photo => URL.revokeObjectURL(photo.url));
    return;
  }

  photos = loaded;
  buildGallery();
  setDownloadButtons();

  if (photos.length) {
    scheduleRender();
  } else {
    setStatus("No photos could be loaded.");
  }
}

$("upload").addEventListener("change", event => {
  handleFiles(event.target.files);
});

// DRAG AND DROP

const dropZone = $("dropZone");

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

  if (event.dataTransfer.files.length) {
    $("upload").value = "";
    handleFiles(event.dataTransfer.files);
  }
});

// CLEAR UPLOADED PHOTOS

$("clearPhotosBtn").addEventListener("click", () => {
  uploadToken++;
  renderToken++;
  clearTimeout(renderTimer);

  releasePhotos();
  clearPreview();

  $("upload").value = "";
  $("gallery").innerHTML = "";

  setDownloadButtons();
  setStatus("Your photos have been cleared.");
});

// PRIVATE UPLOAD GALLERY

function buildGallery() {
  const gallery = $("gallery");
  gallery.innerHTML = "";

  photos.forEach((photo, index) => {
    const button = document.createElement("button");
    button.type = "button";

    if (index === activeIndex) {
      button.classList.add("active");
    }

    const image = document.createElement("img");
    image.src = photo.url;
    image.alt = photo.file.name;

    const label = document.createElement("small");
    label.textContent = photo.file.name;

    button.append(image, label);

    button.addEventListener("click", () => {
      activeIndex = index;
      buildGallery();
      scheduleRender();
    });

    gallery.appendChild(button);
  });
});

// CROP AND STRAIGHTEN

function prepareCanvas(image, s) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;

  const rotated = document.createElement("canvas");
  rotated.width = width;
  rotated.height = height;

  const ctx = rotated.getContext("2d");
  const radians = s.angle * Math.PI / 180;

  const zoom =
    Math.abs(Math.cos(radians)) +
    Math.abs(Math.sin(radians)) *
    Math.max(width / height, height / width);

  ctx.translate(width / 2, height / 2);
  ctx.rotate(radians);
  ctx.scale(zoom, zoom);
  ctx.drawImage(
    image,
    -width / 2,
    -height / 2,
    width,
    height
  );

  if (s.ratio === "original") {
    return rotated;
  }

  const ratio = Number(s.ratio);
  let cropWidth = width;
  let cropHeight = height;

  if (width / height > ratio) {
    cropWidth = Math.round(height * ratio);
  } else {
    cropHeight = Math.round(width / ratio);
  }

  const cropped = document.createElement("canvas");
  cropped.width = cropWidth;
  cropped.height = cropHeight;

  cropped.getContext("2d").drawImage(
    rotated,
    Math.floor((width - cropWidth) / 2),
    Math.floor((height - cropHeight) / 2),
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );

  return cropped;
}

// NATURAL PHOTO ENHANCEMENT

function processImage(image, s) {
  const canvas = prepareCanvas(image, s);

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  const frame = ctx.getImageData(
    0, 0, canvas.width, canvas.height
  );

  const data = frame.data;
  const strength = s.strength / 100;

  // Estimate average brightness.
  let total = 0;
  let samples = 0;

  for (let i = 0; i < data.length; i += 160) {
    total +=
      0.2126 * data[i] +
      0.7152 * data[i + 1] +
      0.0722 * data[i + 2];

    samples++;
  }

  const average = samples ? total / samples : 128;

  const autoExposure = Math.max(
    -12,
    Math.min(12, (128 - average) * 0.20)
  );

  const exposure =
    autoExposure * strength +
    s.exposure * 0.35;

  const contrast = 1 + s.contrast * 0.0045;
  const saturation = 1 + s.saturation * 0.0045;
  const warmth = s.temperature * 0.18;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    const light = (
      0.2126 * r +
      0.7152 * g +
      0.0722 * b
    ) / 255;

    const shadowWeight = (1 - light) ** 2;
    const highlightWeight = light ** 2;

    const tonal =
      s.shadows * shadowWeight * 0.45 +
      s.highlights * highlightWeight * 0.45;

    r += exposure + tonal + warmth;
    g += exposure + tonal;
    b += exposure + tonal - warmth;

    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    // Gentle color adjustment for skin-like colors.
    const skinLike =
      r > 55 &&
      r > g * 1.06 &&
      g > b * 0.88 &&
      r - b > 12;

    const colorFactor = s.skin && skinLike
      ? 1 + (saturation - 1) * 0.3
      : saturation;

    const gray =
      0.299 * r +
      0.587 * g +
      0.114 * b;

    data[i] = clamp(gray + (r - gray) * colorFactor);
    data[i + 1] = clamp(gray + (g - gray) * colorFactor);
    data[i + 2] = clamp(gray + (b - gray) * colorFactor);
  }

  ctx.putImageData(frame, 0, 0);

  // Optional gentle sharpening.
  const amount = s.sharpen
    ? s.clarity / 100 * strength * 0.4
    : 0;

  if (amount > 0) {
    const blurred = document.createElement("canvas");
    blurred.width = canvas.width;
    blurred.height = canvas.height;

    const blurCtx = blurred.getContext("2d", {
      willReadFrequently: true
    });

    blurCtx.filter = "blur(1px)";
    blurCtx.drawImage(canvas, 0, 0);

    const sharp = ctx.getImageData(
      0, 0, canvas.width, canvas.height
    );

    const soft = blurCtx.getImageData(
      0, 0, canvas.width, canvas.height
    );

    for (let i = 0; i < sharp.data.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) {
        const difference =
          sharp.data[i + channel] -
          soft.data[i + channel];

        if (Math.abs(difference) > 3) {
          sharp.data[i + channel] = clamp(
            sharp.data[i + channel] +
            amount * difference
          );
        }
      }
    }

    ctx.putImageData(sharp, 0, 0);
  }

  return canvas;
}

// PHOTO PREVIEW

function scheduleRender() {
  clearTimeout(renderTimer);
  const token = ++renderToken;

  renderTimer = setTimeout(() => {
    if (token === renderToken) {
      renderCurrent();
    }
  }, 120);
}

function renderCurrent() {
  if (!photos.length) return;

  setStatus("Editing photo...");

  try {
    const photo = photos[activeIndex];
    const result = processImage(photo.image, settings());

    const preview = $("editedCanvas");
    preview.width = result.width;
    preview.height = result.height;

    preview.getContext("2d").drawImage(result, 0, 0);

    setStatus(`${result.width} × ${result.height} pixels`);
  } catch (error) {
    console.error(error);
    setStatus("Could not edit this photo.");
  }
}

// DOWNLOAD HELPERS

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Photo export failed."));
      }
    }, "image/png");
  });
}

function saveFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10000);
}

// DOWNLOAD ONE PHOTO

$("downloadBtn").addEventListener("click", async () => {
  if (!photos.length || busy) return;

  busy = true;
  setDownloadButtons();

  try {
    setStatus("Preparing your download...");

    const photo = photos[activeIndex];
    const result = processImage(photo.image, settings());
    const blob = await canvasToBlob(result);

    const filename = photo.file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9_-]/gi, "_");

    saveFile(blob, `${filename}_DAVOSHOTIT.png`);
    setStatus("Photo downloaded!");
  } catch (error) {
    console.error(error);
    setStatus("Download failed.");
    alert(error.message);
  } finally {
    busy = false;
    setDownloadButtons();
  }
});

// DOWNLOAD ALL PHOTOS AS ZIP

$("batchBtn").addEventListener("click", async () => {
  if (!photos.length || busy) return;

  if (typeof JSZip === "undefined") {
    alert("ZIP download library did not load.");
    return;
  }

  busy = true;
  setDownloadButtons();

  try {
    const zip = new JSZip();
    const currentSettings = settings();
    const selectedPhotos = [...photos];

    for (let i = 0; i < selectedPhotos.length; i++) {
      const photo = selectedPhotos[i];

      setStatus(
        `Editing photo ${i + 1} of ${selectedPhotos.length}`
      );

      const result = processImage(
        photo.image,
        currentSettings
      );

      const blob = await canvasToBlob(result);

      const name = photo.file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-z0-9_-]/gi, "_");

      zip.file(
        `${i + 1}_${name}_DAVOSHOTIT.png`,
        blob
      );

      await new Promise(resolve => setTimeout(resolve, 0));
    }

    setStatus("Creating ZIP file...");

    const archive = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 3 }
    });

    saveFile(archive, "DAVOSHOTIT_Edited_Photos.zip");
    setStatus("All photos downloaded!");
  } catch (error) {
    console.error(error);
    setStatus("Batch download failed.");
    alert("Try downloading fewer photos at once.");
  } finally {
    busy = false;
    setDownloadButtons();
  }
});

// FULL-SCREEN PUBLIC PORTFOLIO

const portfolioItems = [
  ...document.querySelectorAll(".portfolio-photo")
];

const lightbox = $("lightbox");
const lightboxImage = $("lightboxImage");

let portfolioIndex = 0;
let previousFocus = null;

function showPortfolioPhoto(index) {
  if (!portfolioItems.length) return;

  portfolioIndex =
    (index + portfolioItems.length) % portfolioItems.length;

  const item = portfolioItems[portfolioIndex];

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
  lightboxImage.removeAttribute("src");

  document.body.style.overflow = "";

  if (previousFocus) {
    previousFocus.focus();
  }
}

portfolioItems.forEach((item, index) => {
  item.addEventListener("click", () => {
    openLightbox(index);
  });
});

$("closeLightbox").addEventListener("click", closeLightbox);

$("prevPhoto").addEventListener("click", () => {
  showPortfolioPhoto(portfolioIndex - 1);
});

$("nextPhoto").addEventListener("click", () => {
  showPortfolioPhoto(portfolioIndex + 1);
});

lightbox.addEventListener("click", event => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});

document.addEventListener("keydown", event => {
  if (lightbox.hidden) return;

  if (event.key === "Escape") {
    closeLightbox();
  }

  if (event.key === "ArrowLeft") {
    showPortfolioPhoto(portfolioIndex - 1);
  }

  if (event.key === "ArrowRight") {
    showPortfolioPhoto(portfolioIndex + 1);
  }

  if (event.key === "Tab") {
    const buttons = [
      $("closeLightbox"),
      $("prevPhoto"),
      $("nextPhoto")
    ];

    const current = buttons.indexOf(document.activeElement);

    if (event.shiftKey && current === 0) {
      event.preventDefault();
      buttons[buttons.length - 1].focus();
    } else if (
      !event.shiftKey &&
      current === buttons.length - 1
    ) {
      event.preventDefault();
      buttons[0].focus();
    }
  }
});
