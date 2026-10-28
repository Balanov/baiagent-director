plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "pro.balanov.baiagent.director"
    compileSdk = 35

    defaultConfig {
        applicationId = "pro.balanov.baiagent.director"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "0.3.0"
    }
}

kotlin {
    jvmToolchain(17)
}
