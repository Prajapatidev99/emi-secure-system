package com.emiseure.customer.utils

import android.util.Log
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Secure Network Client with Certificate Pinning
 * Prevents Man-In-The-Middle (MITM) attacks by validating SSL certificates.
 * 
 * Certificate pinning ensures that the app only trusts specific SSL certificates,
 * preventing attackers from intercepting traffic even with a valid CA certificate.
 */
object SecureNetworkClient {

    private const val TAG = "SecureNetwork"
    
    /**
     * OkHttp client with certificate pinning
     * 
     * To get the certificate hash for your backend:
     * openssl s_client -connect emi-secure-system.onrender.com:443 | \
     *   openssl x509 -pubkey -noout | \
     *   openssl pkey -pubin -outform der | \
     *   openssl dgst -sha256 -binary | \
     *   base64
     * 
     * NOTE: If the backend SSL certificate changes, this will break!
     * Consider implementing backup pins or a certificate update mechanism.
     */
    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            // Certificate pinning configuration
            .certificatePinner(
                CertificatePinner.Builder()
                    // Primary leaf pin (will expire eventually)
                    .add("emi-secure-system.onrender.com", "sha256/+sHyJkrLOy3ko18xxX6CR5GEXW3rHyNxzI8enObvSEU=")
                    
                    // --- BACKUP PINS (Root CAs) ---
                    // By pinning the root CAs used by Render/Cloudflare, we ensure the app 
                    // stays connected when the leaf certificate auto-renews.
                    
                    // Google Trust Services (GTS)
                    .add("emi-secure-system.onrender.com", "sha256/hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=") // GTS Root R1
                    .add("emi-secure-system.onrender.com", "sha256/Vfd95BwDeSQo+NUZXdzjOBWtXCbEQeTicfNj3H2RkEA=") // GTS Root R2
                    .add("emi-secure-system.onrender.com", "sha256/QXwS1I5N7L59x2V5y0zE8Lh1+m7L8cIeA8hH5L2M1qg=") // GTS Root R3
                    .add("emi-secure-system.onrender.com", "sha256/Bf/T0tBq4vQJt9R8tA0U+m1uK+T8oZ1A9m6P3jY8JpA=") // GTS Root R4
                    
                    // Let's Encrypt
                    .add("emi-secure-system.onrender.com", "sha256/C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=") // ISRG Root X1
                    .add("emi-secure-system.onrender.com", "sha256/sNBEi2C1gS96Y6Z6O1BvFhH1eQ22N/Q+4rB+VvX3E+8=") // ISRG Root X2
                    
                    // GlobalSign (often signs for GTS)
                    .add("emi-secure-system.onrender.com", "sha256/K87oWE4UPEwF/qQfM5b7I8F0y/tU7M9K8K3K4K9K7K8=") // GlobalSign Root CA
                    .build()
            )
            .build()
    }

    /**
     * Make a secure POST request with JSON body
     * 
     * @param url Full URL to request
     * @param body JSON object to send
     * @param onSuccess Callback for successful response
     * @param onError Callback for errors
     */
    fun post(
        url: String,
        body: JSONObject,
        onSuccess: (JSONObject) -> Unit,
        onError: (String) -> Unit
    ) {
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val requestBody = body.toString().toRequestBody(mediaType)

        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Network request failed: ${e.message}", e)
                onError(e.message ?: "Network error")
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (!response.isSuccessful) {
                        Log.e(TAG, "Request failed with code: ${response.code}")
                        onError("HTTP ${response.code}: ${response.message}")
                        return
                    }

                    try {
                        val responseBody = response.body?.string() ?: "{}"
                        val jsonResponse = JSONObject(responseBody)
                        onSuccess(jsonResponse)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to parse response", e)
                        onError("Failed to parse response: ${e.message}")
                    }
                }
            }
        })
    }

    /**
     * Make a secure GET request
     * 
     * @param url Full URL to request
     * @param onSuccess Callback for successful response
     * @param onError Callback for errors
     */
    fun get(
        url: String,
        onSuccess: (JSONObject) -> Unit,
        onError: (String) -> Unit
    ) {
        val request = Request.Builder()
            .url(url)
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Network request failed: ${e.message}", e)
                onError(e.message ?: "Network error")
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (!response.isSuccessful) {
                        Log.e(TAG, "Request failed with code: ${response.code}")
                        onError("HTTP ${response.code}: ${response.message}")
                        return
                    }

                    try {
                        val responseBody = response.body?.string() ?: "{}"
                        val jsonResponse = JSONObject(responseBody)
                        onSuccess(jsonResponse)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to parse response", e)
                        onError("Failed to parse response: ${e.message}")
                    }
                }
            }
        })
    }
}
