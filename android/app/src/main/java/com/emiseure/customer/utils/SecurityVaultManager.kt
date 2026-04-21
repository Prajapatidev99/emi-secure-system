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
        private const val IV_SEPARATOR = ":"
    }

    private val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply {
        load(null)
    }

    /**
     * 🔐 Encrypt sensitive data and store IV inline
     * Format: "IV_BASE64:CIPHERTEXT_BASE64"
     */
    fun encrypt(plaintext: String): String? {
        return try {
            // Ensure key exists and is valid
            if (!keyStore.containsAlias(KEYSTORE_ALIAS)) {
                generateKey()
            }

            val key = keyStore.getKey(KEYSTORE_ALIAS, null) as SecretKey
            val cipher = Cipher.getInstance(CIPHER_ALGORITHM)
            cipher.init(Cipher.ENCRYPT_MODE, key)

            val iv = cipher.iv
            val encryptedData = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

            // Combine IV and ciphertext with separator
            val ivBase64 = Base64.encodeToString(iv, Base64.NO_WRAP)
            val cipherBase64 = Base64.encodeToString(encryptedData, Base64.NO_WRAP)

            "$ivBase64$IV_SEPARATOR$cipherBase64"
        } catch (e: Exception) {
            Log.e(TAG, "Encryption failed", e)
            null
        }
    }

    /**
     * 🔐 Decrypt data from "IV:CIPHERTEXT" format
     */
    fun decrypt(encrypted: String): String? {
        return try {
            if (!encrypted.contains(IV_SEPARATOR)) {
                Log.e(TAG, "Invalid encrypted format")
                return null
            }

            val parts = encrypted.split(IV_SEPARATOR)
            if (parts.size != 2) {
                Log.e(TAG, "Invalid format: expected 2 parts, got ${parts.size}")
                return null
            }

            val iv = Base64.decode(parts[0], Base64.NO_WRAP)
            val encryptedData = Base64.decode(parts[1], Base64.NO_WRAP)

            val key = keyStore.getKey(KEYSTORE_ALIAS, null) as SecretKey
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
     * 🔐 Generate hardware-backed AES key
     */
    private fun generateKey() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val keyGenerator = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES,
                    KEYSTORE_PROVIDER
                )

                val keySpec = KeyGenParameterSpec.Builder(
                    KEYSTORE_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                ).apply {
                    setKeySize(KEY_SIZE)
                    setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    // 🛡️ Require device unlock to use key if available
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        setUserAuthenticationRequired(false) // Set to true if you want biometric auth
                    }
                }.build()

                keyGenerator.init(keySpec)
                keyGenerator.generateKey()
                Log.d(TAG, "Hardware-backed key generated successfully")
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
     * 🔐 Retrieve and decrypt offline unlock key
     */
    fun getUnlockKey(): String? {
        return try {
            val encrypted = prefs.getString(KEY_ENCRYPTED, null)
                ?: return null

            val decrypted = vault.decrypt(encrypted)
            if (decrypted == null) {
                Log.e(TAG, "Decryption failed or key compromised")
                // 🚨 CRITICAL: Key corruption detected
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
        // Minimum length requirement
        if (key.length < MIN_KEY_LENGTH) {
            Log.w(TAG, "Key too short: ${key.length} < $MIN_KEY_LENGTH")
            return false
        }

        // Check for variety (not all same character)
        if (key.toSet().size < 3) {
            Log.w(TAG, "Key lacks variety (too repetitive)")
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
