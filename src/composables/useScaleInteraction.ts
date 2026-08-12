import { ref } from 'vue'

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/**
 * Pointer-drag logic for the scale, kept out of the component. Callers provide
 * the track's current bounding rect and a setter that records a normalized
 * 0..1 position for an item id.
 *
 * The drag is bound to the element that received the pointerdown via
 * setPointerCapture rather than to window. Mobile Safari retargets touch
 * pointers as the finger leaves the element, so without capture a drag dies as
 * soon as it strays off the marker.
 */
/** Travel that separates a tap from a drag, matching the tray's threshold. */
const DRAG_THRESHOLD = 6

export function useScaleInteraction(
  getTrackRect: () => DOMRect | null,
  setPosition: (itemId: string, position: number) => void,
  /** The press ended without travelling: a tap, not a drag. */
  onTap?: (itemId: string) => void,
) {
  const draggingId = ref<string | null>(null)
  /** False until the pointer has travelled far enough to count as a drag. */
  const moving = ref(false)
  let captureEl: HTMLElement | null = null
  let capturedPointerId = -1
  let startX = 0
  let startY = 0

  function positionFromClientX(clientX: number): number {
    const rect = getTrackRect()
    if (!rect || rect.width === 0) return 0
    return clamp01((clientX - rect.left) / rect.width)
  }

  function onPointerMove(event: PointerEvent) {
    if (draggingId.value == null || event.pointerId !== capturedPointerId) return
    if (!moving.value) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) < DRAG_THRESHOLD) return
      moving.value = true
    }
    event.preventDefault()
    setPosition(draggingId.value, positionFromClientX(event.clientX))
  }

  function onPointerEnd(event: PointerEvent) {
    if (event.pointerId !== capturedPointerId) return
    const itemId = draggingId.value
    const wasDrag = moving.value
    endDrag()
    // A press that never travelled is a tap, and the caller decides what that
    // means — here, lifting the marker into the player's hand.
    if (!wasDrag && itemId != null && event.type !== 'pointercancel') onTap?.(itemId)
  }

  function endDrag() {
    if (!captureEl) return
    captureEl.removeEventListener('pointermove', onPointerMove)
    captureEl.removeEventListener('pointerup', onPointerEnd)
    captureEl.removeEventListener('pointercancel', onPointerEnd)
    if (captureEl.hasPointerCapture(capturedPointerId)) {
      captureEl.releasePointerCapture(capturedPointerId)
    }
    captureEl = null
    capturedPointerId = -1
    draggingId.value = null
    moving.value = false
  }

  function startDrag(itemId: string, event: PointerEvent, element: HTMLElement) {
    endDrag()
    captureEl = element
    capturedPointerId = event.pointerId
    draggingId.value = itemId
    startX = event.clientX
    startY = event.clientY
    element.setPointerCapture(event.pointerId)
    element.addEventListener('pointermove', onPointerMove, { passive: false })
    element.addEventListener('pointerup', onPointerEnd)
    element.addEventListener('pointercancel', onPointerEnd)
    // Deliberately no move yet: until the pointer travels, this might be a tap,
    // and a tap must leave the marker exactly where the player found it.
  }

  return { draggingId, moving, startDrag, positionFromClientX }
}
