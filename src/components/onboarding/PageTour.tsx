'use client'

import { useEffect, useRef } from 'react'
import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

// ============================================
// TYPES
// ============================================
export interface ExtendedStep extends DriveStep {
  /**
   * Jika true: tombol "Lanjut" di-disable sampai user
   * mengklik elemen target. Cocok untuk step interaktif
   * yang TIDAK membuka modal.
   */
  waitForClick?: boolean
}

interface PageTourProps {
  isOpen: boolean
  steps: ExtendedStep[]
  onComplete: () => void
}

// ============================================
// COMPONENT
// ============================================
export function PageTour({ isOpen, steps, onComplete }: PageTourProps) {
  const onCompleteRef = useRef(onComplete)
  const startedRef = useRef(false)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!isOpen) return
    if (startedRef.current) return
    if (!steps || steps.length === 0) return
    startedRef.current = true

    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: 'Lanjut →',
      prevBtnText: '← Kembali',
      doneBtnText: 'Selesai',
      progressText: 'Langkah {{current}} dari {{total}}',
      // allowClose: false → klik di luar overlay tidak menutup tour.
      // User bisa melewati lewat tombol "Lewati Tour".
      allowClose: false,
      overlayColor: 'rgba(15, 23, 42, 0.8)',
      stagePadding: 12,
      stageRadius: 12,
      popoverClass: 'iqbizz-tour-popover',
      smoothScroll: true,
      animate: true,
      onDestroyed: () => {
        onCompleteRef.current()
      },
      onPopoverRender: (popover, opts) => {
        // ============================================
        // 1) Dot indicator (di atas footer)
        // ============================================
        const total = steps.length
        const currentIndex = opts.state.activeIndex ?? 0
        const existingDots = popover.wrapper.querySelector('[data-iqbizz-dots]')
        if (!existingDots) {
          const dotsContainer = document.createElement('div')
          dotsContainer.setAttribute('data-iqbizz-dots', '1')
          dotsContainer.className = 'iqbizz-tour-dots'
          for (let i = 0; i < total; i++) {
            const dot = document.createElement('span')
            dot.className =
              'iqbizz-tour-dot' + (i === currentIndex ? ' is-active' : '')
            dotsContainer.appendChild(dot)
          }
          // Sisipkan sebelum footer
          const footer = popover.wrapper.querySelector(
            '.driver-popover-footer'
          ) as HTMLElement | null
          if (footer && footer.parentNode) {
            footer.parentNode.insertBefore(dotsContainer, footer)
          }
        } else {
          // Update dot aktif
          const dots = existingDots.querySelectorAll('.iqbizz-tour-dot')
          dots.forEach((d, i) => {
            if (i === currentIndex) d.classList.add('is-active')
            else d.classList.remove('is-active')
          })
        }

        // ============================================
        // 2) Tombol "Lewati Tour" di footer
        // ============================================
        const footer = popover.wrapper.querySelector(
          '.driver-popover-footer'
        ) as HTMLElement | null
        const existingSkip = popover.wrapper.querySelector(
          '[data-iqbizz-skip-btn]'
        )
        if (footer && !existingSkip) {
          const skipBtn = document.createElement('button')
          skipBtn.type = 'button'
          skipBtn.setAttribute('data-iqbizz-skip-btn', '1')
          skipBtn.className = 'iqbizz-tour-skip-btn'
          skipBtn.textContent = 'Lewati Tour'
          skipBtn.addEventListener('click', () => {
            driverObj.destroy()
          })
          footer.insertBefore(skipBtn, footer.firstChild)
        }

        // ============================================
        // 3) waitForClick — disable "Lanjut" sampai klik
        // ============================================
        const step = steps[currentIndex] as ExtendedStep | undefined
        if (!step?.waitForClick || typeof step.element !== 'string') return

        const targetEl = document.querySelector(step.element)
        if (!targetEl) return

        const nextBtn = popover.wrapper.querySelector(
          '.driver-popover-next-btn'
        ) as HTMLButtonElement | null
        if (!nextBtn) return

        nextBtn.disabled = true
        nextBtn.style.opacity = '0.5'
        nextBtn.style.cursor = 'not-allowed'

        const handler = () => {
          nextBtn.disabled = false
          nextBtn.style.opacity = ''
          nextBtn.style.cursor = ''
        }

        targetEl.addEventListener('click', handler, { once: true })

        const cleanupKey = '__iqbizzTourCleanup__'
        ;(targetEl as any)[cleanupKey] = () => {
          targetEl.removeEventListener('click', handler)
        }
      },
      onNextClick: (_el, _step, opts) => {
        // Bersihkan listener dari step sebelumnya (jika ada)
        const prevIndex = opts.state.activeIndex ?? 0
        const prevStep = steps[prevIndex] as ExtendedStep | undefined
        if (prevStep?.waitForClick && typeof prevStep.element === 'string') {
          const prevEl = document.querySelector(prevStep.element)
          const cleanupKey = '__iqbizzTourCleanup__'
          const cleanup = prevEl ? (prevEl as any)[cleanupKey] : null
          if (typeof cleanup === 'function') {
            cleanup()
            delete (prevEl as any)[cleanupKey]
          }
        }
        opts.driver.moveNext()
      },
      steps,
    })

    const timer = setTimeout(() => {
      driverObj.drive()
    }, 500)

    return () => {
      clearTimeout(timer)
      try {
        driverObj.destroy()
      } catch {
        // silent
      }
      startedRef.current = false
    }
  }, [isOpen, steps])

  return null
}
