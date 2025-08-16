#!/usr/bin/env node

const { build } = require("electron-builder")
const path = require("path")
const fs = require("fs")

console.log("🚀 PROVANYA POS Build Başlatılıyor...")

const buildConfig = {
  config: path.join(__dirname, "..", "electron-builder.json"),
  publish: "never",
  win: ["nsis:x64"],
  x64: true,
}

function preBuildChecks() {
  console.log("🔍 Pre-build kontrolleri yapılıyor...")

  const distDir = path.join(__dirname, "..", "dist")
  if (fs.existsSync(distDir)) {
    console.log("🧹 Eski build dosyaları temizleniyor...")
    fs.rmSync(distDir, { recursive: true, force: true })
  }

  const requiredFiles = ["package.json", "src/main.js", "src/preload.js", "src/renderer/index.html"]

  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, "..", file)
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Gerekli dosya bulunamadı: ${file}`)
      process.exit(1)
    }
  }

  console.log("✅ Pre-build kontrolleri tamamlandı")
}

function postBuildActions() {
  console.log("🎯 Post-build işlemleri yapılıyor...")

  const distDir = path.join(__dirname, "..", "dist")
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir)
    console.log("📦 Oluşturulan dosyalar:")
    files.forEach((file) => {
      const filePath = path.join(distDir, file)
      const stats = fs.statSync(filePath)
      const size = (stats.size / 1024 / 1024).toFixed(2)
      console.log(`   📄 ${file} (${size} MB)`)
    })
  }

  console.log("✅ Windows EXE installer başarıyla oluşturuldu!")
}

async function runBuild() {
  try {
    preBuildChecks()
    console.log("🔨 Windows x64 platformu için build başlatılıyor...")

    await build(buildConfig)

    postBuildActions()
  } catch (error) {
    console.error("❌ Build hatası:", error.message)
    process.exit(1)
  }
}

process.on("SIGINT", () => {
  console.log("\n⚠️  Build işlemi iptal edildi")
  process.exit(0)
})

runBuild()
