plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.reptor.player"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.reptor.player"
        minSdk = 23
        targetSdk = 35
        versionCode = 9
        versionName = "1.2.5"

        vectorDrawables { useSupportLibrary = true }

        // O app é em português: descarta as traduções das bibliotecas (dezenas
        // de idiomas) que só ocupavam espaço no APK.
        resourceConfigurations += listOf("pt", "pt-rBR", "en")
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    // Duas cópias do mesmo app:
    //  - mobile: celular / TV Box (minSdk 23)
    //  - firetv: Fire TV / Fire Stick antigos (Fire OS 5 = API 22), minSdk 21
    flavorDimensions += "store"

    productFlavors {
        create("mobile") {
            dimension = "store"
            // Mesmo ID de sempre: atualiza o app já instalado.
        }
        create("firetv") {
            dimension = "store"
            applicationId = "com.reptor.player.firetv"
            minSdk = 21
            versionNameSuffix = "-firetv"
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
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }

    packaging {
        resources.excludes += setOf(
            "/META-INF/{AL2.0,LGPL2.1}",
            "/META-INF/DEPENDENCIES",
            "/META-INF/LICENSE*",
            "/META-INF/NOTICE*"
        )
    }

    // O build de release nao para por aviso de lint.
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.06.00")
    implementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.0")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    implementation("androidx.media3:media3-exoplayer:1.3.1")
    implementation("androidx.media3:media3-exoplayer-hls:1.3.1")
    implementation("androidx.media3:media3-ui:1.3.1")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil-compose:2.6.0")
    implementation("com.google.zxing:core:3.5.3")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
