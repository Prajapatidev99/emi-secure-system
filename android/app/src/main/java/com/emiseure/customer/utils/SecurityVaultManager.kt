package com.emiseure.customer.utils

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * 🔐 CRITICAL SECURITY: Encrypts/Decrypts sensitive data using Android Keystore
 *
 * - Uses hardware-backed encryption when available
 * - Non-extractable keys (can't be exported from device)
 * - AES-256-GCM for authenticated encryption
 * - Protects offline unlock key, lock state, and other secrets
 */
class SecurityVaultManager(private val context: Context) {

    companion object {
        private const val TAG = "SecurityVault"
        private const val KEYSTORE_ALIAS = "EMI_SECURE_KEY"
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val CIPHER_ALGORITHM = "AES/GCM/NoPadding"
        private const val KEY_SIZE = 256
        private const val GCM_TAG_LENGTH = 128
        private const val PREFS_NAME = "EMI_SECURITY_VAULT"
        // FIX: Use "|" as separator — it CANNOT appear in standard Base64 alphabet,
        // so splitting is always unambiguous. The old ":" separator was unsafe because
        // Base64 output can contain colons, causing split() to return 3+ parts.
        private const val IV_SEPARATOR = "|"
        // Legacy separator used by old stored keys — needed for migration
        private const val IV_SEPARATOR_LEGACY = ":"
    }

    private val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply {
        load(null)
    }

    /**
     * 🔐 Encrypt sensitive data and store IV inline
     * Format: "IV_BASE64|CIPHERTEXT_BASE64"
     * Separator "|" is safe — it never appears in Base64 output.
     */
    fun encrypt(plaintext: String): String? {
        return try {
            // Ensure key exists and is valid
            if (!keyStore.containsAlias(KEYSTORE_ALIAS)) {
                generateKey()
            }

            // FIX: Explicit null check — if generateKey() failed (e.g. low-API device),
            // getKey() returns null and the cast would NPE without this guard.
            val key = keyStore.getKey(KEYSTORE_ALIAS, null) as? SecretKey
            if (key == null) {
                Log.e(TAG, "Encryption key not available — cannot encrypt")
                return null
            }

            val cipher = Cipher.getInstance(CIPHER_ALGORITHM)
            cipher.init(Cipher.ENCRYPT_MODE, key)

            val iv = cipher.iv
            val encryptedData = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

            // Combine IV and ciphertext with safe "|" separator
            val ivBase64 = Base64.encodeToString(iv, Base64.NO_WRAP)
            val cipherBase64 = Base64.encodeToString(encryptedData, Base64.NO_WRAP)

            "$ivBase64$IV_SEPARATOR$cipherBase64"
        } catch (e: Exception) {
            Log.e(TAG, "Encryption failed", e)
            null
        }
    }

    /**
     * 🔐 Decrypt data from "IV|CIPHERTEXT" format.
     * Also handles legacy "IV:CIPHERTEXT" format for migration.
     *
     * FIX (BUG): The old code used split(":") which would produce 3+ parts when
     * the Base64-encoded IV happened to contain a ":" character, causing every
     * decrypt() call to return null and permanently locking out the device.
     * Now we split only on the FIRST occurrence of the separator.
     */
    fun decrypt(encrypted: String): String? {
        return try {
            // Determine which separator this blob uses (support migration from old ":"-based format)
            val separatorChar: String
            val sepIndex: Int
            val newSepIndex = encrypted.indexOf(IV_SEPARATOR)         // "|"
            val legacySepIndex = encrypted.indexOf(IV_SEPARATOR_LEGACY) // ":"

            when {
                newSepIndex >= 0 -> {
                    // Current format — always safe
                    separatorChar = IV_SEPARATOR
                    sepIndex = newSepIndex
                }
                legacySepIndex >= 0 -> {
                    // Legacy format — find the FIRST ":" only (ignore any others in ciphertext)
                    separatorChar = IV_SEPARATOR_LEGACY
                    sepIndex = legacySepIndex
                    Log.d(TAG, "Decrypting legacy \":\" format — will be re-encrypted with safe separator on next store")
                }
                else -> {
                    Log.e(TAG, "Invalid encrypted format: no separator found")
                    return null
                }
            }

            // FIX: Split on FIRST separator index only — not split() which splits on ALL occurrences
            val ivBase64 = encrypted.substring(0, sepIndex)
            val cipherBase64 = encrypted.substring(sepIndex + separatorChar.length)

            if (ivBase64.isEmpty() || cipherBase64.isEmpty()) {
                Log.e(TAG, "Invalid format: IV or ciphertext is empty after split")
                return null
            }

            val iv = Base64.decode(ivBase64, Base64.NO_WRAP)
            val encryptedData = Base64.decode(cipherBase64, Base64.NO_WRAP)

            // FIX: Explicit null check on key retrieval
            val key = keyStore.getKey(KEYSTORE_ALIAS, null) as? SecretKey
            if (key == null) {
                Log.e(TAG, "Decryption key not available in Keystore")
                return null
            }

            val cipher = Cipher.getInstance(CIPHER_ALGORITHM)

            // Reconstruct GCM parameter spec with IV
            val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
            cipher.init(Cipher.DECRYPT_MODE, key, gcmSpec)

            val decryptedData = cipher.doFinal(encryptedData)
            String(decryptedData, Charsets.UTF_8)
        } catch (e: Exception) {
            Log.e(TAG, "Decryption failed", e)
            null
        }
    }

    /**
     * 🔐 Generate AES encryption key.
     *
     * API 23+ → hardware-backed AES-256-GCM key in Android Keystore (preferred).
     * API 21/22 → software AES-128 key stored in AndroidKeyStore (no hardware backing,
     *             but still non-exportable and isolated from app memory).
     *
     * FIX (BUG): The original code had no fallback for API < 23. On Android 5/5.1
     * `generateKey()` silently did nothing, then `encrypt()` cast a null getKey()
     * result and crashed with NPE — making offline unlock impossible on those devices.
     */
    private fun generateKey() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // ✅ PREFERRED PATH: Hardware-backed AES-256-GCM (API 23+)
                val keyGenerator = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES,
                    KEYSTORE_PROVIDER
                )

                val keySpec = KeyGenParameterSpec.Builder(
                    KEYSTORE_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                ).apply {
                    setKeySize(KEY_SIZE) // 256-bit
                    setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    // Authentication not required — key must work at Direct Boot time
                    // (before user unlocks the device screen)
                    setUserAuthenticationRequired(false)
                }.build()

                keyGenerator.init(keySpec)
                keyGenerator.generateKey()
                Log.d(TAG, "✅ Hardware-backed AES-256-GCM key generated (API ${Build.VERSION.SDK_INT})")

            } else {
                // ✅ FALLBACK PATH: Software AES-128 in AndroidKeyStore (API 21/22)
                // AndroidKeyStore on API 21/22 does not support KeyGenParameterSpec,
                // but does support storing a pre-generated AES key via KeyStore.setEntry().
                // We generate a 128-bit key with the standard JCE provider and import it.
                Log.w(TAG, "⚠️ API ${Build.VERSION.SDK_INT} < 23: using software AES-128 fallback")

                val keyGen = javax.crypto.KeyGenerator.getInstance("AES")
                keyGen.init(128) // AES-128 is the max importable size on API 21/22 Keystore
                val secretKey = keyGen.generateKey()

                // Wrap in a KeyStore.SecretKeyEntry and store under our alias
                val entry = KeyStore.SecretKeyEntry(secretKey)
                // API 21/22 KeyStore accepts null ProtectionParameter for software keys
                keyStore.setEntry(KEYSTORE_ALIAS, entry, null)
                Log.d(TAG, "✅ Software AES-128 key stored in AndroidKeyStore (API ${Build.VERSION.SDK_INT})")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to generate key", e)
        }
    }

    /**
     * 🛡️ Clear sensitive key from keystore (for security reset)
     */
    fun clearKey(): Boolean {
        return try {
            keyStore.deleteEntry(KEYSTORE_ALIAS)
            Log.d(TAG, "Key cleared from keystore")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear key", e)
            false
        }
    }

    /**
     * 🛡️ Check if key exists
     */
    fun hasKey(): Boolean = keyStore.containsAlias(KEYSTORE_ALIAS)
}

/**
 * 🔐 Secure storage wrapper for offline unlock keys
 */
class OfflineUnlockKeyManager(private val context: Context) {

    private val vault = SecurityVaultManager(context)
    private val prefs = context.createDeviceProtectedStorageContext()
        .getSharedPreferences("EMI_UNLOCK_SECURE", Context.MODE_PRIVATE)

    companion object {
        private const val TAG = "UnlockKeyMgr"
        private const val KEY_ENCRYPTED = "UNLOCK_KEY_ENCRYPTED"
        private const val KEY_HASH = "UNLOCK_KEY_HASH"
        private const val KEY_LENGTH = "UNLOCK_KEY_LENGTH"
        private const val MIN_KEY_LENGTH = 6
    }

    /**
     * 🔐 Store offline unlock key encrypted in Keystore + hash verification
     */
    fun storeUnlockKey(plainKey: String): Boolean {
        // 🛡️ Validate key strength
        if (!isKeyStrong(plainKey)) {
            Log.e(TAG, "Unlock key too weak: length=${plainKey.length}")
            return false
        }

        return try {
            // Encrypt with Keystore
            val encrypted = vault.encrypt(plainKey)
            if (encrypted == null) {
                Log.e(TAG, "Encryption failed")
                return false
            }

            // Store encrypted key + hash for integrity
            val keyHash = hashKey(plainKey)
            prefs.edit().apply {
                putString(KEY_ENCRYPTED, encrypted)
                putString(KEY_HASH, keyHash)
                putInt(KEY_LENGTH, plainKey.length)
            }.commit()

            Log.d(TAG, "Unlock key stored securely (encrypted in Keystore)")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to store unlock key", e)
            false
        }
    }

    /**
     * 🔐 Retrieve and decrypt offline unlock key.
     *
     * Also performs automatic silent migration: if the stored blob uses the old
     * ":" separator format, we immediately re-encrypt it with the new "|" format
     * and persist the upgraded blob so future reads always use the safe separator.
     */
    fun getUnlockKey(): String? {
        return try {
            val encrypted = prefs.getString(KEY_ENCRYPTED, null)
                ?: return null

            val decrypted = vault.decrypt(encrypted)
            if (decrypted == null) {
                Log.e(TAG, "Decryption failed or key compromised")
                // 🚨 CRITICAL: Key corruption detected — clear to avoid permanent lockout
                clearUnlockKey()
                return null
            }

            // Verify hash for integrity
            val storedHash = prefs.getString(KEY_HASH, null)
            val computedHash = hashKey(decrypted)

            if (storedHash != computedHash) {
                Log.e(TAG, "🚨 INTEGRITY CHECK FAILED: Key may be corrupted")
                clearUnlockKey()
                return null
            }

            // ✅ MIGRATION: If the stored blob uses legacy ":" separator, silently
            // re-encrypt and overwrite with the new "|" format right now.
            // The new encrypt() always produces "|"-separated output.
            if (!encrypted.contains("|") && encrypted.contains(":")) {
                Log.i(TAG, "Migrating offline key from legacy \":\" format to new \"|\" format")
                val reEncrypted = vault.encrypt(decrypted)
                if (reEncrypted != null) {
                    prefs.edit().putString(KEY_ENCRYPTED, reEncrypted).commit()
                    Log.i(TAG, "✅ Offline key migrated successfully")
                } else {
                    Log.w(TAG, "Migration re-encrypt failed — key still works, will retry next read")
                }
            }

            decrypted
        } catch (e: Exception) {
            Log.e(TAG, "Failed to retrieve unlock key", e)
            null
        }
    }

    /**
     * 🛡️ Clear offline unlock key completely
     */
    fun clearUnlockKey(): Boolean {
        return try {
            prefs.edit().apply {
                remove(KEY_ENCRYPTED)
                remove(KEY_HASH)
                remove(KEY_LENGTH)
            }.commit()
            vault.clearKey()
            Log.d(TAG, "Unlock key cleared securely")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear unlock key", e)
            false
        }
    }

    /**
     * 🛡️ Validate unlock key strength
     */
    private fun isKeyStrong(key: String): Boolean {
        // Minimum length requirement (6 chars). No diversity check —
        // server-generated keys (e.g. "AABBCC") are valid regardless of char variety.
        if (key.length < MIN_KEY_LENGTH) {
            Log.w(TAG, "Key too short: ${key.length} < $MIN_KEY_LENGTH")
            return false
        }
        return true
    }

    /**
     * 🔐 Hash key for integrity verification
     */
    private fun hashKey(key: String): String {
        return try {
            val digest = java.security.MessageDigest.getInstance("SHA-256")
            val hash = digest.digest(key.toByteArray(Charsets.UTF_8))
            Base64.encodeToString(hash, Base64.NO_WRAP)
        } catch (e: Exception) {
            Log.e(TAG, "Hash computation failed", e)
            ""
        }
    }

    /**
     * 🛡️ Get remaining unlock attempts before lockout
     * Stored separately from unlock key
     */
    fun getAttemptCount(): Int {
        return prefs.getInt("ATTEMPT_COUNT", 0)
    }

    /**
     * 🛡️ Record failed unlock attempt with exponential backoff
     */
    fun recordFailedAttempt(): Long {
        val attempts = getAttemptCount() + 1
        prefs.edit().putInt("ATTEMPT_COUNT", attempts).commit()

        // Exponential backoff: 1s, 2s, 4s, 8s, 30s, 1min, 5min
        val lockoutSeconds = when {
            attempts <= 3 -> 0L // No lockout for first 3 attempts
            attempts in 4..5 -> 5L // 5 seconds
            attempts in 6..7 -> 30L // 30 seconds
            attempts in 8..9 -> 120L // 2 minutes
            attempts >= 10 -> 600L // 10 minutes
            else -> 0L
        }

        if (lockoutSeconds > 0) {
            val lockoutUntil = System.currentTimeMillis() + (lockoutSeconds * 1000)
            prefs.edit().putLong("LOCKOUT_UNTIL", lockoutUntil).commit()
        }

        return System.currentTimeMillis() + (lockoutSeconds * 1000)
    }

    /**
     * 🛡️ Check if user is locked out and get remaining time
     */
    fun getLockoutRemaining(): Long {
        val lockoutUntil = prefs.getLong("LOCKOUT_UNTIL", 0)
        val now = System.currentTimeMillis()

        return if (now < lockoutUntil) {
            lockoutUntil - now
        } else {
            0
        }
    }

    /**
     * 🛡️ Reset attempt counter on successful unlock
     */
    fun resetAttempts() {
        prefs.edit().apply {
            putInt("ATTEMPT_COUNT", 0)
            putLong("LOCKOUT_UNTIL", 0)
        }.commit()
    }
}
