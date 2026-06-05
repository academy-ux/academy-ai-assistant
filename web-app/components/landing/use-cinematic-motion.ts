'use client'

import { useEffect, type RefObject } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Cinematic motion engine for the signed-out landing page.
 *
 * Built on the GSAP + ScrollTrigger + Lenis motion system. The one wrinkle vs.
 * a vanilla setup: the app shell scrolls inside <main> (body is overflow-hidden),
 * so Lenis and ScrollTrigger are pointed at that element as a custom scroller
 * instead of the window. Everything is scoped to a gsap.context() so React route
 * changes revert cleanly.
 *
 * Markup contract (data attributes):
 *   data-motion-text="lines" | "words"   masked staggered text reveal
 *   data-reveal-group / data-reveal-item  staggered group reveal
 *   data-reveal="fade-up|blur-in|scale|slide-left|slide-right"
 *   data-image-reveal                     clip-path media reveal
 *   data-parallax-section / data-parallax-layer[ data-parallax-speed]
 *   data-sticky-stack / data-stack-card   sticky card stack with depth
 *   data-magnetic[ data-magnetic-strength] data-cursor-label
 *   data-mouse-parallax / data-mouse-depth
 *   data-cursor / data-cursor-label       custom cursor follower
 *   data-preloader / data-preloader-bar / data-preloader-count
 *   data-scroll-cue                       fades out as the hero leaves
 */
export function useCinematicMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    gsap.registerPlugin(ScrollTrigger)
    gsap.defaults({ ease: 'power3.out', duration: 0.85 })

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches

    // The element that actually scrolls (app shell uses <main>, not window).
    const scroller = (root.closest('main') as HTMLElement) || undefined

    document.documentElement.classList.add('has-motion')

    let lenis: Lenis | undefined
    let tickerFn: ((time: number) => void) | undefined

    if (!reduceMotion) {
      lenis = new Lenis({
        wrapper: scroller,
        content: scroller ? (scroller.firstElementChild as HTMLElement) : undefined,
        lerp: 0.085,
        smoothWheel: true,
        wheelMultiplier: 0.9,
        anchors: true,
      })

      lenis.on('scroll', ScrollTrigger.update)
      tickerFn = (time: number) => lenis!.raf(time * 1000)
      gsap.ticker.add(tickerFn)
      gsap.ticker.lagSmoothing(0)

      if (scroller) ScrollTrigger.defaults({ scroller })
    }

    // ---- text splitting helpers -------------------------------------------
    const splitWords = (element: HTMLElement) => {
      if (element.dataset.motionSplit === 'true') return
      const text = element.textContent || ''
      const parts = text.split(/(\s+)/)
      element.textContent = ''
      element.setAttribute('aria-label', text.trim())
      parts.forEach((part) => {
        if (!part.trim()) {
          element.appendChild(document.createTextNode(part))
          return
        }
        const mask = document.createElement('span')
        const word = document.createElement('span')
        mask.className = 'motion-word-mask'
        mask.setAttribute('aria-hidden', 'true')
        word.className = 'motion-word'
        word.textContent = part
        mask.appendChild(word)
        element.appendChild(mask)
      })
      element.dataset.motionSplit = 'true'
    }

    const ctx = gsap.context(() => {
      // ---- preloader ------------------------------------------------------
      const loader = root.querySelector<HTMLElement>('[data-preloader]')
      const bar = root.querySelector<HTMLElement>('[data-preloader-bar]')
      const count = root.querySelector<HTMLElement>('[data-preloader-count]')

      const startScene = () => {
        if (reduceMotion) {
          gsap.set(
            [
              '[data-hero-lines]',
              '[data-hero-lines] .motion-line',
              '[data-hero-step]',
              '[data-hero-media]',
            ],
            { autoAlpha: 1, clearProps: 'transform,filter' }
          )
          return
        }
        // Hero entrance choreography: lines, then copy, then CTA, then media.
        const heroTl = gsap.timeline({ delay: 0.05 })
        const heroLines = root.querySelectorAll('[data-hero-lines] .motion-line')
        if (heroLines.length) {
          heroTl.fromTo(
            heroLines,
            { yPercent: 110, autoAlpha: 0, filter: 'blur(10px)' },
            {
              yPercent: 0,
              autoAlpha: 1,
              filter: 'blur(0px)',
              duration: 1.1,
              ease: 'power4.out',
              stagger: 0.12,
            }
          )
        }
        heroTl.fromTo(
          root.querySelectorAll('[data-hero-step]'),
          { y: 24, autoAlpha: 0, filter: 'blur(8px)' },
          {
            y: 0,
            autoAlpha: 1,
            filter: 'blur(0px)',
            duration: 0.9,
            ease: 'power4.out',
            stagger: 0.12,
          },
          heroLines.length ? '-=0.55' : 0
        )
        heroTl.fromTo(
          root.querySelectorAll('[data-hero-media]'),
          { y: 40, autoAlpha: 0, scale: 0.96, filter: 'blur(12px)' },
          {
            y: 0,
            autoAlpha: 1,
            scale: 1,
            filter: 'blur(0px)',
            duration: 1.2,
            ease: 'power4.out',
            stagger: 0.1,
          },
          '-=0.7'
        )
      }

      if (loader && !reduceMotion) {
        const counter = { v: 0 }
        const tl = gsap.timeline({
          defaults: { ease: 'power3.out' },
          onComplete: () => {
            loader.remove()
            ScrollTrigger.refresh()
            startScene()
          },
        })
        tl.to(counter, {
          v: 100,
          duration: 1.15,
          ease: 'power2.inOut',
          onUpdate: () => {
            if (count) count.textContent = String(Math.round(counter.v)).padStart(2, '0')
          },
        })
        if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 1.15, ease: 'power2.inOut' }, 0)
        tl.to(loader, { autoAlpha: 0, duration: 0.5 }, '-=0.1')
        tl.to(loader, { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }, '-=0.35')
      } else {
        if (loader) loader.remove()
        startScene()
      }

      // ---- generic word reveals (non-hero) --------------------------------
      gsap.utils.toArray<HTMLElement>('[data-motion-text="words"]').forEach((element) => {
        splitWords(element)
        const words = element.querySelectorAll('.motion-word')
        gsap.set(element, { autoAlpha: 1 })
        if (reduceMotion) {
          gsap.set(words, { autoAlpha: 1, yPercent: 0, filter: 'none' })
          return
        }
        gsap.fromTo(
          words,
          { yPercent: 110, autoAlpha: 0, filter: 'blur(8px)' },
          {
            yPercent: 0,
            autoAlpha: 1,
            filter: 'blur(0px)',
            duration: 0.9,
            ease: 'power4.out',
            stagger: 0.045,
            scrollTrigger: { trigger: element, start: 'top 82%', once: true },
          }
        )
      })

      // Hero lines are revealed by the preloader handoff; just make them visible.
      gsap.set('[data-hero-lines]', { autoAlpha: 1 })

      // ---- scroll reveals -------------------------------------------------
      const revealPresets: Record<string, { from: gsap.TweenVars; to: gsap.TweenVars }> = {
        'fade-up': { from: { y: 36, autoAlpha: 0 }, to: { y: 0, autoAlpha: 1 } },
        'blur-in': {
          from: { y: 18, autoAlpha: 0, filter: 'blur(10px)' },
          to: { y: 0, autoAlpha: 1, filter: 'blur(0px)' },
        },
        scale: { from: { scale: 0.96, autoAlpha: 0 }, to: { scale: 1, autoAlpha: 1 } },
        'slide-left': { from: { x: 48, autoAlpha: 0 }, to: { x: 0, autoAlpha: 1 } },
        'slide-right': { from: { x: -48, autoAlpha: 0 }, to: { x: 0, autoAlpha: 1 } },
      }

      gsap.utils.toArray<HTMLElement>('[data-reveal-group]').forEach((group) => {
        const items = group.querySelectorAll('[data-reveal-item]')
        gsap.set(group, { autoAlpha: 1 })
        if (reduceMotion) {
          gsap.set(items, { autoAlpha: 1, y: 0, filter: 'none' })
          return
        }
        gsap.fromTo(
          items,
          { y: 40, autoAlpha: 0, filter: 'blur(8px)' },
          {
            y: 0,
            autoAlpha: 1,
            filter: 'blur(0px)',
            duration: 0.95,
            ease: 'power4.out',
            stagger: 0.08,
            scrollTrigger: { trigger: group, start: 'top 82%', once: true },
          }
        )
      })

      gsap.utils
        .toArray<HTMLElement>('[data-reveal]:not([data-reveal-item])')
        .forEach((element) => {
          const preset = revealPresets[element.dataset.reveal || 'fade-up'] || revealPresets['fade-up']
          gsap.set(element, { autoAlpha: 1 })
          if (reduceMotion) {
            gsap.set(element, { ...preset.to, filter: 'none' })
            return
          }
          gsap.fromTo(element, preset.from, {
            ...preset.to,
            duration: 0.9,
            ease: 'power4.out',
            delay: Number(element.dataset.revealDelay || 0),
            scrollTrigger: { trigger: element, start: 'top 84%', once: true },
          })
        })

      // ---- clip image / media reveals -------------------------------------
      gsap.utils.toArray<HTMLElement>('[data-image-reveal]').forEach((figure) => {
        gsap.set(figure, { autoAlpha: 1 })
        if (reduceMotion) return
        const media = figure.querySelector('img, [data-image-inner]')
        const tl = gsap.timeline({
          scrollTrigger: { trigger: figure, start: 'top 84%', once: true },
        })
        tl.fromTo(
          figure,
          { clipPath: 'inset(0 0 100% 0)' },
          { clipPath: 'inset(0 0 0% 0)', duration: 1.1, ease: 'power4.out' }
        )
        if (media) {
          tl.fromTo(
            media,
            { scale: 1.1, autoAlpha: 0.75 },
            { scale: 1, autoAlpha: 1, duration: 1.2, ease: 'power4.out' },
            0
          )
        }
      })

      // ---- parallax -------------------------------------------------------
      if (!reduceMotion) {
        gsap.utils
          .toArray<HTMLElement>('[data-parallax-layer]')
          .forEach((layer) => {
            const speed = Number(layer.dataset.parallaxSpeed || 0.18)
            const section = layer.closest<HTMLElement>('[data-parallax-section]') || layer
            gsap.to(layer, {
              y: () => window.innerHeight * speed * -1,
              ease: 'none',
              scrollTrigger: {
                trigger: section,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1.2,
                invalidateOnRefresh: true,
              },
            })
          })
      }

      // ---- sticky card stack ---------------------------------------------
      if (!reduceMotion) {
        gsap.utils.toArray<HTMLElement>('[data-sticky-stack]').forEach((stack) => {
          const cards = gsap.utils.toArray<HTMLElement>(stack.querySelectorAll('[data-stack-card]'))
          cards.forEach((card, index) => {
            const nextCard = cards[index + 1]
            if (!nextCard) return
            gsap.to(card, {
              scale: 0.92 + index * 0.015,
              autoAlpha: 0.55,
              y: -28,
              filter: 'blur(2px)',
              ease: 'none',
              scrollTrigger: {
                trigger: nextCard,
                start: 'top 80%',
                end: 'top 30%',
                scrub: true,
                invalidateOnRefresh: true,
              },
            })
          })
        })
      }

      // ---- scroll cue fade ------------------------------------------------
      if (!reduceMotion) {
        const cue = root.querySelector<HTMLElement>('[data-scroll-cue]')
        const hero = root.querySelector<HTMLElement>('[data-hero]')
        if (cue && hero) {
          gsap.to(cue, {
            autoAlpha: 0,
            y: 16,
            ease: 'none',
            scrollTrigger: {
              trigger: hero,
              start: 'top top',
              end: 'bottom 70%',
              scrub: true,
            },
          })
        }
      }

      // ---- magnetic buttons ----------------------------------------------
      if (!reduceMotion && !coarse) {
        gsap.utils.toArray<HTMLElement>('[data-magnetic]').forEach((element) => {
          const strength = Number(element.dataset.magneticStrength || 0.3)
          const xTo = gsap.quickTo(element, 'x', { duration: 0.5, ease: 'power3.out' })
          const yTo = gsap.quickTo(element, 'y', { duration: 0.5, ease: 'power3.out' })
          const move = (event: PointerEvent) => {
            const rect = element.getBoundingClientRect()
            xTo((event.clientX - rect.left - rect.width / 2) * strength)
            yTo((event.clientY - rect.top - rect.height / 2) * strength)
          }
          const leave = () => {
            xTo(0)
            yTo(0)
          }
          element.addEventListener('pointermove', move)
          element.addEventListener('pointerleave', leave)
        })
      }

      // ---- mouse-reactive depth layers -----------------------------------
      if (!reduceMotion && !coarse) {
        gsap.utils.toArray<HTMLElement>('[data-mouse-parallax]').forEach((section) => {
          const layers = section.querySelectorAll<HTMLElement>('[data-mouse-depth]')
          const setters = Array.from(layers).map((layer) => ({
            depth: Number(layer.dataset.mouseDepth || 0.04),
            xTo: gsap.quickTo(layer, 'x', { duration: 0.9, ease: 'power3.out' }),
            yTo: gsap.quickTo(layer, 'y', { duration: 0.9, ease: 'power3.out' }),
          }))
          const move = (event: PointerEvent) => {
            const rect = section.getBoundingClientRect()
            const x = event.clientX - rect.left - rect.width / 2
            const y = event.clientY - rect.top - rect.height / 2
            setters.forEach(({ depth, xTo, yTo }) => {
              xTo(x * depth)
              yTo(y * depth)
            })
          }
          const leave = () => setters.forEach(({ xTo, yTo }) => (xTo(0), yTo(0)))
          section.addEventListener('pointermove', move)
          section.addEventListener('pointerleave', leave)
        })
      }

      // ---- custom cursor --------------------------------------------------
      if (!reduceMotion && !coarse) {
        const cursor = root.querySelector<HTMLElement>('[data-cursor]')
        if (cursor) {
          const label = cursor.querySelector<HTMLElement>('[data-cursor-text]')
          gsap.set(cursor, { autoAlpha: 1 })
          const xTo = gsap.quickTo(cursor, 'x', { duration: 0.4, ease: 'power3.out' })
          const yTo = gsap.quickTo(cursor, 'y', { duration: 0.4, ease: 'power3.out' })
          const onMove = (event: PointerEvent) => {
            xTo(event.clientX)
            yTo(event.clientY)
          }
          document.addEventListener('pointermove', onMove)

          root.querySelectorAll<HTMLElement>('[data-cursor-label]').forEach((target) => {
            target.addEventListener('pointerenter', () => {
              if (label) label.textContent = target.dataset.cursorLabel || ''
              gsap.to(cursor, { scale: 1, autoAlpha: 1, duration: 0.35, ease: 'power3.out' })
              cursor.classList.add('is-active')
            })
            target.addEventListener('pointerleave', () => {
              if (label) label.textContent = ''
              cursor.classList.remove('is-active')
              gsap.to(cursor, { scale: 1, duration: 0.35, ease: 'power3.out' })
            })
          })
        }
      }

      ScrollTrigger.refresh()
    }, root)

    const onLoad = () => ScrollTrigger.refresh()
    window.addEventListener('load', onLoad)

    return () => {
      window.removeEventListener('load', onLoad)
      ctx.revert()
      if (tickerFn) gsap.ticker.remove(tickerFn)
      lenis?.destroy()
      ScrollTrigger.clearScrollMemory()
      ScrollTrigger.defaults({ scroller: undefined })
      document.documentElement.classList.remove('has-motion')
    }
  }, [rootRef])
}
