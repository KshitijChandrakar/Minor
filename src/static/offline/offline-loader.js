if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./static/offline/service-worker.js")
      .then(() => {
        console.log("Offline support enabled");
      })
      .catch((err) => {
        console.log("Service worker error:", err);
      });
  });
}

