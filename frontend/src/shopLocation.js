export function captureDeviceLocation() {
  if (!navigator.geolocation) return Promise.reject(new Error("Location access is unavailable in this browser. Use a browser with location support."));
  if (window.isSecureContext === false) return Promise.reject(new Error("Location access requires HTTPS or localhost."));
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(({ coords }) => {
    resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy });
  }, (error) => {
    const message = error.code === 1 ? "Location permission was denied. Allow location in your browser site settings, then try again."
      : error.code === 3 ? "Location request timed out. Check your device location settings and try again."
        : "Your current location could not be determined. Enable device location and try again.";
    reject(Object.assign(new Error(message), { code: error.code }));
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }));
}
