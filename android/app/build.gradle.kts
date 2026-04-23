plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
    alias(libs.plugins.google.gms.google.services)
    alias(libs.plugins.google.firebase.crashlytics)
}

android {
    namespace = "com.emiseure.customer"
    compileSdk = 34

    buildToolsVersion = "34.0.0"

    defaultConfig {
        applicationId = "com.emiseure.customer"
        minSdk = 24
        targetSdk = 34
        versionCode = 2
        versionName = "1.0.1"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        
        // Backend URL - change this for different environments
        buildConfigField("String", "BACKEND_URL", "\"https://emi-secure-system.onrender.com\"")
    }

    signingConfigs {
        create("release") {
            storeFile = file("emi-secure.jks")
            storePassword = "emi-secure-password"
            keyAlias = "emi-key"
            keyPassword = "emi-secure-password"
            // Enable both v1 and v2 signing for maximum compatibility
            enableV1Signing = true
            enableV2Signing = true
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("release")
        }
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.constraintlayout)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.espresso.intents)
    androidTestImplementation(libs.androidx.test.rules)

    // Volley for network requests
    implementation(libs.volley)
    
    // OkHttp for secure network requests with certificate pinning
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Firebase Messaging for Push Notifications
    implementation(libs.firebase.messaging.ktx)

    // Firebase Crashlytics for crash reporting across all devices
    implementation(libs.firebase.crashlytics.ktx)
    
    // Google Play Services for Location Tracking
    implementation("com.google.android.gms:play-services-location:21.1.0")
}
