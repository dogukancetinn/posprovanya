#!/usr/bin/env node

// PROVANYA POS Kurulum ve Bağımlılık Kontrolü
const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

console.log("🚀 PROVANYA POS Kurulum Başlatılıyor...")

class SetupManager {
  constructor() {
    this.requiredNodeVersion = "20.19.4"
    this.requiredNpmVersion = "10.8.2"
    this.pythonVersion = "3.12.3"
  }

  async runSetup() {
    try {
      console.log("🔍 Sistem gereksinimleri kontrol ediliyor...")
      
      // Node.js versiyonu kontrol et
      this.checkNodeVersion()
      
      // npm versiyonu kontrol et
      this.checkNpmVersion()
      
      // Python versiyonu kontrol et (opsiyonel)
      this.checkPythonVersion()
      
      // Proje dizini kontrol et
      this.checkProjectStructure()
      
      // Bağımlılıkları yükle
      await this.installDependencies()
      
      // Native modülleri rebuild et
      await this.rebuildNativeModules()
      
      // Veritabanı dizinini oluştur
      this.createDirectories()
      
      // Kurulum tamamlandı
      console.log("✅ PROVANYA POS kurulumu başarıyla tamamlandı!")
      console.log("\n📋 Sonraki adımlar:")
      console.log("   npm run dev    - Geliştirme modunda çalıştır")
      console.log("   npm run build  - Windows EXE oluştur")
      
    } catch (error) {
      console.error("❌ Kurulum hatası:", error.message)
      process.exit(1)
    }
  }

  checkNodeVersion() {
    const currentVersion = process.version.slice(1) // Remove 'v' prefix
    console.log(`📦 Node.js versiyonu: ${currentVersion}`)
    
    if (!this.isVersionCompatible(currentVersion, this.requiredNodeVersion)) {
      throw new Error(`Node.js ${this.requiredNodeVersion} veya üzeri gerekli. Mevcut: ${currentVersion}`)
    }
    
    console.log("✅ Node.js versiyonu uyumlu")
  }

  checkNpmVersion() {
    try {
      const npmVersion = execSync("npm --version", { encoding: "utf8" }).trim()
      console.log(`📦 npm versiyonu: ${npmVersion}`)
      
      if (!this.isVersionCompatible(npmVersion, this.requiredNpmVersion)) {
        console.log("⚠️  npm versiyonu eski, güncelleme öneriliyor")
        console.log("   npm install -g npm@latest")
      } else {
        console.log("✅ npm versiyonu uyumlu")
      }
    } catch (error) {
      throw new Error("npm bulunamadı")
    }
  }

  checkPythonVersion() {
    try {
      const pythonVersion = execSync("python --version", { encoding: "utf8" }).trim()
      console.log(`🐍 Python versiyonu: ${pythonVersion}`)
      
      if (pythonVersion.includes(this.pythonVersion)) {
        console.log("✅ Python versiyonu uyumlu")
      } else {
        console.log("⚠️  Python versiyonu farklı, native modül derleme sorunları olabilir")
      }
    } catch (error) {
      console.log("⚠️  Python bulunamadı, native modül derleme sorunları olabilir")
    }
  }

  checkProjectStructure() {
    const requiredFiles = [
      "package.json",
      "src/main.js",
      "src/preload.js",
      "src/renderer/index.html"
    ]

    const requiredDirs = [
      "src",
      "src/database",
      "src/api",
      "src/services",
      "src/sync",
      "src/renderer"
    ]

    console.log("📁 Proje yapısı kontrol ediliyor...")

    // Dosyaları kontrol et
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Gerekli dosya bulunamadı: ${file}`)
      }
    }

    // Dizinleri kontrol et
    for (const dir of requiredDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        console.log(`📁 Dizin oluşturuldu: ${dir}`)
      }
    }

    console.log("✅ Proje yapısı uygun")
  }

  async installDependencies() {
    console.log("📦 Bağımlılıklar yükleniyor...")
    
    try {
      // Production dependencies
      console.log("   Production bağımlılıkları...")
      execSync("npm install --production=false", { 
        stdio: "inherit",
        cwd: process.cwd()
      })
      
      console.log("✅ Bağımlılıklar başarıyla yüklendi")
    } catch (error) {
      throw new Error("Bağımlılık yükleme hatası: " + error.message)
    }
  }

  async rebuildNativeModules() {
    console.log("🔨 Native modüller yeniden derleniyor...")
    
    try {
      // better-sqlite3 için özel rebuild
      execSync("npm run rebuild", { 
        stdio: "inherit",
        cwd: process.cwd()
      })
      
      console.log("✅ Native modüller başarıyla derlendi")
    } catch (error) {
      console.log("⚠️  Native modül derleme hatası:", error.message)
      console.log("   Manuel olarak çalıştırın: npm run rebuild")
    }
  }

  createDirectories() {
    const directories = [
      "logs",
      "database",
      "backups",
      "receipts",
      "reports",
      "temp"
    ]

    console.log("📁 Uygulama dizinleri oluşturuluyor...")

    for (const dir of directories) {
      const dirPath = path.join(process.cwd(), dir)
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
        console.log(`   📁 ${dir}`)
      }
    }

    console.log("✅ Dizinler oluşturuldu")
  }

  isVersionCompatible(current, required) {
    const currentParts = current.split(".").map(Number)
    const requiredParts = required.split(".").map(Number)

    for (let i = 0; i < Math.max(currentParts.length, requiredParts.length); i++) {
      const currentPart = currentParts[i] || 0
      const requiredPart = requiredParts[i] || 0

      if (currentPart > requiredPart) return true
      if (currentPart < requiredPart) return false
    }

    return true
  }

  // Sistem bilgilerini topla
  getSystemInfo() {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      npmVersion: this.getNpmVersion(),
      pythonVersion: this.getPythonVersion(),
      electronVersion: this.getElectronVersion(),
      timestamp: new Date().toISOString()
    }
  }

  getNpmVersion() {
    try {
      return execSync("npm --version", { encoding: "utf8" }).trim()
    } catch {
      return "unknown"
    }
  }

  getPythonVersion() {
    try {
      return execSync("python --version", { encoding: "utf8" }).trim()
    } catch {
      return "not found"
    }
  }

  getElectronVersion() {
    try {
      const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"))
      return packageJson.devDependencies.electron || "unknown"
    } catch {
      return "unknown"
    }
  }
}

// Kurulumu çalıştır
const setupManager = new SetupManager()

process.on("SIGINT", () => {
  console.log("\n⚠️  Kurulum iptal edildi")
  process.exit(0)
})

setupManager.runSetup().catch((error) => {
  console.error("❌ Kurulum başarısız:", error.message)
  process.exit(1)
})