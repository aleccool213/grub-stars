// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Check for updates periodically
      setInterval(() => registration.update(), 60 * 60 * 1000); // hourly
    }).catch((error) => {
      console.error('SW registration failed:', error);
    });
  });
}
