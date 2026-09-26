const deck = document.getElementById('deck')
const slides = Array.from(document.querySelectorAll('.Slide'))
const video = document.querySelector('.Slide-video')

const TOTAL = slides.length
const TRANSITION_MS = 900

// Wheel/touch delta needed to scrub the video from its first to its last
// frame. Lower = a shorter scroll gesture covers the whole clip.
const SCRUB_DISTANCE = 2200
const EASE = 0.18
const SETTLE_THRESHOLD = 1 / 120

let currentIndex = 0
let isTransitioning = false

let videoDuration = 0
let videoTarget = 0 // 0-1, where the wheel wants the video's playhead
let videoDisplayed = 0 // 0-1, eased toward videoTarget every frame
let videoLooping = false

// Every slide's resting position is defined purely by its distance from
// currentIndex (mod TOTAL): 0 = active/front, -1 = receded/behind,
// everything else = parked off-screen left, ready to be pulled in.
function syncRoles () {
  slides.forEach((el, i) => {
    const rel = ((i - currentIndex) % TOTAL + TOTAL) % TOTAL
    el.classList.toggle('is-active', rel === 0)
    el.classList.toggle('is-receded', rel === TOTAL - 1)
  })
}

function goTo (index) {
  isTransitioning = true
  currentIndex = ((index % TOTAL) + TOTAL) % TOTAL
  syncRoles()

  setTimeout(() => {
    isTransitioning = false
  }, TRANSITION_MS)
}

// --- Video scrub (slide 0 only) ---------------------------------------

video.addEventListener('loadedmetadata', () => {
  videoDuration = video.duration || 0
  videoDisplayed = video.currentTime
  video.play().then(() => video.pause()).catch(() => {})
  startVideoLoop()
})

function videoRenderLoop () {
  const diff = videoTarget - videoDisplayed

  if (Math.abs(diff) > SETTLE_THRESHOLD) {
    videoDisplayed += diff * EASE
    video.currentTime = videoDisplayed * videoDuration
  }

  requestAnimationFrame(videoRenderLoop)
}

function startVideoLoop () {
  if (videoLooping) return
  videoLooping = true
  videoRenderLoop()
}

function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// Snaps the video's playhead immediately (no easing) instead of letting the
// render loop catch up over time — used when re-entering slide 0, since a
// visible seek at that moment reads as "the video reset", not a scrub.
function resetVideoTo (progress) {
  videoTarget = progress
  videoDisplayed = progress
  video.currentTime = progress * videoDuration
}

// --- Input: wheel and touch, converted into either a video scrub or a
// slide transition depending on where we are in the deck. -------------

function handleDelta (dy) {
  if (isTransitioning) return

  const onVideoSlide = currentIndex === 0 && videoDuration > 0

  if (onVideoSlide) {
    if (dy > 0 && videoTarget < 1) {
      videoTarget = clamp(videoTarget + dy / SCRUB_DISTANCE, 0, 1)
      return
    }
    if (dy < 0 && videoTarget > 0) {
      videoTarget = clamp(videoTarget + dy / SCRUB_DISTANCE, 0, 1)
      return
    }
  }

  if (dy > 0) {
    // Leaving slide 0 forward always starts from a finished video; wrapping
    // back around to slide 0 restarts it from the beginning.
    goTo(currentIndex + 1)
    if (currentIndex === 0) {
      resetVideoTo(0)
    }
  } else if (dy < 0) {
    goTo(currentIndex - 1)
    if (currentIndex === 0) {
      resetVideoTo(1)
    }
  }
}

window.addEventListener('wheel', (e) => {
  e.preventDefault()
  handleDelta(e.deltaY)
}, { passive: false })

let touchStartY = null

window.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY
}, { passive: true })

window.addEventListener('touchmove', (e) => {
  if (touchStartY === null) return
  e.preventDefault()

  const y = e.touches[0].clientY
  const dy = touchStartY - y
  touchStartY = y
  handleDelta(dy * 2.2)
}, { passive: false })

window.addEventListener('touchend', () => {
  touchStartY = null
})

requestAnimationFrame(() => {
  deck.classList.add('is-ready')
})
