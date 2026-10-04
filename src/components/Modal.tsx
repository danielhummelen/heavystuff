import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** Keep a fixed height so the sheet doesn't shrink/jump as content changes (e.g. search filtering). */
  tall?: boolean
}

export function Modal({ title, onClose, children, tall }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)

  // iOS Safari overlays the keyboard on the layout viewport; fit the backdrop to the visible area instead.
  useEffect(() => {
    const vv = window.visualViewport
    const el = backdropRef.current
    if (!vv || !el) return
    const update = () => {
      el.style.top = `${vv.offsetTop}px`
      el.style.height = `${vv.height}px`
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" ref={backdropRef} onClick={onClose}>
      <div className={`modal${tall ? ' tall' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
