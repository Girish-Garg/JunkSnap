buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:9.3.1")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.10")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// JunkSnap: tauri-plugin-sharekit 0.3.1 compiles against API 35, but tauri-android needs 36+
// (the release AAR metadata check fails otherwise). Compile every Android library against 36.
subprojects {
    pluginManager.withPlugin("com.android.library") {
        extensions.getByType(com.android.build.api.variant.LibraryAndroidComponentsExtension::class.java)
            .finalizeDsl { it.compileSdk = 36 }
    }
}

tasks.register("clean").configure {
    delete("build")
}

