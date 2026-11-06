try {
  const theme = localStorage.getItem("creatorconnect-theme");
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  }
} catch {
  // Keep the default light theme if browser storage is unavailable.
}
