import { createCipheriv, createDecipheriv, randomBytes, createHash, createHmac, timingSafeEqual } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is required for token encryption')
  return createHash('sha256').update(secret).digest()
}

export function encryptToken(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Format: iv:encrypted:authTag (all base64)
  return [
    iv.toString('base64'),
    encrypted.toString('base64'),
    authTag.toString('base64'),
  ].join(':')
}

export function decryptToken(ciphertext: string): string {
  const key = getKey()
  const [ivB64, encB64, tagB64] = ciphertext.split(':')

  if (!ivB64 || !encB64 || !tagB64) {
    throw new Error('Invalid encrypted token format')
  }

  const iv = Buffer.from(ivB64, 'base64')
  const encrypted = Buffer.from(encB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  return decipher.update(encrypted) + decipher.final('utf8')
}

/**
 * Sign an arbitrary payload with HMAC-SHA256 (keyed by NEXTAUTH_SECRET) and
 * return a tamper-proof `payload.signature` string. Used for the soft share
 * access cookie — it proves the server granted access to this exact value.
 */
export function signValue(payload: string): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is required for signing')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${Buffer.from(payload, 'utf8').toString('base64url')}.${sig}`
}

/**
 * Verify a value produced by signValue(). Returns the original payload if the
 * signature is valid, or null otherwise.
 */
export function verifySignedValue(signed: string): string | null {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) return null
  const [payloadB64, sig] = signed.split('.')
  if (!payloadB64 || !sig) return null
  let payload: string
  try {
    payload = Buffer.from(payloadB64, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return payload
}
