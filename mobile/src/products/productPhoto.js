export const PRODUCT_PHOTO_MAX_BYTES = 50 * 1024;
export const PRODUCT_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this image.')); };
    image.src = url;
  });
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not prepare this image.')), 'image/jpeg', quality));
}

function drawSquare(image, size, crop) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image cropping is not supported on this device.');
  context.fillStyle = '#fff'; context.fillRect(0, 0, size, size);
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight) * crop.zoom;
  const width = image.naturalWidth * scale; const height = image.naturalHeight * scale;
  context.drawImage(image, -(width - size) * ((crop.x + 100) / 200), -(height - size) * ((crop.y + 100) / 200), width, height);
  return canvas;
}

export async function cropProductPhoto(file, crop = { zoom: 1, x: 0, y: 0 }) {
  if (!PRODUCT_PHOTO_ACCEPT.split(',').includes(file?.type)) throw new Error('Choose a JPG, PNG or WebP image.');
  if (file.size > 15 * 1024 * 1024) throw new Error('The original image must be 15 MB or smaller.');
  const image = await loadImage(file);
  for (const size of [512, 448, 384, 320, 256, 192]) {
    const canvas = drawSquare(image, size, crop);
    for (const quality of [0.86, 0.74, 0.62, 0.5, 0.4, 0.3, 0.22]) {
      const blob = await canvasBlob(canvas, quality);
      if (blob.size <= PRODUCT_PHOTO_MAX_BYTES) return new File([blob], 'product-photo.jpg', { type: 'image/jpeg', lastModified: Date.now() });
    }
  }
  throw new Error('Could not compress the photo below 50 KB.');
}
