// Gelişmiş logging sistemi
const log = require("electron-log")
const path = require("path")
const fs = require("fs")
const { app } = require("electron")

class Logger {
  constructor() {
    this.setupLogging()
  }

  setupLogging() {
    // Log dosyası konumları
    const logsDir = path.join(app.getPath("userData"), "logs")
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true })
    }

    // Ana log dosyası
    log.transports.file.resolvePathFn = () => path.join(logsDir, "main.log")
    log.transports.file.level = "info"
    log.transports.file.maxSize = 10 * 1024 * 1024 // 10MB
    log.transports.file.format = "{y}-{m}-{d} {h}:{i}:{s} [{level}] {text}"

    // Console transport
    log.transports.console.level = process.env.NODE_ENV === "development" ? "debug" : "info"
    log.transports.console.format = "{h}:{i}:{s} [{level}] {text}"

    // Error log dosyası
    const errorLog = log.create("error")
    errorLog.transports.file.resolvePathFn = () => path.join(logsDir, "error.log")
    errorLog.transports.file.level = "error"
    errorLog.transports.console.level = false

    // Sync log dosyası
    const syncLog = log.create("sync")
    syncLog.transports.file.resolvePathFn = () => path.join(logsDir, "sync.log")
    syncLog.transports.file.level = "info"
    syncLog.transports.console.level = false

    // POS log dosyası
    const posLog = log.create("pos")
    posLog.transports.file.resolvePathFn = () => path.join(logsDir, "pos.log")
    posLog.transports.file.level = "info"
    posLog.transports.console.level = false

    this.mainLog = log
    this.errorLog = errorLog
    this.syncLog = syncLog
    this.posLog = posLog
  }

  info(message, data = null) {
    if (data) {
      this.mainLog.info(message, data)
    } else {
      this.mainLog.info(message)
    }
  }

  warn(message, data = null) {
    if (data) {
      this.mainLog.warn(message, data)
    } else {
      this.mainLog.warn(message)
    }
  }

  error(message, error = null) {
    if (error) {
      this.mainLog.error(message, error)
      this.errorLog.error(message, error)
    } else {
      this.mainLog.error(message)
      this.errorLog.error(message)
    }
  }

  debug(message, data = null) {
    if (data) {
      this.mainLog.debug(message, data)
    } else {
      this.mainLog.debug(message)
    }
  }

  sync(message, data = null) {
    if (data) {
      this.syncLog.info(message, data)
    } else {
      this.syncLog.info(message)
    }
  }

  pos(message, data = null) {
    if (data) {
      this.posLog.info(message, data)
    } else {
      this.posLog.info(message)
    }
  }

  // Log dosyalarını temizle
  async clearLogs() {
    try {
      const logsDir = path.join(app.getPath("userData"), "logs")
      const files = fs.readdirSync(logsDir)
      
      for (const file of files) {
        if (file.endsWith('.log')) {
          fs.unlinkSync(path.join(logsDir, file))
        }
      }
      
      this.info("Log files cleared")
      return { success: true }
    } catch (error) {
      this.error("Clear logs error:", error)
      return { success: false, error: error.message }
    }
  }

  // Log dosyalarını al
  async getLogs(type = "main", lines = 100) {
    try {
      const logsDir = path.join(app.getPath("userData"), "logs")
      const logFile = path.join(logsDir, `${type}.log`)
      
      if (!fs.existsSync(logFile)) {
        return { success: true, logs: [] }
      }
      
      const content = fs.readFileSync(logFile, "utf8")
      const logLines = content.split("\n").filter(line => line.trim())
      const recentLogs = logLines.slice(-lines)
      
      return { success: true, logs: recentLogs }
    } catch (error) {
      this.error("Get logs error:", error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = new Logger()