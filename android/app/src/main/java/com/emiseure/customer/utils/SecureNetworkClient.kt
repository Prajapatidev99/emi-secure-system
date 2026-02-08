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
                    // Pin for emi-secure-system.onrender.com
                    // Extracted on 2026-02-08 using PowerShell script
                    .add("emi-secure-system.onrender.com", "sha256/+sHyJkrLOy3ko18xxX6CR5GEXW3rHyNxzI8enObvSEU=")
                    // Note: Add backup pin when certificate is renewed
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
