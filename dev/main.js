const fold = document.querySelector('.Fold')
const video = document.querySelector('.Fold-video')
const progressBar = document.querySelector('.Fold-progress')
const scrollHint = document.querySelector('.Fold-scrollHint')

let duration = 0
let targetTime = 0
let displayedTime = 0
let looping = false

// How fast the displayed frame catches up to the scroll target each frame.
// Lower = smoother/laggier, higher = snappier/closer to a direct 1:1 scrub.
const EASE = 0.18
const SETTLE_THRESHOLD = 1 / 120 // don't bother seeking for sub-frame deltas

// Some mobile browsers (notably iOS Safari) refuse to seek a <video> via
// currentTime until it has been played at least once. Priming it with a
// silent play/pause right after the metadata loads unlocks scrubbing
// without ever visibly autoplaying.
video.addEventListener('loadedmetadata', () => {
  duration = video.duration || 0
  displayedTime = video.currentTime

  video.play()
    .then(() => video.pause())
    .catch(() => {
      // Autoplay was blocked entirely; scrubbing will still work once the
      // user interacts with the page (e.g. by scrolling).
    })

  readScrollTarget()
  startLoop()
})

// Reads the scroll position and updates what frame we're aiming for. Runs on
// every scroll/resize event, cheap enough to call directly (no rAF gate
// needed here since the actual video writes happen in the render loop).
function readScrollTarget () {
  if (!duration) return

  const rect = fold.getBoundingClientRect()
  const scrollableDistance = rect.height - window.innerHeight

  // How far we've scrolled into the fold, 0 at its top, 1 once its sticky
  // video has been fully scrolled past.
  const progress = scrollableDistance > 0
    ? clamp(-rect.top / scrollableDistance, 0, 1)
    : 0

  targetTime = progress * duration
  progressBar.style.width = (progress * 100) + '%'
  scrollHint.classList.toggle('is-hidden', progress > 0.02)
}

// Runs every animation frame (up to display refresh rate) rather than only
// on scroll events, and eases the video's currentTime toward the scroll
// target instead of snapping straight to it. That's what makes fast or
// jerky scrolling read as a smooth scrub instead of a slideshow of frames.
function renderLoop () {
  const diff = targetTime - displayedTime

  if (Math.abs(diff) > SETTLE_THRESHOLD) {
    displayedTime += diff * EASE
    video.currentTime = displayedTime
  }

  requestAnimationFrame(renderLoop)
}

function startLoop () {
  if (looping) return
  looping = true
  renderLoop()
}

function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value))
}

window.addEventListener('scroll', readScrollTarget, { passive: true })
window.addEventListener('resize', readScrollTarget)
