/**
 * Generates cryptographically secure random bytes using globalThis.crypto
 * or expo-crypto (backed by Android SecureRandom / iOS SecRandomCopyBytes).
 *
 * Strict constraint: Math.random is NEVER used.
 */
export function secureRandomBytes(byteCount: number): Uint8Array {
  const buf = new Uint8Array(byteCount);

  if (typeof globalThis?.crypto?.getRandomValues === 'function') {
    return globalThis.crypto.getRandomValues(buf);
  }

  try {
    // Dynamic require for React Native / Expo runtime
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Crypto = require('expo-crypto');
    if (typeof Crypto?.getRandomValues === 'function') {
      return Crypto.getRandomValues(buf);
    }
  } catch {
    // Expo native module not available in current environment
  }

  throw new Error(
    'No cryptographically secure random number generator available. Math.random fallback is prohibited.'
  );
}
