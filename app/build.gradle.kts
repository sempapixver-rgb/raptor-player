plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.raptor.player"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.raptor.player"
        minSdk = 23
        targetSdk = 35
        versionCode = 21
        versionName = "1.3.4"

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

    // Cópias do mesmo app:
    //  - mobile: celular / TV Box (minSdk 23)
    //  - firetv: Fire TV / Fire Stick antigos (Fire OS 5 = API 22), minSdk 21
    //  - store: edição de loja (somente ativação do aparelho e vídeos de exemplo)
    flavorDimensions += "store"

    productFlavors {
        create("mobile") {
            dimension = "store"
            // Mesmo ID de sempre: atualiza o app já instalado.
            buildConfigField("boolean", "IS_STORE", "false")
        }
        create("firetv") {
            dimension = "store"
            applicationId = "com.raptor.player.firetv"
            minSdk = 21
            versionNameSuffix = "-firetv"
            buildConfigField("boolean", "IS_STORE", "false")
        }
        create("store") {
            dimension = "store"
            applicationId = "com.raptor.player.store"
            minSdk = 21
            versionCode = 1
            versionName = "1.0"
            versionNameSuffix = "-store"
            buildConfigField("boolean", "IS_STORE", "true")
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
        buildConfig = true
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
    implementation("androidx.media3:media3-ui:1.3.1")

    // HLS fica só nas versões completas. A edição de loja toca apenas os
    // vídeos MP4 de demonstração e não precisa do analisador #EXTM3U.
    mobileImplementation("androidx.media3:media3-exoplayer-hls:1.3.1")
    firetvImplementation("androidx.media3:media3-exoplayer-hls:1.3.1")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil-compose:2.6.0")
    implementation("com.google.zxing:core:3.5.3")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
