if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').then(function(registration) {
      console.log('ServiceWorker registration successful');
    }).catch(function(err) {
      console.error('ServiceWorker registration failed:', err);
    });
  });

  // The fetch listener below was incorrect and has been removed.
  // Service worker fetch interception is handled within sw.js itself.
}