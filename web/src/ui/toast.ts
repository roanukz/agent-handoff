let hideTimer: number | undefined

export function showToast(message: string): void {
  const toast = document.getElementById('toast')
  if (!toast) return
  toast.textContent = message
  toast.hidden = false
  if (hideTimer !== undefined) window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => {
    toast.hidden = true
  }, 4200)
}
