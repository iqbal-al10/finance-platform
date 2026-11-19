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
   * yang tidak membuka modal.
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
export function PageTour({
  isOpen,
  steps,
  onComplete,
}: PageTourProps) {
  const onCompleteRef = useRef(onComplete)
  const startedRef = useRef(false)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!isOpen || startedRef.current || !steps?.length) return

    startedRef.current = true

    let shouldComplete = false
    let completionCalled = false
    let activeListenerCleanup: (() => void) | null = null

    const cleanupActiveListener = () => {
      activeListenerCleanup?.()
      activeListenerCleanup = null
    }

    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: 'Lanjut →',
      prevBtnText: '← Kembali',
      doneBtnText: 'Selesai',
      progressText: 'Langkah {{current}} dari {{total}}',

      allowClose: false,
      overlayColor: 'rgba(15, 23, 42, 0.8)',
      stagePadding: 12,
      stageRadius: 12,
      popoverClass: 'iqbizz-tour-popover',
      smoothScroll: true,
      animate: true,

      // ============================================
      // TOUR DESTROYED
      // ============================================
      onDestroyed: () => {
        cleanupActiveListener()

        if (shouldComplete && !completionCalled) {
          completionCalled = true
          onCompleteRef.current()
        }
      },

      // ============================================
      // POPOVER RENDER
      // ============================================
      onPopoverRender: (popover, opts) => {
        cleanupActiveListener()

        const currentIndex = opts.state.activeIndex ?? 0
        const total = steps.length

        // --------------------------------------------
        // 1. DOT INDICATOR
        // --------------------------------------------
        let dotsContainer = popover.wrapper.querySelector(
          '[data-iqbizz-dots]'
        )

        if (!dotsContainer) {
          dotsContainer = document.createElement('div')
          dotsContainer.setAttribute('data-iqbizz-dots', '1')
          dotsContainer.className = 'iqbizz-tour-dots'

          for (let i = 0; i < total; i++) {
            const dot = document.createElement('span')

            dot.className =
              'iqbizz-tour-dot' +
              (i === currentIndex ? ' is-active' : '')

            dotsContainer.appendChild(dot)
          }

          const footer = popover.wrapper.querySelector(
            '.driver-popover-footer'
          )

          if (footer?.parentNode) {
            footer.parentNode.insertBefore(dotsContainer, footer)
          }
        } else {
          const dots = dotsContainer.querySelectorAll(
            '.iqbizz-tour-dot'
          )

          dots.forEach((dot, index) => {
            if (index === currentIndex) {
              dot.classList.add('is-active')
            } else {
              dot.classList.remove('is-active')
            }
          })
        }

        // --------------------------------------------
        // 2. SKIP BUTTON
        // --------------------------------------------
        const footer = popover.wrapper.querySelector(
          '.driver-popover-footer'
        )

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
            shouldComplete = true
            driverObj.destroy()
          })

          footer.insertBefore(skipBtn, footer.firstChild)
        }

        // --------------------------------------------
        // 3. WAIT FOR CLICK
        // --------------------------------------------
        const step = steps[currentIndex] as
          | ExtendedStep
          | undefined

        if (!step?.waitForClick || typeof step.element !== 'string') {
          return
        }

        const targetEl = document.querySelector(step.element)

        if (!targetEl) {
          console.warn(
            `[PageTour] Target waitForClick tidak ditemukan: ${step.element}`
          )
          return
        }

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

          cleanupActiveListener()
        }

        targetEl.addEventListener('click', handler, { once: true })

        activeListenerCleanup = () => {
          targetEl.removeEventListener('click', handler)
        }
      },

      // ============================================
      // NEXT BUTTON
      // ============================================
      onNextClick: (_element, _step, opts) => {
        cleanupActiveListener()

        const currentIndex = opts.state.activeIndex ?? 0

        // Klik Lanjut pada langkah terakhir berarti selesai.
        if (currentIndex >= steps.length - 1) {
          shouldComplete = true
        }

        opts.driver.moveNext()
      },

      // ============================================
      // CLOSE BUTTON
      // ============================================
      onCloseClick: (_element, _step, opts) => {
        shouldComplete = true
        cleanupActiveListener()
        opts.driver.destroy()
      },

      steps,
    })

    const timer = setTimeout(() => {
      driverObj.drive()
    }, 500)

    return () => {
      clearTimeout(timer)

      // Penghentian akibat cleanup React bukan penyelesaian tour.
      shouldComplete = false

      cleanupActiveListener()

      try {
        driverObj.destroy()
      } catch {
        // Tidak melakukan apa pun jika driver sudah dihancurkan.
      }

      startedRef.current = false
    }
  }, [isOpen, steps])

  return null
}
