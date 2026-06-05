// ── Device identity & points ───────────────────────────────────────────────
// Sin login, cada browser tiene un UUID persistido en localStorage.
// Los puntos se guardan localmente y se acumulan por uploads.

export function getDeviceId() {
  let id = localStorage.getItem('aa-device-id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('aa-device-id', id)
  }
  return id
}

export function getPoints() {
  return parseInt(localStorage.getItem('aa-points') ?? '0', 10)
}

export function addPoints(n = 5) {
  const next = getPoints() + n
  localStorage.setItem('aa-points', String(next))
  return next
}
