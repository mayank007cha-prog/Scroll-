const fold = document.querySelector('.Fold')
const video = document.querySelector('.Fold-video')
const progressBar = document.querySelector('.Fold-progress')
const scrollHint = document.querySelector('.Fold-scrollHint')

let duration = 0
let ticking = false

// Some mobile browsers (notably iOS Safari) refuse to seek a <video> via
// currentTime until it has been played at least once. Priming it with a
// silent play/pause right after the metadata loads unlocks scrubbing
// without ever visibly autoplaying.
video.addEventListener('loadedmetadata', () => {
  duration = video.duration || 0

  video.play()
    .then(() => video.pause())
    .catch(() => {
      // Autoplay was blocked entirely; scrubbing will still work once the
      // user interacts with the page (e.g. by scrolling).
    })

  update()
})

function update () {
  ticking = false

  if (!duration) return

  const rect = fold.getBoundingClientRect()
  const scrollableDistance = rect.height - window.innerHeight

  // How far we've scrolled into the fold, 0 at its top, 1 once its sticky
  // video has been fully scrolled past.
  const progress = scrollableDistance > 0
    ? clamp(-rect.top / scrollableDistance, 0, 1)
    : 0

  video.currentTime = progress * duration
  progressBar.style.width = (progress * 100) + '%'
  scrollHint.classList.toggle('is-hidden', progress > 0.02)
}

function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function onScroll () {
  if (ticking) return
  ticking = true
  requestAnimationFrame(update)
}

window.addEventListener('scroll', onScroll, { passive: true })
window.addEventListener('resize', onScroll)
