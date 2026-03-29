export function generateInviteCode() {
  // Human-friendly: FLEET-AB12 (no confusing chars like O/0, I/1)
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'

  const pick = (alphabet, n) => {
    let s = ''
    for (let i = 0; i < n; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
    return s
  }

  return `FLEET-${pick(letters, 2)}${pick(digits, 2)}`
}

export function normalizeInviteCode(code) {
  return String(code || '').trim().toUpperCase()
}

