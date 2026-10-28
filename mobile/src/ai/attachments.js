export const attachmentAccept = '.csv,text/csv,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
export const isImageFile = file => /\.(jpe?g|png|webp)$/i.test(file.name);
export function attachmentError(file) {
  return (!/\.csv$/i.test(file.name) && !isImageFile(file)) || file.size > 5242880
    ? 'Choose a JPEG, PNG, WebP image or UTF-8 CSV up to 5 MB.' : '';
}
