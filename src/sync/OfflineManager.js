// Offline mod yöneticisi
class OfflineManager {
  constructor(dbManager) {
    this.dbManager = dbManager
    this.isOfflineMode = false
    this.offlineQueue = []
    this.maxOfflineOperations = 1000
    this.offlineStartTime = null
  }

  // Offline moda geç
  async enterOfflineMode() {
    try {
      this.isOfflineMode = true
      this.offlineStartTime = Date.now()

      console.log("Entered offline mode")

      // Offline mod başlangıcını kaydet
      await this.dbManager.addSyncLog("offline_mode", "system", null, "info", "Entered offline mode")

      return { success: true }
    } catch (error) {
      console.error("Enter offline mode error:", error)
      return {
        success: false,
        error: "Offline moda geçilemedi: " + error.message,
      }
    }
  }

  // Online moda geç
  async exitOfflineMode() {
    try {
      this.isOfflineMode = false
      const offlineDuration = this.offlineStartTime ? Date.now() - this.offlineStartTime : 0

      console.log(`Exited offline mode after ${Math.round(offlineDuration / 1000)} seconds`)

      // Offline mod bitişini kaydet
      await this.dbManager.addSyncLog(
        "offline_mode",
        "system",
        null,
        "info",
        `Exited offline mode after ${Math.round(offlineDuration / 1000)} seconds`,
      )

      this.offlineStartTime = null

      return {
        success: true,
        offlineDuration: offlineDuration,
        queuedOperations: this.offlineQueue.length,
      }
    } catch (error) {
      console.error("Exit offline mode error:", error)
      return {
        success: false,
        error: "Online moda geçilemedi: " + error.message,
      }
    }
  }

  // Offline operasyon ekle
  async queueOfflineOperation(operation) {
    try {
      if (this.offlineQueue.length >= this.maxOfflineOperations) {
        // Eski operasyonları temizle
        this.offlineQueue.splice(0, 100)
      }

      const queuedOperation = {
        id: Date.now() + Math.random(),
        type: operation.type,
        data: operation.data,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
      }

      this.offlineQueue.push(queuedOperation)

      console.log(`Queued offline operation: ${operation.type}`)

      return {
        success: true,
        operationId: queuedOperation.id,
      }
    } catch (error) {
      console.error("Queue offline operation error:", error)
      return {
        success: false,
        error: "Offline operasyon kuyruğa eklenemedi: " + error.message,
      }
    }
  }

  // Offline kuyruğunu işle
  async processOfflineQueue() {
    try {
      if (this.offlineQueue.length === 0) {
        return {
          success: true,
          message: "Offline kuyruk boş",
          processed: 0,
        }
      }

      console.log(`Processing ${this.offlineQueue.length} offline operations...`)

      let processedCount = 0
      let failedCount = 0
      const failedOperations = []

      // Kuyruktaki operasyonları işle
      for (let i = this.offlineQueue.length - 1; i >= 0; i--) {
        const operation = this.offlineQueue[i]

        try {
          const result = await this.executeOfflineOperation(operation)

          if (result.success) {
            // Başarılı operasyonu kuyruktan çıkar
            this.offlineQueue.splice(i, 1)
            processedCount++

            console.log(`Processed offline operation: ${operation.type}`)
          } else {
            operation.retryCount++

            if (operation.retryCount >= operation.maxRetries) {
              // Maksimum deneme sayısına ulaşıldı, operasyonu kuyruktan çıkar
              this.offlineQueue.splice(i, 1)
              failedOperations.push({
                operation: operation,
                error: result.error,
              })
              failedCount++

              console.error(`Failed offline operation after ${operation.maxRetries} retries: ${operation.type}`)
            } else {
              console.log(
                `Retrying offline operation (${operation.retryCount}/${operation.maxRetries}): ${operation.type}`,
              )
            }
          }
        } catch (error) {
          console.error(`Error processing offline operation ${operation.type}:`, error)
          operation.retryCount++

          if (operation.retryCount >= operation.maxRetries) {
            this.offlineQueue.splice(i, 1)
            failedOperations.push({
              operation: operation,
              error: error.message,
            })
            failedCount++
          }
        }

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      // Başarısız operasyonları logla
      for (const failed of failedOperations) {
        await this.dbManager.addSyncLog(
          "offline_operation_failed",
          "system",
          null,
          "error",
          `Failed offline operation: ${failed.operation.type} - ${failed.error}`,
        )
      }

      return {
        success: true,
        processed: processedCount,
        failed: failedCount,
        remaining: this.offlineQueue.length,
        failedOperations: failedOperations,
      }
    } catch (error) {
      console.error("Process offline queue error:", error)
      return {
        success: false,
        error: "Offline kuyruk işlenemedi: " + error.message,
      }
    }
  }

  // Offline operasyonu çalıştır
  async executeOfflineOperation(operation) {
    try {
      switch (operation.type) {
        case "sale":
          return await this.processSaleOperation(operation.data)

        case "stock_update":
          return await this.processStockUpdateOperation(operation.data)

        case "product_update":
          return await this.processProductUpdateOperation(operation.data)

        default:
          return {
            success: false,
            error: `Unknown operation type: ${operation.type}`,
          }
      }
    } catch (error) {
      console.error(`Execute offline operation error (${operation.type}):`, error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  // Satış operasyonunu işle
  async processSaleOperation(saleData) {
    try {
      // Satış zaten local'de kaydedildi, sadece sync flag'ini güncelle
      await this.dbManager.runQuery("UPDATE sales SET synced = 0 WHERE id = ?", [saleData.saleId])

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  // Stok güncelleme operasyonunu işle
  async processStockUpdateOperation(stockData) {
    try {
      // Stok güncellemesini uygula
      await this.dbManager.updateProductStock(stockData.productId, stockData.newStock, "Offline sync")

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  // Ürün güncelleme operasyonunu işle
  async processProductUpdateOperation(productData) {
    try {
      // Ürün güncellemesini uygula
      await this.dbManager.runQuery(
        `
        UPDATE products 
        SET name = ?, price = ?, stock = ?, category = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        [
          productData.name,
          productData.price,
          productData.stock,
          productData.category,
          productData.description,
          productData.id,
        ],
      )

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  // Offline durumunu al
  getOfflineStatus() {
    return {
      isOfflineMode: this.isOfflineMode,
      offlineStartTime: this.offlineStartTime,
      offlineDuration: this.offlineStartTime ? Date.now() - this.offlineStartTime : 0,
      queuedOperations: this.offlineQueue.length,
      maxOfflineOperations: this.maxOfflineOperations,
    }
  }

  // Offline kuyruğu istatistikleri
  getQueueStats() {
    const stats = {
      total: this.offlineQueue.length,
      byType: {},
      oldestOperation: null,
      newestOperation: null,
    }

    if (this.offlineQueue.length > 0) {
      // Tip bazında grupla
      this.offlineQueue.forEach((op) => {
        stats.byType[op.type] = (stats.byType[op.type] || 0) + 1
      })

      // En eski ve en yeni operasyonları bul
      const sortedByTime = [...this.offlineQueue].sort((a, b) => a.timestamp - b.timestamp)
      stats.oldestOperation = {
        type: sortedByTime[0].type,
        timestamp: sortedByTime[0].timestamp,
        age: Date.now() - sortedByTime[0].timestamp,
      }
      stats.newestOperation = {
        type: sortedByTime[sortedByTime.length - 1].type,
        timestamp: sortedByTime[sortedByTime.length - 1].timestamp,
        age: Date.now() - sortedByTime[sortedByTime.length - 1].timestamp,
      }
    }

    return stats
  }

  // Offline kuyruğunu temizle
  clearOfflineQueue() {
    const clearedCount = this.offlineQueue.length
    this.offlineQueue = []

    console.log(`Cleared ${clearedCount} offline operations from queue`)

    return {
      success: true,
      clearedCount: clearedCount,
    }
  }

  // Offline mod ayarlarını güncelle
  updateOfflineSettings(settings) {
    if (settings.maxOfflineOperations !== undefined) {
      this.maxOfflineOperations = settings.maxOfflineOperations
    }

    return { success: true }
  }
}

module.exports = OfflineManager
