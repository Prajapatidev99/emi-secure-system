package com.emiseure.customer

import android.content.Context
import android.content.Intent
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
 * Espresso UI Tests for LockScreenActivity.
 *
 * Tests the lock screen that appears when a device is locked due to
 * unpaid EMI. This is especially critical to test on various manufacturers
 * (Samsung, Xiaomi, Vivo, Oppo) because each OEM handles full-screen
 * kiosk/lock modes differently.
 *
 * IMPORTANT: The LockScreenActivity requires IS_LOCKED=true in SharedPreferences
 * or it may redirect. These tests set up the required state before launching.
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class LockScreenActivityTest {

    @Before
    fun setUp() {
        // Set the IS_LOCKED flag so the LockScreenActivity doesn't redirect
        val context = ApplicationProvider.getApplicationContext<Context>()
        val deviceContext = context.createDeviceProtectedStorageContext()
        deviceContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("IS_LOCKED", true)
            .putString("UNLOCK_KEY", "TEST01") // Test unlock key
            .commit()
    }

    @get:Rule
    val activityRule = ActivityScenarioRule(LockScreenActivity::class.java)

    // =============================================
    // 🚀 LAUNCH TESTS
    // =============================================

    @Test
    fun lockScreen_launchesWithoutCrashing() {
        // Critical: This catches crash-on-launch for the lock screen across all devices
        // Lock screen crashes are the #1 priority since they can brick the device for the user
        activityRule.scenario.onActivity { activity ->
            assert(activity != null) { "LockScreenActivity should not be null" }
        }
    }

    // =============================================
    // 🔒 LOCK UI TESTS
    // =============================================

    @Test
    fun lockIcon_isDisplayed() {
        onView(withId(R.id.lockIcon))
            .check(matches(isDisplayed()))
    }

    @Test
    fun lockTitle_isDisplayed() {
        onView(withId(R.id.lockTitle))
            .check(matches(isDisplayed()))
    }

    @Test
    fun lockMessage_isDisplayed() {
        onView(withId(R.id.lockMessage))
            .check(matches(isDisplayed()))
    }

    @Test
    fun mainContent_isDisplayed() {
        onView(withId(R.id.mainContent))
            .check(matches(isDisplayed()))
    }

    // =============================================
    // 🔑 KEYPAD UI TESTS
    // =============================================

    @Test
    fun keypadContainer_isInitiallyHidden() {
        // The offline unlock keypad should be hidden by default
        onView(withId(R.id.keypadContainer))
            .check(matches(withEffectiveVisibility(Visibility.GONE)))
    }

    @Test
    fun keypadInput_exists() {
        onView(withId(R.id.keypadInput))
            .check(matches(anyOf(
                withEffectiveVisibility(Visibility.VISIBLE),
                withEffectiveVisibility(Visibility.GONE)
            )))
    }

    @Test
    fun keypadSubmitButton_exists() {
        onView(withId(R.id.keypadSubmitButton))
            .check(matches(anyOf(
                withEffectiveVisibility(Visibility.VISIBLE),
                withEffectiveVisibility(Visibility.GONE)
            )))
    }

    @Test
    fun keypadCancelButton_exists() {
        onView(withId(R.id.keypadCancelButton))
            .check(matches(anyOf(
                withEffectiveVisibility(Visibility.VISIBLE),
                withEffectiveVisibility(Visibility.GONE)
            )))
    }
}
