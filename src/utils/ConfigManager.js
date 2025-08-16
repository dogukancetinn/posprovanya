// Yapılandırma yöneticisi
const Store = require("electron-store")
const path = require("path")
const { app } = require("electron")
const logger = require("./Logger")

class ConfigManager {
  constructor() {
    this.store = new Store({
      name: "config",
      cwd: app.getPath("userData"),
      encryptionKey: this.getEncryptionKey(),
      schema: {
        woocommerce: {
          type: "object",
          properties: {
            url: { type: "string" },
            consumerKey: { type: "string" },
            consumerSecret: { type: "string" },
            enabled: { type: "boolean", default: false }
          }
        },
        subdomain: {
          type: "object",
          properties: {
            url: { type: "string" },
            apiKey: { type: "string" },
            enabled: { type: "boolean", default: false }
          }
        },
        pos: {
          type: "object",
          properties: {
            device: { type: "string", default: "beko300tr" },
            port: { type: "string", default: "COM1" },
            enabled: { type: "boolean", default: false }
          }
        },
        sync: {
          type: "object",
          properties: {
            autoEnabled: { type: "boolean", default: true },
            intervalMinutes: { type: "number", default: 15 },
            conflictResolution: { type: "string", default: "local_wins" }
          }
        },
        backup: {
          type: "object",
          properties: {
            autoEnabled: { type: "boolean", default: true },
            intervalHours: { type: "number", default: 24 },
            location: { type: "string", default: "" },
            retention: { type: "number", default: 30 }
          }
        },
        app: {
          type: "object",
          properties: {
            version: { type: "string", default: "1.0.0" },
            firstRun: { type: "boolean", default: true },
            language: { type: "string", default: "tr" },
            theme: { type: "string", default: "light" }
          }
        }
      }
    })

    this.initializeDefaults()
  }

  getEncryptionKey() {
    // Güvenli şifreleme anahtarı
    const keyPath = path.join(app.getPath("userData"), ".configkey")
    
    try {
      if (require("fs").existsSync(keyPath)) {
        return require("fs").readFileSync(keyPath, "utf8")
      } else {
        const key = require("crypto").randomBytes(32).toString("hex")
        require("fs").writeFileSync(keyPath, key, { mode: 0o600 })
        return key
      }
    } catch (error) {
      logger.error("Config encryption key error:", error)
      return "provanya-pos-config-key-2024"
    }
  }

  initializeDefaults() {
    // İlk çalıştırma kontrolü
    if (this.get("app.firstRun", true)) {
      logger.info("First run detected, initializing default configuration")
      
      // Varsayılan backup konumu
      const defaultBackupLocation = path.join(app.getPath("documents"), "PROVANYA", "Backups")
      this.set("backup.location", defaultBackupLocation)
      
      // İlk çalıştırma flag'ini kapat
      this.set("app.firstRun", false)
    }
  }

  // Ayar alma
  get(key, defaultValue = null) {
    try {
      return this.store.get(key, defaultValue)
    } catch (error) {
      logger.error(`Config get error for key ${key}:`, error)
      return defaultValue
    }
  }

  // Ayar kaydetme
  set(key, value) {
    try {
      this.store.set(key, value)
      logger.debug(`Config set: ${key} = ${typeof value === 'object' ? JSON.stringify(value) : value}`)
      return { success: true }
    } catch (error) {
      logger.error(`Config set error for key ${key}:`, error)
      return { success: false, error: error.message }
    }
  }

  // Tüm ayarları al
  getAll() {
    try {
      return this.store.store
    } catch (error) {
      logger.error("Config get all error:", error)
      return {}
    }
  }

  // Ayarları sıfırla
  reset() {
    try {
      this.store.clear()
      this.initializeDefaults()
      logger.info("Configuration reset to defaults")
      return { success: true }
    } catch (error) {
      logger.error("Config reset error:", error)
      return { success: false, error: error.message }
    }
  }

  // WooCommerce ayarları
  getWooCommerceConfig() {
    return this.get("woocommerce", {})
  }

  setWooCommerceConfig(config) {
    return this.set("woocommerce", config)
  }

  // Subdomain ayarları
  getSubdomainConfig() {
    return this.get("subdomain", {})
  }

  setSubdomainConfig(config) {
    return this.set("subdomain", config)
  }

  // POS ayarları
  getPOSConfig() {
    return this.get("pos", {})
  }

  setPOSConfig(config) {
    return this.set("pos", config)
  }

  // Sync ayarları
  getSyncConfig() {
    return this.get("sync", {})
  }

  setSyncConfig(config) {
    return this.set("sync", config)
  }

  // Backup ayarları
  getBackupConfig() {
    return this.get("backup", {})
  }

  setBackupConfig(config) {
    return this.set("backup", config)
  }

  // Uygulama ayarları
  getAppConfig() {
    return this.get("app", {})
  }

  setAppConfig(config) {
    return this.set("app", config)
  }

  // Ayar doğrulama
  validateConfig(section, config) {
    const validators = {
      woocommerce: (cfg) => {
        if (!cfg.url || !cfg.consumerKey || !cfg.consumerSecret) {
          return { valid: false, error: "WooCommerce ayarları eksik" }
        }
        
        try {
          new URL(cfg.url)
        } catch {
          return { valid: false, error: "Geçersiz WooCommerce URL" }
        }
        
        return { valid: true }
      },
      
      subdomain: (cfg) => {
        if (!cfg.url || !cfg.apiKey) {
          return { valid: false, error: "Subdomain ayarları eksik" }
        }
        
        try {
          new URL(cfg.url)
        } catch {
          return { valid: false, error: "Geçersiz subdomain URL" }
        }
        
        return { valid: true }
      },
      
      sync: (cfg) => {
        if (cfg.intervalMinutes < 1 || cfg.intervalMinutes > 1440) {
          return { valid: false, error: "Sync aralığı 1-1440 dakika arasında olmalı" }
        }
        
        return { valid: true }
      }
    }

    const validator = validators[section]
    if (validator) {
      return validator(config)
    }

    return { valid: true }
  }

  // Konfigürasyon export/import
  async exportConfig() {
    try {
      const config = this.getAll()
      const exportData = {
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        config: config
      }
      
      return { success: true, data: exportData }
    } catch (error) {
      logger.error("Export config error:", error)
      return { success: false, error: error.message }
    }
  }

  async importConfig(configData) {
    try {
      if (!configData.config) {
        throw new Error("Invalid config data")
      }
      
      // Backup current config
      const currentConfig = this.getAll()
      const backupPath = path.join(app.getPath("userData"), `config_backup_${Date.now()}.json`)
      require("fs").writeFileSync(backupPath, JSON.stringify(currentConfig, null, 2))
      
      // Import new config
      for (const [key, value] of Object.entries(configData.config)) {
        this.set(key, value)
      }
      
      logger.info("Configuration imported successfully")
      return { success: true, backupPath }
    } catch (error) {
      logger.error("Import config error:", error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = new ConfigManager()