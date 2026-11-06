
const upload = document.getElementById("upload");
const strengthSlider = document.getElementById("strength");
const strengthValue = document.getElementById("strengthValue");
const sharpenCheckbox = document.getElementById("sharpen");
const enhanceBtn = document.getElementById("enhanceBtn");
const downloadBtn = document.getElementById("downloadBtn");
const originalPreview = document.getElementById("originalPreview");
const canvas = document.getElementById("editedCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

let originalImage = null;
let imageURL = null;

strengthSlider.addEventListener("input", () => {
  strengthValue.textContent = strengthSlider.value;
});

upload.addEventListener("change", () => {
  const file = upload.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please select a valid image.");
    return;
  }

  if (imageURL) URL.revokeObjectURL(imageURL);

  imageURL = URL.createObjectURL(file);

  const img = new Image();

  img.onload = () => {
    originalImage = img;
    originalPreview.src = imageURL;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    ctx.drawImage(img, 0, 0);

    downloadBtn.disabled = true;
  };

  img.onerror = () => {
    alert("Could not open this image.");
    originalImage = null;
  };

  img.src = imageURL;
});

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function getBrightness(data) {
  let total = 0;
  let count = 0;

  // Sample pixels to improve performance
  for (let i = 0; i < data.length; i += 40) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    total += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    count++;
  }

  return count ? total / count : 128;
}

function autoEnhance() {
  if (!originalImage) {
    alert("Upload a picture first!");
    return;
  }

  enhanceBtn.disabled = true;
  enhanceBtn.textContent = "Enhancing...";

  // Allow the browser to display the loading state
  setTimeout(() => {
    try {
      const width = originalImage.naturalWidth;
      const height = originalImage.naturalHeight;

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(originalImage, 0, 0);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const strength = Number(strengthSlider.value) / 100;

      const brightness = getBrightness(data);

      // Conservative automatic exposure correction
      const exposureAdjustment =
        Math.max(-18, Math.min(18, (125 - brightness) * 0.25))
        * strength;

      // Gentle contrast
      const contrast = 1 + 0.18 * strength;

      // Gentle color boost
      const saturation = 1 + 0.12 * strength;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Exposure
        r += exposureAdjustment;
        g += exposureAdjustment;
        b += exposureAdjustment;

        // Contrast
        r = (r - 128) * contrast + 128;
        g = (g - 128) * contrast + 128;
        b = (b - 128) * contrast + 128;

        // Saturation
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        r = gray + (r - gray) * saturation;
        g = gray + (g - gray) * saturation;
        b = gray + (b - gray) * saturation;

        data[i] = clamp(r);
        data[i + 1] = clamp(g);
        data[i + 2] = clamp(b);
      }

      ctx.putImageData(imageData, 0, 0);

      // Gentle sharpening using an offscreen canvas
      if (sharpenCheckbox.checked && strength > 0) {
        const editedCopy = document.createElement("canvas");
        editedCopy.width = width;
        editedCopy.height = height;

        const copyCtx = editedCopy.getContext("2d");
        copyCtx.drawImage(canvas, 0, 0);

        ctx.save();

        ctx.filter = "blur(1px)";
        ctx.drawImage(editedCopy, 0, 0);

        ctx.filter = "none";

        // Overlay a subtle high-pass effect
        ctx.globalAlpha = Math.min(0.12, strength * 0.2);
        ctx.globalCompositeOperation = "overlay";
        ctx.drawImage(editedCopy, 0, 0);

        ctx.restore();
      }

      downloadBtn.disabled = false;

      alert("Your photo has been enhanced!");

    } catch (error) {
      console.error(error);
      alert("Something went wrong while editing the photo.");
    } finally {
      enhanceBtn.disabled = false;
      enhanceBtn.textContent = "Auto Enhance Photo";
    }
  }, 50);
}

enhanceBtn.addEventListener("click", autoEnhance);

downloadBtn.addEventListener("click", () => {
  if (downloadBtn.disabled) return;

  canvas.toBlob((blob) => {
    if (!blob) {
      alert("Unable to export the image.");
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "Natural_Enhanced_Photo.png";
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
});

