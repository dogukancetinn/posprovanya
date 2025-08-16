// Senkronizasyon yöneticisi - Offline/Online mod ve veri senkronizasyonu
const cron = require("node-cron")
const axios = require("axios")
const OfflineManager = require("./OfflineManager")
const log = require("electron-log")

class SyncManager {
  constructor(dbManager, wooAPI = null) {
    this.dbManager = dbManager
    this.wooAPI = wooAPI
    this.offlineManager = new OfflineManager(dbManager)
    this.isOnline = false
    this.isSyncing = false
    this.lastSyncTime = 0
    this.syncInterval = null
    this.autoSyncEnabled = true
    this.syncIntervalMinutes = 15
    this.maxRetries = 3
    this.retryDelay = 5000 // 5 saniye
    this.subdomainConfig = {
      url: null,
      apiKey: null,
      encrypted: true,
    }
    this.syncQueue = []
    this.conflictResolutionStrategy = "local_wins" // 'local_wins', 'remote_wins', 'merge'
    this.connectionCheckInterval = null
  }

  // Sync manager'ı başlat
  async initialize() {
    try {
      // Ayarları yükle
      await this.loadSettings()

      // Son sync zamanını al
      this.lastSyncTime = Number.parseInt(await this.dbManager.getSetting("last_sync_time", "0"))

      // WooCommerce API'yi initialize et
      if (this.wooAPI) {
        await this.wooAPI.initialize()
      }

      // Otomatik sync'i başlat
      if (this.autoSyncEnabled) {
        this.startAutoSync()
      }

      // İnternet bağlantısını kontrol et
      this.startConnectionMonitoring()

      log.info("SyncManager initialized successfully")
      return { success: true }
    } catch (error) {
      log.error("SyncManager initialization error:", error)
      return {
        success: false,
        error: "Sync manager başlatılamadı: " + error.message,
      }
    }
  }

  // Ayarları yükle
  async loadSettings() {
    try {
      this.subdomainConfig.url = await this.dbManager.getSetting("subdomain_db_url")
      this.subdomainConfig.apiKey = await this.dbManager.getSetting("subdomain_api_key")
      this.autoSyncEnabled = (await this.dbManager.getSetting("auto_sync_enabled", "1")) === "1"
      this.syncIntervalMinutes = Number.parseInt(await this.dbManager.getSetting("sync_interval_minutes", "15"))
      this.conflictResolutionStrategy = await this.dbManager.getSetting("conflict_resolution", "local_wins")
    } catch (error) {
      console.error("Load sync settings error:", error)
    }
  }

  // Subdomain yapılandırmasını güncelle
  async configureSubdomain(config) {
    try {
      await this.dbManager.setSetting("subdomain_db_url", config.url, true)
      await this.dbManager.setSetting("subdomain_api_key", config.apiKey, true)

      this.subdomainConfig.url = config.url
      this.subdomainConfig.apiKey = config.apiKey

      // Bağlantıyı test et
      const testResult = await this.testSubdomainConnection()

      return testResult
    } catch (error) {
      console.error("Configure subdomain error:", error)
      return {
        success: false,
        error: "Subdomain yapılandırılamadı: " + error.message,
      }
    }
  }

  // Subdomain bağlantısını test et
  async testSubdomainConnection() {
    try {
      if (!this.subdomainConfig.url || !this.subdomainConfig.apiKey) {
        return {
          success: false,
          error: "Subdomain yapılandırması eksik",
        }
      }

      const response = await axios.get(`${this.subdomainConfig.url}/api/health`, {
        headers: {
          Authorization: `Bearer ${this.subdomainConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      })

      if (response.status === 200) {
        return {
          success: true,
          data: response.data,
        }
      } else {
        return {
          success: false,
          error: `HTTP ${response.status}`,
        }
      }
    } catch (error) {
      console.error("Subdomain connection test error:", error)
      return {
        success: false,
        error: "Subdomain bağlantı testi başarısız: " + error.message,
      }
    }
  }

  // Otomatik senkronizasyonu başlat
  startAutoSync() {
    if (this.syncInterval) {
      this.syncInterval.destroy()
    }

    // Cron job ile periyodik sync
    const cronExpression = `*/${this.syncIntervalMinutes} * * * *`
    this.syncInterval = cron.schedule(cronExpression, async () => {
      if (this.isOnline && !this.isSyncing) {
        console.log("Auto sync triggered")
        await this.syncNow()
      }
    })

    console.log(`Auto sync started with ${this.syncIntervalMinutes} minute intervals`)
  }

  // Otomatik senkronizasyonu durdur
  stopAutoSync() {
    if (this.syncInterval) {
      this.syncInterval.destroy()
      this.syncInterval = null
      console.log("Auto sync stopped")
    }
  }

  // İnternet bağlantısı izlemeyi başlat
  startConnectionMonitoring() {
    this.connectionCheckInterval = setInterval(async () => {
      const wasOnline = this.isOnline
      this.isOnline = await this.checkInternetConnection()

      if (!wasOnline && this.isOnline) {
        log.info("Internet connection restored, starting sync...")

        // Offline moddan çık
        if (this.offlineManager.isOfflineMode) {
          await this.offlineManager.exitOfflineMode()

          // Offline kuyruğunu işle
          await this.offlineManager.processOfflineQueue()
        }

        // Bağlantı geri geldiğinde bekleyen satışları senkronize et
        setTimeout(() => {
          this.syncPendingSales()
        }, 2000)
      } else if (wasOnline && !this.isOnline) {
        log.warn("Internet connection lost, entering offline mode...")

        // Offline moda geç
        await this.offlineManager.enterOfflineMode()
      }
    }, 10000) // Her 10 saniyede kontrol et
  }

  // İnternet bağlantısını kontrol et
  async checkInternetConnection() {
    try {
      const response = await axios.get("https://httpbin.org/status/200", {
        timeout: 5000,
        validateStatus: () => true,
      })
      return response.status === 200
    } catch (error) {
      log.debug("Internet connection check failed:", error.message)
      return false
    }
  }

  // Manuel senkronizasyon
  async syncNow() {
    if (this.isSyncing) {
      return {
        success: false,
        error: "Senkronizasyon zaten devam ediyor",
      }
    }

    this.isSyncing = true

    try {
      console.log("Starting manual sync...")

      const results = {
        pendingSales: { success: 0, failed: 0 },
        products: { success: 0, failed: 0 },
        woocommerce: { success: 0, failed: 0 },
        subdomain: { success: 0, failed: 0 },
        offline: { success: 0, failed: 0 },
      }

      // 1. Offline kuyruğunu işle
      if (this.isOnline && this.offlineManager.offlineQueue.length > 0) {
        const offlineResult = await this.offlineManager.processOfflineQueue()
        results.offline = {
          success: offlineResult.processed || 0,
          failed: offlineResult.failed || 0,
        }
      }

      // 2. Bekleyen satışları senkronize et
      if (this.isOnline) {
        const salesResult = await this.syncPendingSales()
        results.pendingSales = salesResult.summary || { success: 0, failed: 0 }
      }

      // 3. WooCommerce ile senkronizasyon
      if (this.wooAPI && this.wooAPI.isConfigured && this.isOnline) {
        const wooResult = await this.syncWithWooCommerce()
        results.woocommerce = wooResult.summary || { success: 0, failed: 0 }
      }

      // 4. Subdomain ile senkronizasyon
      if (this.subdomainConfig.url && this.isOnline) {
        const subdomainResult = await this.syncWithSubdomain()
        results.subdomain = subdomainResult.summary || { success: 0, failed: 0 }
      }

      // Son sync zamanını güncelle
      this.lastSyncTime = Date.now()
      await this.dbManager.setSetting("last_sync_time", this.lastSyncTime.toString())

      console.log("Manual sync completed successfully")

      return {
        success: true,
        results: results,
        syncedAt: new Date(this.lastSyncTime).toISOString(),
      }
    } catch (error) {
      console.error("Manual sync error:", error)
      return {
        success: false,
        error: "Senkronizasyon hatası: " + error.message,
      }
    } finally {
      this.isSyncing = false
    }
  }
    log.info("Manual sync completed successfully", results)
  // Bekleyen satışları senkronize et
  async syncPendingSales() {
    try {
      const pendingSales = await this.dbManager.getPendingSales()

      if (pendingSales.length === 0) {
        return {
          success: true,
          message: "Bekleyen satış yok",
          summary: { success: 0, failed: 0 },
        }
      }

      console.log(`Syncing ${pendingSales.length} pending sales...`)

      const results = []
      let successCount = 0
      let failedCount = 0

      for (const sale of pendingSales) {
        try {
          // WooCommerce stok güncelleme
          if (this.wooAPI) {
            const stockResult = await this.wooAPI.updateStock(sale.items)
            if (stockResult.success) {
              console.log(`Stock updated for sale ${sale.sale_number}`)
            }
          }

          // Subdomain'e satış gönder
          if (this.subdomainConfig.url) {
            const subdomainResult = await this.sendSaleToSubdomain(sale)
            if (subdomainResult.success) {
              console.log(`Sale ${sale.sale_number} sent to subdomain`)
            }
          }

          // Satışı senkronize edildi olarak işaretle
          await this.dbManager.markSaleAsSynced(sale.id)

          results.push({
            saleId: sale.id,
            saleNumber: sale.sale_number,
            success: true,
          })

          successCount++

          // Sync log kaydet
          await this.dbManager.addSyncLog("sale_sync", "sales", sale.id, "success", `Sale synced: ${sale.sale_number}`)
        } catch (error) {
          console.error(`Failed to sync sale ${sale.sale_number}:`, error)

          results.push({
            saleId: sale.id,
            saleNumber: sale.sale_number,
            success: false,
            error: error.message,
          })

          failedCount++

          // Sync log kaydet
          await this.dbManager.addSyncLog("sale_sync", "sales", sale.id, "error", error.message)
        }

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      return {
        success: true,
        results: results,
        summary: {
          total: pendingSales.length,
          success: successCount,
          failed: failedCount,
        },
      }
    } catch (error) {
      console.error("Sync pending sales error:", error)
      return {
        success: false,
        error: "Bekleyen satış senkronizasyonu hatası: " + error.message,
      }
    }
  }

  // WooCommerce ile senkronizasyon
  async syncWithWooCommerce() {
    try {
      if (!this.wooAPI || !this.wooAPI.isConfigured) {
        return {
          success: false,
          error: "WooCommerce API yapılandırılmamış",
        }
      }

      console.log("Syncing with WooCommerce...")

      // Ürünleri senkronize et
      const productResult = await this.wooAPI.syncAllProducts()

      if (productResult.success) {
        // Kategorileri senkronize et
        const categoryResult = await this.wooAPI.syncCategories()

        return {
          success: true,
          summary: {
            products: productResult.summary,
            categories: categoryResult.success ? categoryResult.summary : { total: 0, errors: 1 },
          },
        }
      } else {
        return productResult
      }
    } catch (error) {
      console.error("WooCommerce sync error:", error)
      return {
        success: false,
        error: "WooCommerce senkronizasyonu hatası: " + error.message,
      }
    }
  }

  // Subdomain ile senkronizasyon
  async syncWithSubdomain() {
    try {
      if (!this.subdomainConfig.url || !this.subdomainConfig.apiKey) {
        return {
          success: false,
          error: "Subdomain yapılandırılmamış",
        }
      }

      console.log("Syncing with subdomain...")

      const results = {
        products: { success: 0, failed: 0 },
        sales: { success: 0, failed: 0 },
        settings: { success: 0, failed: 0 },
      }

      // Ürünleri senkronize et
      const productResult = await this.syncProductsWithSubdomain()
      results.products = productResult.summary || { success: 0, failed: 0 }

      // Satışları senkronize et
      const salesResult = await this.syncSalesWithSubdomain()
      results.sales = salesResult.summary || { success: 0, failed: 0 }

      // Ayarları senkronize et
      const settingsResult = await this.syncSettingsWithSubdomain()
      results.settings = settingsResult.summary || { success: 0, failed: 0 }

      return {
        success: true,
        summary: results,
      }
    } catch (error) {
      console.error("Subdomain sync error:", error)
      return {
        success: false,
        error: "Subdomain senkronizasyonu hatası: " + error.message,
      }
    }
  }

  // Satışı subdomain'e gönder
  async sendSaleToSubdomain(sale) {
    try {
      const response = await axios.post(
        `${this.subdomainConfig.url}/api/sales`,
        {
          sale_number: sale.sale_number,
          subtotal: sale.subtotal,
          discount: sale.discount,
          total: sale.total,
          payment_method: sale.payment_method,
          customer_name: sale.customer_name,
          customer_phone: sale.customer_phone,
          items: sale.items,
          created_at: sale.created_at,
          pos_device_id: await this.dbManager.getSetting("pos_device_id"),
        },
        {
          headers: {
            Authorization: `Bearer ${this.subdomainConfig.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        },
      )

      return {
        success: true,
        data: response.data,
      }
    } catch (error) {
      console.error("Send sale to subdomain error:", error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  // Ürünleri subdomain ile senkronize et
  async syncProductsWithSubdomain() {
    try {
      // Local ürünleri al
      const localProducts = await this.dbManager.allQuery(
        `
        SELECT * FROM products 
        WHERE updated_at > datetime(?, 'unixepoch') 
        ORDER BY updated_at DESC
      `,
        [this.lastSyncTime / 1000],
      )

      let successCount = 0
      let failedCount = 0

      for (const product of localProducts) {
        try {
          const response = await axios.post(
            `${this.subdomainConfig.url}/api/products/sync`,
            {
              local_id: product.id,
              name: product.name,
              barcode: product.barcode,
              price: product.price,
              stock: product.stock,
              category: product.category,
              description: product.description,
              image: product.image,
              woocommerce_id: product.woocommerce_id,
              is_active: product.is_active,
              updated_at: product.updated_at,
            },
            {
              headers: {
                Authorization: `Bearer ${this.subdomainConfig.apiKey}`,
                "Content-Type": "application/json",
              },
              timeout: 15000,
            },
          )

          if (response.status === 200) {
            successCount++
          } else {
            failedCount++
          }
        } catch (error) {
          console.error(`Failed to sync product ${product.name}:`, error.message)
          failedCount++
        }

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      return {
        success: true,
        summary: {
          total: localProducts.length,
          success: successCount,
          failed: failedCount,
        },
      }
    } catch (error) {
      console.error("Sync products with subdomain error:", error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  // Satışları subdomain ile senkronize et
  async syncSalesWithSubdomain() {
    try {
      // Son sync'ten sonraki satışları al
      const recentSales = await this.dbManager.allQuery(
        `
        SELECT s.*, GROUP_CONCAT(
          json_object(
            'product_id', si.product_id,
            'product_name', si.product_name,
            'quantity', si.quantity,
            'unit_price', si.unit_price,
            'total_price', si.total_price
          )
        ) as items_json
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE s.created_at > datetime(?, 'unixepoch')
        AND s.synced = 1
        GROUP BY s.id
        ORDER BY s.created_at DESC
      `,
        [this.lastSyncTime / 1000],
      )

      let successCount = 0
      let failedCount = 0

      for (const sale of recentSales) {
        try {
          // Items JSON'ını parse et
          const items = sale.items_json ? JSON.parse(`[${sale.items_json}]`) : []

          const response = await axios.post(
            `${this.subdomainConfig.url}/api/sales/sync`,
            {
              local_id: sale.id,
              sale_number: sale.sale_number,
              subtotal: sale.subtotal,
              discount: sale.discount,
              total: sale.total,
              payment_method: sale.payment_method,
              customer_name: sale.customer_name,
              customer_phone: sale.customer_phone,
              items: items,
              created_at: sale.created_at,
              pos_device_id: await this.dbManager.getSetting("pos_device_id"),
            },
            {
              headers: {
                Authorization: `Bearer ${this.subdomainConfig.apiKey}`,
                "Content-Type": "application/json",
              },
              timeout: 15000,
            },
          )

          if (response.status === 200) {
            successCount++
          } else {
            failedCount++
          }
        } catch (error) {
          console.error(`Failed to sync sale ${sale.sale_number}:`, error.message)
          failedCount++
        }

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      return {
        success: true,
        summary: {
          total: recentSales.length,
          success: successCount,
          failed: failedCount,
        },
      }
    } catch (error) {
      console.error("Sync sales with subdomain error:", error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  // Ayarları subdomain ile senkronize et
  async syncSettingsWithSubdomain() {
    try {
      const deviceId = await this.dbManager.getSetting("pos_device_id")
      const stats = await this.dbManager.getStats()

      const response = await axios.post(
        `${this.subdomainConfig.url}/api/devices/heartbeat`,
        {
          device_id: deviceId,
          stats: stats,
          last_sync: this.lastSyncTime,
          version: "1.0.0",
          status: "online",
        },
        {
          headers: {
            Authorization: `Bearer ${this.subdomainConfig.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
      )

      return {
        success: true,
        summary: { success: 1, failed: 0 },
      }
    } catch (error) {
      console.error("Sync settings with subdomain error:", error)
      return {
        success: false,
        summary: { success: 0, failed: 1 },
        error: error.message,
      }
    }
  }

  // Zorla senkronizasyon (conflict resolution ile)
  async forceSync() {
    try {
      console.log("Starting force sync with conflict resolution...")

      // Tüm bekleyen değişiklikleri senkronize et
      const result = await this.syncNow()

      if (result.success) {
        // Conflict resolution
        await this.resolveConflicts()

        return {
          success: true,
          message: "Zorla senkronizasyon tamamlandı",
          results: result.results,
        }
      } else {
        return result
      }
    } catch (error) {
      console.error("Force sync error:", error)
      return {
        success: false,
        error: "Zorla senkronizasyon hatası: " + error.message,
      }
    }
  }

  // Çakışmaları çöz
  async resolveConflicts() {
    try {
      console.log(`Resolving conflicts with strategy: ${this.conflictResolutionStrategy}`)

      // Çakışan kayıtları bul (aynı anda hem local hem remote'da değişen)
      const conflicts = await this.findConflicts()

      for (const conflict of conflicts) {
        switch (this.conflictResolutionStrategy) {
          case "local_wins":
            await this.resolveConflictLocalWins(conflict)
            break
          case "remote_wins":
            await this.resolveConflictRemoteWins(conflict)
            break
          case "merge":
            await this.resolveConflictMerge(conflict)
            break
          default:
            console.warn(`Unknown conflict resolution strategy: ${this.conflictResolutionStrategy}`)
        }
      }

      console.log(`Resolved ${conflicts.length} conflicts`)
    } catch (error) {
      console.error("Resolve conflicts error:", error)
    }
  }

  // Çakışmaları bul
  async findConflicts() {
    // Bu örnekte basit bir conflict detection
    // Gerçek implementasyonda timestamp ve checksum karşılaştırması yapılacak
    return []
  }

  // Local kazanır stratejisi
  async resolveConflictLocalWins(conflict) {
    console.log(`Resolving conflict (local wins): ${conflict.type} ${conflict.id}`)
    // Local veriyi remote'a gönder
  }

  // Remote kazanır stratejisi
  async resolveConflictRemoteWins(conflict) {
    console.log(`Resolving conflict (remote wins): ${conflict.type} ${conflict.id}`)
    // Remote veriyi local'e al
  }

  // Merge stratejisi
  async resolveConflictMerge(conflict) {
    console.log(`Resolving conflict (merge): ${conflict.type} ${conflict.id}`)
    // İki veriyi birleştir
  }

  // Sync durumunu al
    log.error("Manual sync error:", error)
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      lastSyncDate: this.lastSyncTime ? new Date(this.lastSyncTime).toISOString() : null,
      autoSyncEnabled: this.autoSyncEnabled,
      syncIntervalMinutes: this.syncIntervalMinutes,
      subdomainConfigured: !!(this.subdomainConfig.url && this.subdomainConfig.apiKey),
      woocommerceConfigured: !!(this.wooAPI && this.wooAPI.isConfigured),
      offlineStatus: this.offlineManager.getOfflineStatus(),
      queueStats: this.offlineManager.getQueueStats(),
    }
  }

  // Son sync zamanını al
  getLastSyncTime() {
    return this.lastSyncTime
  }

  // Offline operasyon ekle
  async addOfflineOperation(operation) {
    return await this.offlineManager.queueOfflineOperation(operation)
  }

  // Offline kuyruğunu temizle
  clearOfflineQueue() {
    return this.offlineManager.clearOfflineQueue()
  }

  // WooCommerce API'yi ayarla
  setWooCommerceAPI(wooAPI) {
    this.wooAPI = wooAPI
  }

  // Sync ayarlarını güncelle
  async updateSyncSettings(settings) {
    try {
      if (settings.autoSyncEnabled !== undefined) {
        this.autoSyncEnabled = settings.autoSyncEnabled
        await this.dbManager.setSetting("auto_sync_enabled", settings.autoSyncEnabled ? "1" : "0")

        if (settings.autoSyncEnabled) {
          this.startAutoSync()
        } else {
          this.stopAutoSync()
        }
      }

      if (settings.syncIntervalMinutes !== undefined) {
        this.syncIntervalMinutes = settings.syncIntervalMinutes
        await this.dbManager.setSetting("sync_interval_minutes", settings.syncIntervalMinutes.toString())

        if (this.autoSyncEnabled) {
          this.startAutoSync() // Restart with new interval
        }
      }

      if (settings.conflictResolutionStrategy !== undefined) {
        this.conflictResolutionStrategy = settings.conflictResolutionStrategy
        await this.dbManager.setSetting("conflict_resolution", settings.conflictResolutionStrategy)
      }

      return { success: true }
    } catch (error) {
      console.error("Update sync settings error:", error)
      return {
        success: false,
        error: "Sync ayarları güncellenemedi: " + error.message,
      }
    }
  }

  // Sync manager'ı durdur
  async stop() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval)
      this.connectionCheckInterval = null
    }
    
    this.stopAutoSync()
    log.info("SyncManager stopped")
  }
}

module.exports = SyncManager
