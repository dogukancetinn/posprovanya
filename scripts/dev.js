#!/usr/bin/env node

const { spawn } = require("child_process")
const path = require("path")
const fs = require("fs")
const chokidar = require("chokidar")

console.log("🚀 PROVANYA POS Development Server Başlatılıyor...")

let electronProcess = null
let isRestarting = false

// Development configuration
const config = {
  electronPath: path.join(__dirname, "..", "node_modules", ".bin", "electron"),
  mainScript: path.join(__dirname, "..", "src", "main.js"),
  watchPaths: ["src/**/*.js", "src/**/*.html", "src/**/*.css", "src/**/*.json"],
  ignorePaths: ["node_modules/**", "dist/**", ".git/**", "logs/**", "database/**/*.db"],
}

// Start Electron process
function startElectron() {
  if (electronProcess) {
    return
  }

  console.log("⚡ Electron uygulaması başlatılıyor...")

  const args = [config.mainScript]

  // Add development flags
  if (process.env.NODE_ENV === "development") {
    args.push("--inspect=9229")
    args.push("--remote-debugging-port=9222")
  }

  electronProcess = spawn(config.electronPath, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "development",
      ELECTRON_IS_DEV: "1",
    },
  })

  electronProcess.on("close", (code) => {
    if (!isRestarting) {
      console.log(`📱 Electron uygulaması kapandı (kod: ${code})`)
      electronProcess = null

      if (code !== 0 && code !== null) {
        console.log("🔄 Uygulama yeniden başlatılıyor...")
        setTimeout(startElectron, 1000)
      }
    }
  })

  electronProcess.on("error", (error) => {
    console.error("❌ Electron hatası:", error.message)
    electronProcess = null
  })

  console.log("✅ Electron uygulaması başlatıldı")
}

// Restart Electron process
function restartElectron() {
  if (isRestarting) {
    return
  }

  isRestarting = true
  console.log("🔄 Değişiklik algılandı, uygulama yeniden başlatılıyor...")

  if (electronProcess) {
    electronProcess.removeAllListeners("close")
    electronProcess.kill("SIGTERM")

    // Wait for process to close
    setTimeout(() => {
      electronProcess = null
      isRestarting = false
      startElectron()
    }, 1000)
  } else {
    isRestarting = false
    startElectron()
  }
}

// Setup file watcher
function setupWatcher() {
  console.log("👀 Dosya değişiklikleri izleniyor...")

  const watcher = chokidar.watch(config.watchPaths, {
    ignored: config.ignorePaths,
    persistent: true,
    ignoreInitial: true,
  })

  let changeTimeout = null

  watcher.on("change", (filePath) => {
    console.log(`📝 Değişiklik: ${path.relative(process.cwd(), filePath)}`)

    // Debounce changes
    if (changeTimeout) {
      clearTimeout(changeTimeout)
    }

    changeTimeout = setTimeout(() => {
      restartElectron()
    }, 500)
  })

  watcher.on("add", (filePath) => {
    console.log(`➕ Yeni dosya: ${path.relative(process.cwd(), filePath)}`)
    restartElectron()
  })

  watcher.on("unlink", (filePath) => {
    console.log(`➖ Silinen dosya: ${path.relative(process.cwd(), filePath)}`)
    restartElectron()
  })

  watcher.on("error", (error) => {
    console.error("❌ Watcher hatası:", error.message)
  })

  return watcher
}

// Pre-development checks
function preDevChecks() {
  console.log("🔍 Development kontrolleri yapılıyor...")

  // Check if Electron is installed
  if (!fs.existsSync(config.electronPath)) {
    console.error("❌ Electron bulunamadı. npm install çalıştırın.")
    process.exit(1)
  }

  // Check main script
  if (!fs.existsSync(config.mainScript)) {
    console.error("❌ Ana script bulunamadı:", config.mainScript)
    process.exit(1)
  }

  // Create logs directory
  const logsDir = path.join(__dirname, "..", "logs")
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }

  console.log("✅ Development kontrolleri tamamlandı")
}

// Handle process signals
process.on("SIGINT", () => {
  console.log("\n⚠️  Development server kapatılıyor...")

  if (electronProcess) {
    electronProcess.kill("SIGTERM")
  }

  process.exit(0)
})

process.on("SIGTERM", () => {
  console.log("\n⚠️  Development server sonlandırıldı")

  if (electronProcess) {
    electronProcess.kill("SIGTERM")
  }

  process.exit(0)
})

// Main development function
async function runDevelopment() {
  try {
    preDevChecks()

    // Setup file watcher
    const watcher = setupWatcher()

    // Start Electron
    startElectron()

    console.log("🎯 Development server hazır!")
    console.log("📋 Komutlar:")
    console.log("   Ctrl+C: Sunucuyu durdur")
    console.log("   r + Enter: Manuel yeniden başlat")

    // Handle manual restart
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (data) => {
      const input = data.toString().trim().toLowerCase()
      if (input === "r" || input === "restart") {
        restartElectron()
      }
    })
  } catch (error) {
    console.error("❌ Development server hatası:", error.message)
    process.exit(1)
  }
}

// Run development server
runDevelopment()
