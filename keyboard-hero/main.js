(() => {
  // Each scene: the colour the photo's edges melt into, the text colour on
  // top of it, the accent glow behind the keyboard and the fog colour used
  // while crossing into or out of it.
  const SCENES = [
    { tint: [22, 22, 28], ink: [244, 245, 247], accent: [170, 110, 255], fog: [58, 60, 78], line: [255, 255, 255, 0.2] },
    { tint: [182, 196, 202], ink: [22, 30, 36], accent: [110, 220, 255], fog: [232, 243, 247], line: [20, 40, 52, 0.28] },
    { tint: [128, 136, 150], ink: [20, 24, 32], accent: [255, 160, 110], fog: [214, 220, 228], line: [20, 24, 32, 0.24] }
  ]
  const COUNT = SCENES.length
  // Scroll distance (in viewport heights) spent on each scene change.
  const STEP_VH = 140

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const root = document.documentElement
  const hero = document.querySelector('.Hero')
  const sceneImgs = [...document.querySelectorAll('.Hero-scene')]
  const kbImgs = [...document.querySelectorAll('.Product-kb')]
  const items = [...document.querySelectorAll('.Product-item')]
  const moods = [...document.querySelectorAll('.Mood-word')]
  const cta = document.querySelector('.Product-cta')
  const counters = [...document.querySelectorAll('.Pager-current span')]
  const bars = [...document.querySelectorAll('.Pager-bars button')]
  const hint = document.querySelector('.Hint')
  const fogCanvas = document.querySelector('.Hero-fog')

  hero.style.height = `calc(${(COUNT - 1) * STEP_VH}vh + 100vh)`

  /* ------------------------------------------------------------ Scroll */

  let lenis = null
  if (!reduceMotion && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.07, wheelMultiplier: 0.85, touchMultiplier: 1.2, smoothWheel: true })
  }

  let trackTop = 0
  let trackLen = 1
  function measure () {
    trackTop = hero.getBoundingClientRect().top + window.scrollY
    trackLen = Math.max(1, hero.offsetHeight - window.innerHeight)
    fog.resize()
  }

  const scrollY = () => (lenis ? lenis.scroll : window.scrollY)

  // 0 … COUNT-1, straight from the scroll position.
  function rawProgress () {
    return clamp((scrollY() - trackTop) / trackLen, 0, 1) * (COUNT - 1)
  }

  function scrollToScene (index, duration = 1.4) {
    const y = trackTop + (index / (COUNT - 1)) * trackLen
    if (lenis) lenis.scrollTo(y, { duration, easing: easeInOutCubic })
    else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  bars.forEach((bar, i) => bar.addEventListener('click', () => scrollToScene(i)))

  window.addEventListener('keydown', (e) => {
    const y = scrollY()
    if (y < trackTop - 2 || y > trackTop + trackLen - 2) return
    const cur = Math.round(rawProgress())
    if (['ArrowDown', 'PageDown', ' '].includes(e.key) && cur < COUNT - 1) {
      e.preventDefault(); scrollToScene(cur + 1)
    } else if (['ArrowUp', 'PageUp'].includes(e.key) && cur > 0) {
      e.preventDefault(); scrollToScene(cur - 1)
    }
  })

  /* ------------------------------------------------------------ Pointer */

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1
  }, { passive: true })

  /* --------------------------------------------------------------- Fog */

  // Soft procedural clouds drawn on a half-resolution canvas. They idle as
  // a faint mist and swell to cover the frame mid-transition, which hides
  // the moment where one photo hands over to the next.
  const fog = (() => {
    const ctx = fogCanvas.getContext('2d')
    const SCALE = 0.5
    let w = 0
    let h = 0

    function makePuff (size, seed) {
      const c = document.createElement('canvas')
      c.width = c.height = size
      const g = c.getContext('2d')
      const rand = mulberry32(seed)
      for (let i = 0; i < 26; i++) {
        const a = rand() * Math.PI * 2
        const d = Math.pow(rand(), 0.7) * size * 0.24
        const x = size / 2 + Math.cos(a) * d * 1.5
        const y = size / 2 + Math.sin(a) * d * 0.62
        const r = size * (0.1 + rand() * 0.16)
        const grad = g.createRadialGradient(x, y, 0, x, y, r)
        grad.addColorStop(0, 'rgba(255,255,255,0.32)')
        grad.addColorStop(0.55, 'rgba(255,255,255,0.12)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = grad
        g.beginPath()
        g.arc(x, y, r, 0, Math.PI * 2)
        g.fill()
      }
      return c
    }

    const sprites = [0, 1, 2, 3].map((i) => makePuff(320, 11 + i * 97))
    const rand = mulberry32(7)
    // depth 0 = far and slow, 1 = near, big and fast.
    const puffs = Array.from({ length: 18 }, (_, i) => {
      const depth = rand()
      return {
        sprite: sprites[i % sprites.length],
        x: rand() * 1.6 - 0.3,
        y: i < 6 ? 0.78 + rand() * 0.3 : rand() * 1.1 - 0.05,
        size: 0.45 + depth * 0.75,
        speed: 0.004 + depth * 0.012,
        depth,
        floor: i < 6
      }
    })

    function resize () {
      w = fogCanvas.width = Math.ceil(window.innerWidth * SCALE)
      h = fogCanvas.height = Math.ceil(window.innerHeight * SCALE)
    }

    function draw (time, amount, drift, color) {
      ctx.clearRect(0, 0, w, h)
      if (amount < 0.005) return
      ctx.globalCompositeOperation = 'source-over'
      for (const p of puffs) {
        // Floor mist is always there a little; the rest only rolls in
        // during a transition.
        const alpha = p.floor ? 0.35 + amount * 0.65 : amount
        if (alpha < 0.01) continue
        const span = 1.6
        let x = (p.x + time * p.speed + drift * (0.25 + p.depth * 0.6)) % span
        if (x < 0) x += span
        x -= 0.3
        const size = p.size * Math.max(w, h) * (0.85 + amount * 0.35)
        ctx.globalAlpha = alpha * (0.55 + p.depth * 0.45)
        ctx.drawImage(p.sprite, x * w - size / 2, p.y * h - size / 2, size, size)
      }
      // Tint everything we just drew in one pass.
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-in'
      ctx.fillStyle = `rgb(${color[0] | 0},${color[1] | 0},${color[2] | 0})`
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
    }

    return { resize, draw }
  })()

  /* ------------------------------------------------------------ Render */

  let shown = 0 // eased progress actually being rendered
  let intro = reduceMotion ? 0 : 1 // 1 → 0 once images are ready
  let ready = false
  let lastTime = performance.now()

  function render (now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000)
    lastTime = now

    if (lenis) lenis.raf(now)

    // Lenis already eases wheel input, so follow it closely; the light
    // ease only matters for native input such as touch or a scrollbar drag.
    const target = rawProgress()
    shown = reduceMotion ? target : damp(shown, target, lenis ? 18 : 9, dt)
    if (Math.abs(shown - target) < 0.0005) shown = target

    // A short hold on each scene, then a long, even crossfade through the
    // middle 80% of every scroll step.
    const i = Math.min(COUNT - 2, Math.floor(shown))
    const local = shown - i
    const e = smoothstep(0.1, 0.9, local)
    const s = i + e

    pointer.x = damp(pointer.x, pointer.tx, 3, dt)
    pointer.y = damp(pointer.y, pointer.ty, 3, dt)
    setVar('--mx', pointer.x.toFixed(3))
    setVar('--my', pointer.y.toFixed(3))

    if (ready) intro = reduceMotion ? 0 : damp(intro, 0, 1.5, dt)

    applyColours(i, e)
    renderScenes(i, e)
    renderProduct(s)
    renderPager(s, i, e)

    hint.classList.toggle('is-hidden', scrollY() > trackTop + 40)

    if (!reduceMotion) {
      const transition = Math.pow(Math.sin(Math.PI * e), 1.4)
      const amount = Math.max(intro, 0.08 + transition * 0.92)
      fog.draw(now / 1000, amount, s * 0.35, lerpArr(SCENES[i].fog, SCENES[i + 1].fog, e))
    }

    requestAnimationFrame(render)
  }

  function applyColours (i, e) {
    const a = SCENES[i]
    const b = SCENES[i + 1]
    const tint = lerpArr(a.tint, b.tint, e)
    const ink = lerpArr(a.ink, b.ink, e)
    const accent = lerpArr(a.accent, b.accent, e)
    const line = lerpArr(a.line, b.line, e)
    setVar('--tint', rgb(tint))
    setVar('--ink', rgb(ink))
    setVar('--ink-soft', rgb(ink, 0.62))
    setVar('--accent', rgb(accent))
    setVar('--line', rgb(line, line[3]))
  }

  function renderScenes (i, e) {
    sceneImgs.forEach((img, k) => {
      let opacity = 0
      let scale = 1
      let blur = 0
      let y = 0
      if (k === i) {
        // Outgoing: drifts back and softens under the incoming one.
        opacity = 1
        scale = 1 + e * 0.07
        blur = e * 5
        y = -e * 1.5
      } else if (k === i + 1) {
        // Incoming: settles in from slightly closer and out of focus.
        opacity = easeInOutCubic(e)
        scale = 1.1 - e * 0.1
        blur = (1 - e) * 7
        y = (1 - e) * 1.5
      }
      if (k === i + 1 && e === 0) opacity = 0
      // On load the first photo resolves out of the fog.
      opacity *= 1 - intro * 0.85
      scale += intro * 0.14
      blur += intro * 12
      css(img).opacity = opacity.toFixed(4)
      css(img).zIndex = k === i + 1 ? 2 : 1
      css(img).transform = `translate3d(0, ${y.toFixed(3)}%, 0) scale(${scale.toFixed(4)})`
      css(img).filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none'
      css(img).visibility = opacity > 0 ? 'visible' : 'hidden'
    })
  }

  function renderProduct (s) {
    const t = performance.now() / 1000
    kbImgs.forEach((img, k) => {
      const d = s - k // <0 upcoming, >0 leaving
      const ad = Math.abs(d)
      const opacity = clamp(1 - ad * 1.6, 0, 1)
      const bob = Math.sin(t * 1.1 + k) * 4 * (1 - Math.min(1, ad))
      const y = -d * 70 + bob
      const x = d * -18
      const rotX = d * 38
      const rotZ = d * -4
      const scale = 1 - ad * 0.12
      css(img).opacity = opacity.toFixed(4)
      css(img).transform =
        `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotateX(${rotX.toFixed(2)}deg) rotateZ(${rotZ.toFixed(2)}deg) scale(${scale.toFixed(4)})`
      css(img).filter = `drop-shadow(0 18px 22px rgba(0,0,0,${(0.35 * opacity).toFixed(3)})) blur(${(ad * 6).toFixed(2)}px)`
      css(img).visibility = opacity > 0 ? 'visible' : 'hidden'
    })

    // Product copy and the mood word above the headline roll together.
    ;[items, moods].forEach((list) => list.forEach((el, k) => {
      const d = s - k
      const ad = Math.abs(d)
      css(el).opacity = clamp(1 - ad * 1.8, 0, 1).toFixed(4)
      css(el).transform = `translate3d(0, ${(-d * 110).toFixed(2)}%, 0)`
      css(el).filter = ad > 0.01 ? `blur(${(ad * 4).toFixed(2)}px)` : 'none'
    }))
  }

  function renderPager (s, i, e) {
    const href = items[Math.round(s)].dataset.href
    if (cta.getAttribute('href') !== href) cta.setAttribute('href', href)
    counters.forEach((el, k) => {
      css(el).transform = `translate3d(0, ${((k - s) * 100).toFixed(2)}%, 0)`
    })
    bars.forEach((bar, k) => {
      const fill = clamp(1 - Math.abs(s - k), 0, 1)
      css(bar.firstElementChild).transform = `scaleX(${fill.toFixed(4)})`
      bar.setAttribute('aria-current', Math.round(s) === k ? 'true' : 'false')
    })
  }

  /* ------------------------------------------------------------- Utils */

  // Only touch the DOM when a value actually changes, so idle frames and
  // settled elements cost nothing.
  const written = new Map()
  function setVar (name, value) {
    if (written.get(name) === value) return
    written.set(name, value)
    root.style.setProperty(name, value)
  }
  const proxies = new WeakMap()
  function css (el) {
    let p = proxies.get(el)
    if (!p) {
      const last = {}
      p = new Proxy({}, {
        set (_, prop, value) {
          if (last[prop] !== value) { last[prop] = value; el.style[prop] = value }
          return true
        }
      })
      proxies.set(el, p)
    }
    return p
  }

  function clamp (v, min, max) { return Math.min(max, Math.max(min, v)) }
  function damp (a, b, lambda, dt) { return a + (b - a) * (1 - Math.exp(-lambda * dt)) }
  function smoothstep (a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)
  }
  function easeInOutCubic (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
  function lerpArr (a, b, t) { return a.map((v, k) => v + (b[k] - v) * t) }
  function rgb (c, alpha) {
    const base = `${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}`
    return alpha === undefined ? `rgb(${base})` : `rgba(${base}, ${alpha.toFixed(3)})`
  }
  function mulberry32 (seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
      return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
  }

  /* -------------------------------------------------------------- Boot */

  measure()
  window.addEventListener('resize', measure)

  // Warm every image before revealing so the first transition never
  // stalls on a decode.
  const all = [...sceneImgs, ...kbImgs]
  Promise.all(all.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())))
    .then(() => {
      ready = true
      requestAnimationFrame(() => document.body.classList.remove('is-loading'))
    })

  requestAnimationFrame(render)
})()
