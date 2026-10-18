// Applies the saved theme and text settings before first paint (no inline script, CSP-safe).
;(function () {
  try {
    var root = document.documentElement
    var theme = JSON.parse(localStorage.getItem('unsent:theme') || '"system"')
    var resolved = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
    root.dataset.theme = resolved
    var display = JSON.parse(localStorage.getItem('unsent:display') || 'null')
    if (display && display.textSize) root.dataset.textSize = display.textSize
    if (display && display.readingFont) root.dataset.readingFont = display.readingFont
  } catch (e) {
    /* storage unavailable: the OS colour scheme applies */
  }
})()
