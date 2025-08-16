// Merkezi hata yönetimi
const { dialog } = require("electron")
const logger = require("./Logger")

class ErrorHandler {
  constructor() {
    this.setupGlobalErrorHandling()
  }

  setupGlobalErrorHandling() {
    // Uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error)
      
      // Kritik hata dialog'u göster
      dialog.showErrorBox(
        "Kritik Hata",
        `Beklenmeyen bir hata oluştu:\n\n${error.message}\n\nUygulama yeniden başlatılacak.`
      )
      
      // Uygulamayı yeniden başlat
      this.restartApplication()
    })

    // Unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Promise Rejection:", { reason, promise })
      
      // Promise rejection'ları için daha az agresif yaklaşım
      console.warn("Unhandled Promise Rejection:", reason)
    })
  }

  // Hata kategorileri
  handleDatabaseError(error, context = "Database") {
    logger.error(`${context} Error:`, error)
    
    let userMessage = "Veritabanı hatası oluştu"
    
    if (error.message.includes("SQLITE_BUSY")) {
      userMessage = "Veritabanı meşgul, lütfen tekrar deneyin"
    } else if (error.message.includes("SQLITE_LOCKED")) {
      userMessage = "Veritabanı kilitli"
    } else if (error.message.includes("SQLITE_CORRUPT")) {
      userMessage = "Veritabanı bozuk, yedekten geri yükleme gerekli"
    }
    
    return {
      success: false,
      error: userMessage,
      technical: error.message
    }
  }

  handleNetworkError(error, context = "Network") {
    logger.error(`${context} Error:`, error)
    
    let userMessage = "Ağ bağlantısı hatası"
    
    if (error.code === "ENOTFOUND") {
      userMessage = "Sunucu bulunamadı"
    } else if (error.code === "ECONNREFUSED") {
      userMessage = "Bağlantı reddedildi"
    } else if (error.code === "ETIMEDOUT") {
      userMessage = "Bağlantı zaman aşımı"
    } else if (error.response?.status === 401) {
      userMessage = "Yetkilendirme hatası"
    } else if (error.response?.status === 403) {
      userMessage = "Erişim reddedildi"
    } else if (error.response?.status >= 500) {
      userMessage = "Sunucu hatası"
    }
    
    return {
      success: false,
      error: userMessage,
      technical: error.message,
      status: error.response?.status
    }
  }

  handleAPIError(error, context = "API") {
    logger.error(`${context} Error:`, error)
    
    if (error.response) {
      const status = error.response.status
      const data = error.response.data
      
      let userMessage = `API hatası (${status})`
      
      if (data?.message) {
        userMessage = data.message
      } else if (data?.error) {
        userMessage = data.error
      }
      
      return {
        success: false,
        error: userMessage,
        status: status,
        technical: error.message
      }
    }
    
    return this.handleNetworkError(error, context)
  }

  handleFileSystemError(error, context = "FileSystem") {
    logger.error(`${context} Error:`, error)
    
    let userMessage = "Dosya sistemi hatası"
    
    if (error.code === "ENOENT") {
      userMessage = "Dosya bulunamadı"
    } else if (error.code === "EACCES") {
      userMessage = "Dosya erişim izni yok"
    } else if (error.code === "ENOSPC") {
      userMessage = "Disk alanı yetersiz"
    }
    
    return {
      success: false,
      error: userMessage,
      technical: error.message
    }
  }

  // Uygulama yeniden başlatma
  restartApplication() {
    const { app } = require("electron")
    
    logger.info("Restarting application due to critical error")
    
    app.relaunch()
    app.exit(0)
  }

  // Hata raporlama
  async reportError(error, context, userAction = null) {
    try {
      const errorReport = {
        timestamp: new Date().toISOString(),
        context: context,
        userAction: userAction,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          electronVersion: process.versions.electron
        }
      }
      
      logger.error("Error Report:", errorReport)
      
      // Gelecekte error reporting service'e gönderilebilir
      
    } catch (reportError) {
      logger.error("Error reporting failed:", reportError)
    }
  }
}

module.exports = new ErrorHandler()