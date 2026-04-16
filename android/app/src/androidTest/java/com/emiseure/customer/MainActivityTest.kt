package com.emiseure.customer

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.*
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import org.hamcrest.Matchers.anyOf
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Espresso UI Tests for MainActivity.
 *
 * These tests verify:
 * - App launches without crashing
 * - Core UI elements are present and configured correctly
 * - Error/retry flow elements exist
 *
 * Run locally:
 *   .\gradlew.bat :app:connectedDebugAndroidTest
 *
 * Run on Firebase Test Lab:
 *   gcloud firebase test android run --type instrumentation \
 *     --app app/build/outputs/apk/debug/app-debug.apk \
 *     --test app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class MainActivityTest {

    @Before
    fun setUp() {
        // CRITICAL: Clear IS_LOCKED flag so MainActivity doesn't redirect to LockScreenActivity
        // LockScreenActivityTest may have set this flag in a previous test run
        val context = ApplicationProvider.getApplicationContext<Context>()
        val deviceContext = context.createDeviceProtectedStorageContext()
        deviceContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("IS_LOCKED", false)
            .remove("UNLOCK_KEY")
            .commit()
    }

    @get:Rule
    val activityRule = ActivityScenarioRule(MainActivity::class.java)

    // =============================================
    // 🚀 APP LAUNCH TESTS
    // =============================================

    @Test
    fun appLaunches_withoutCrashing() {
        // If this test passes, the app launched successfully on this device/emulator
        // This alone catches many crash-on-launch issues across different manufacturers
        activityRule.scenario.onActivity { activity ->
            assert(activity != null) { "MainActivity should not be null" }
        }
    }

    // =============================================
    // 🎨 UI ELEMENT EXISTENCE TESTS
    // =============================================

    @Test
    fun androidIdTextView_exists() {
        // The Android ID should always be displayed at the bottom
        onView(withId(R.id.androidIdTextView))
            .check(matches(isDisplayed()))
    }

    @Test
    fun deviceAdminStatusTextView_exists() {
        onView(withId(R.id.deviceAdminStatusTextView))
            .check(matches(isDisplayed()))
    }

    @Test
    fun syncStatusTextView_exists() {
        onView(withId(R.id.syncStatusTextView))
            .check(matches(isDisplayed()))
    }

    // =============================================
    // 📱 LAYOUT STRUCTURE TESTS
    // The status card may be VISIBLE or GONE depending on
    // loading state / network response. We just verify
    // the views exist in the hierarchy.
    // =============================================

    @Test
    fun statusCard_existsInLayout() {
        onView(withId(R.id.statusCard))
            .check(matches(anyOf(
                withEffectiveVisibility(Visibility.VISIBLE),
                withEffectiveVisibility(Visibility.GONE)
            )))
    }

    @Test
    fun customerNameTextView_existsInLayout() {
        onView(withId(R.id.customerNameTextView))
            .check(matches(anyOf(
                withEffectiveVisibility(Visibility.VISIBLE),
                withEffectiveVisibility(Visibility.GONE)
            )))
    }

    @Test
    fun progressBar_existsInLayout() {
        onView(withId(R.id.progressBar))
            .check(matches(anyOf(
                withEffectiveVisibility(Visibility.VISIBLE),
                withEffectiveVisibility(Visibility.GONE)
            )))
    }

    @Test
    fun retryButton_existsInLayout() {
        onView(withId(R.id.retryButton))
            .check(matches(anyOf(
                withEffectiveVisibility(Visibility.VISIBLE),
                withEffectiveVisibility(Visibility.GONE)
            )))
    }

    @Test
    fun statusDetailsLayout_existsInLayout() {
        onView(withId(R.id.statusDetailsLayout))
            .check(matches(anyOf(
                withEffectiveVisibility(Visibility.VISIBLE),
                withEffectiveVisibility(Visibility.GONE)
            )))
    }

    @Test
    fun dueDateTextView_existsInLayout() {
        onView(withId(R.id.dueDateTextView))
            .check(matches(anyOf(
                withEffectiveVisibility(Visibility.VISIBLE),
                withEffectiveVisibility(Visibility.GONE)
            )))
    }

    @Test
    fun amountDueTextView_existsInLayout() {
        onView(withId(R.id.amountDueTextView))
            .check(matches(anyOf(
                withEffectiveVisibility(Visibility.VISIBLE),
                withEffectiveVisibility(Visibility.GONE)
            )))
    }
}
