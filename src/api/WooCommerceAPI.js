// WooCommerce REST API entegrasyonu
const axios = require("axios")
const crypto = require("crypto")
const log = require("electron-log")

class WooCommerceAPI {
  constructor(dbManager) {
    this.dbManager = dbManager
    this.baseURL = null
    this.consumerKey = null
    this.consumerSecret = null
    this.isConfigured = false
    this.rateLimitDelay = 1000 // 1 saniye API çağrıları arası bekleme
    this.lastAPICall = 0
    this.maxRetries = 3
    this.timeout = 30000 // 30 saniye timeout
  }

  // API yapılandırmasını yükle
  async initialize() {
    try {
      this.baseURL = await this.dbManager.getSetting("woocommerce_url")
      this.consumerKey = await this.dbManager.getSetting("woocommerce_consumer_key")
      this.consumerSecret = await this.dbManager.getSetting("woocommerce_consumer_secret")

      if (
        this.baseURL &&
        this.baseURL.trim() !== "" &&
        this.consumerKey &&
        this.consumerKey.trim() !== "" &&
        this.consumerSecret &&
        this.consumerSecret.trim() !== ""
      ) {
        // URL'yi düzenle
        this.baseURL = this.baseURL.replace(/\/$/, "") // Son slash'i kaldır
        if (!this.baseURL.includes("/wp-json/wc/v3")) {
          this.baseURL += "/wp-json/wc/v3"
        }

        this.isConfigured = true
        log.info("WooCommerce API configured successfully")

        // Bağlantıyı test et
        const testResult = await this.testConnection()
        if (!testResult.success) {
          log.warn("WooCommerce API test failed:", testResult.error)
          // Çünkü ayarlar mevcut, sadece bağlantı sorunu olabilir
        }

        return { success: true }
      } else {
        log.info("WooCommerce API not configured - missing credentials")
        this.isConfigured = false
        return {
          success: false,
          error: "WooCommerce API bilgileri eksik. Lütfen ayarlar sayfasından API bilgilerini girin.",
          details: {
            hasURL: !!(this.baseURL && this.baseURL.trim() !== ""),
            hasConsumerKey: !!(this.consumerKey && this.consumerKey.trim() !== ""),
            hasConsumerSecret: !!(this.consumerSecret && this.consumerSecret.trim() !== ""),
          },
        }
      }
    } catch (error) {
      console.error("WooCommerce API initialization error:", error)
      this.isConfigured = false
      return {
        success: false,
        error: "WooCommerce API başlatılamadı: " + error.message,
      }
    }
  }

  // API yapılandırmasını güncelle
  async configure(config) {
    try {
      await this.dbManager.setSetting("woocommerce_url", config.url, true)
      await this.dbManager.setSetting("woocommerce_consumer_key", config.consumerKey, true)
      await this.dbManager.setSetting("woocommerce_consumer_secret", config.consumerSecret, true)

      // Yeniden başlat
      await this.initialize()

      return { success: true }
    } catch (error) {
      console.error("WooCommerce API configuration error:", error)
      return {
        success: false,
        error: "WooCommerce API yapılandırılamadı: " + error.message,
      }
    }
  }

  // API bağlantısını test et
  async testConnection() {
    try {
      if (!this.isConfigured) {
        return {
          success: false,
          error: "API yapılandırılmamış. Lütfen önce WooCommerce API ayarlarını yapın.",
        }
      }

      const response = await this.makeRequest("GET", "/products", { per_page: 1 })

      if (response.success) {
        return {
          success: true,
          message: "WooCommerce API bağlantısı başarılı",
          productCount: response.data ? response.data.length : 0,
        }
      } else {
        return {
          success: false,
          error: response.error || "Bağlantı testi başarısız",
        }
      }
    } catch (error) {
      console.error("WooCommerce connection test error:", error)
      return {
        success: false,
        error: "Bağlantı testi hatası: " + error.message,
      }
    }
  }

  // API isteği yap
  async makeRequest(method, endpoint, data = null, retryCount = 0) {
    try {
      if (!this.isConfigured) {
        return {
          success: false,
          error: "API yapılandırılmamış",
        }
      }

      // Rate limiting
      const now = Date.now()
      const timeSinceLastCall = now - this.lastAPICall
      if (timeSinceLastCall < this.rateLimitDelay) {
        await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelay - timeSinceLastCall))
      }
      this.lastAPICall = Date.now()

      // OAuth 1.0a imzası oluştur
      const url = this.baseURL + endpoint
      const oauthParams = this.generateOAuthParams(method, url, data)

      const config = {
        method: method.toLowerCase(),
        url: url,
        timeout: this.timeout,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "PROVANYA-POS/1.0.0",
          "Accept": "application/json"
        },
        params: method === "GET" ? oauthParams : undefined,
        validateStatus: function (status) {
          return status < 500 // Reject only if the status code is greater than or equal to 500
        }
      }

      if (data && method !== "GET") {
        config.data = data
        config.params = oauthParams
      }

      const response = await axios(config)

      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
        requestTime: Date.now() - this.lastAPICall
      }
    } catch (error) {
      log.error(`WooCommerce API ${method} ${endpoint} error:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      })

      // Retry logic
      if (retryCount < this.maxRetries && this.shouldRetry(error)) {
        log.info(`Retrying request (${retryCount + 1}/${this.maxRetries})...`)
        await new Promise((resolve) => setTimeout(resolve, (retryCount + 1) * 2000))
        return this.makeRequest(method, endpoint, data, retryCount + 1)
      }

      return {
        success: false,
        error: this.parseError(error),
        status: error.response?.status,
        data: error.response?.data,
      }
    }
  }

  // OAuth 1.0a parametreleri oluştur
  generateOAuthParams(method, url, data = null) {
    const timestamp = Math.floor(Date.now() / 1000)
    const nonce = crypto.randomBytes(16).toString("hex")

    const oauthParams = {
      oauth_consumer_key: this.consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: timestamp,
      oauth_version: "1.0",
    }

    // İmza oluştur
    const signature = this.generateSignature(method, url, oauthParams, data)
    oauthParams.oauth_signature = signature

    return oauthParams
  }

  // OAuth imzası oluştur
  generateSignature(method, url, oauthParams, data = null) {
    // Parametreleri sırala
    const params = { ...oauthParams }

    // GET parametrelerini ekle
    if (method === "GET" && data) {
      Object.assign(params, data)
    }

    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join("&")

    // Base string oluştur
    const baseString = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(sortedParams)].join("&")

    // İmza anahtarı
    const signingKey = `${encodeURIComponent(this.consumerSecret)}&`

    // HMAC-SHA1 imzası
    const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64")

    return signature
  }

  // Hata mesajını parse et
  parseError(error) {
    if (error.response) {
      const status = error.response.status
      const data = error.response.data

      switch (status) {
        case 401:
          return "Yetkilendirme hatası - API anahtarlarını kontrol edin"
        case 403:
          return "Erişim reddedildi - Yetki yetersiz"
        case 404:
          return "Kaynak bulunamadı"
        case 429:
          return "Çok fazla istek - Lütfen bekleyin"
        case 500:
          return "Sunucu hatası"
        default:
          return data?.message || `HTTP ${status} hatası`
      }
    } else if (error.code === "ENOTFOUND") {
      return "Sunucu bulunamadı - URL'yi kontrol edin"
    } else if (error.code === "ECONNREFUSED") {
      return "Bağlantı reddedildi"
    } else if (error.code === "ETIMEDOUT") {
      return "Bağlantı zaman aşımı"
    } else {
      return error.message || "Bilinmeyen hata"
    }
  }

  // Yeniden deneme yapılmalı mı?
  shouldRetry(error) {
    if (error.response) {
      const status = error.response.status
      // 5xx sunucu hataları ve 429 rate limit için yeniden dene
      return status >= 500 || status === 429
    }
    // Ağ hataları için yeniden dene
    return ["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "ECONNRESET"].includes(error.code)
  }

  // Ürün stok güncelleme
  async updateStock(saleItems) {
    try {
      if (!this.isConfigured) {
        console.log("WooCommerce API not configured, skipping stock update")
        return { success: true, skipped: true }
      }

      const results = []

      for (const item of saleItems) {
        try {
          // Local veritabanından WooCommerce ID'yi al
          const product = await this.dbManager.getQuery("SELECT woocommerce_id FROM products WHERE id = ?", [item.id])

          if (!product || !product.woocommerce_id) {
            console.log(`Product ${item.name} has no WooCommerce ID, skipping stock update`)
            results.push({
              productId: item.id,
              success: false,
              error: "WooCommerce ID bulunamadı",
            })
            continue
          }

          // Mevcut stok bilgisini al
          const stockResponse = await this.makeRequest("GET", `/products/${product.woocommerce_id}`)

          if (!stockResponse.success) {
            results.push({
              productId: item.id,
              success: false,
              error: stockResponse.error,
            })
            continue
          }

          const currentStock = Number.parseInt(stockResponse.data.stock_quantity) || 0
          const newStock = Math.max(0, currentStock - item.quantity)

          // Stok güncelle
          const updateResponse = await this.makeRequest("PUT", `/products/${product.woocommerce_id}`, {
            stock_quantity: newStock,
          })

          if (updateResponse.success) {
            results.push({
              productId: item.id,
              woocommerceId: product.woocommerce_id,
              success: true,
              oldStock: currentStock,
              newStock: newStock,
              soldQuantity: item.quantity,
            })

            // Sync log kaydet
            await this.dbManager.addSyncLog(
              "stock_update",
              "products",
              item.id,
              "success",
              `Stock updated: ${currentStock} -> ${newStock}`,
            )
          } else {
            results.push({
              productId: item.id,
              success: false,
              error: updateResponse.error,
            })

            // Sync log kaydet
            await this.dbManager.addSyncLog("stock_update", "products", item.id, "error", updateResponse.error)
          }
        } catch (error) {
          console.error(`Stock update error for product ${item.id}:`, error)
          results.push({
            productId: item.id,
            success: false,
            error: error.message,
          })
        }

        // API rate limiting için kısa bekleme
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      const successCount = results.filter((r) => r.success).length
      const totalCount = results.length

      return {
        success: true,
        results: results,
        summary: {
          total: totalCount,
          successful: successCount,
          failed: totalCount - successCount,
        },
      }
    } catch (error) {
      console.error("Stock update error:", error)
      return {
        success: false,
        error: "Stok güncelleme hatası: " + error.message,
      }
    }
  }

  // Ürünleri WooCommerce'den senkronize et
  async syncProducts(page = 1, perPage = 100) {
    try {
      if (!this.isConfigured) {
        return {
          success: false,
          error: "API yapılandırılmamış",
        }
      }

      const response = await this.makeRequest("GET", "/products", {
        page: page,
        per_page: perPage,
        status: "publish",
      })

      if (!response.success) {
        return response
      }

      const products = response.data
      const syncResults = []

      for (const wooProduct of products) {
        try {
          // Local veritabanında ürün var mı kontrol et
          const existingProduct = await this.dbManager.getQuery(
            "SELECT id FROM products WHERE woocommerce_id = ? OR barcode = ?",
            [wooProduct.id, wooProduct.sku],
          )

          const productData = {
            name: wooProduct.name,
            barcode: wooProduct.sku || `WC${wooProduct.id}`,
            price: Number.parseFloat(wooProduct.price) || 0,
            stock: Number.parseInt(wooProduct.stock_quantity) || 0,
            category: wooProduct.categories?.[0]?.name || "Genel",
            description: wooProduct.short_description || wooProduct.description || "",
            image: wooProduct.images?.[0]?.src || null,
            woocommerce_id: wooProduct.id,
            is_active: wooProduct.status === "publish" ? 1 : 0,
          }

          if (existingProduct) {
            // Ürünü güncelle
            await this.dbManager.runQuery(
              `
              UPDATE products 
              SET name = ?, price = ?, stock = ?, category = ?, description = ?, 
                  image = ?, woocommerce_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
              [
                productData.name,
                productData.price,
                productData.stock,
                productData.category,
                productData.description,
                productData.image,
                productData.woocommerce_id,
                productData.is_active,
                existingProduct.id,
              ],
            )

            syncResults.push({
              action: "updated",
              productId: existingProduct.id,
              woocommerceId: wooProduct.id,
              name: productData.name,
            })
          } else {
            // Yeni ürün ekle
            const result = await this.dbManager.addProduct(productData)

            syncResults.push({
              action: "created",
              productId: result.id,
              woocommerceId: wooProduct.id,
              name: productData.name,
            })
          }

          // Sync log kaydet
          await this.dbManager.addSyncLog(
            "product_sync",
            "products",
            wooProduct.id,
            "success",
            `Product synced: ${productData.name}`,
          )
        } catch (error) {
          console.error(`Product sync error for WooCommerce ID ${wooProduct.id}:`, error)
          syncResults.push({
            action: "error",
            woocommerceId: wooProduct.id,
            name: wooProduct.name,
            error: error.message,
          })

          // Sync log kaydet
          await this.dbManager.addSyncLog("product_sync", "products", wooProduct.id, "error", error.message)
        }
      }

      // Daha fazla sayfa var mı kontrol et
      const totalPages = Number.parseInt(response.headers["x-wp-totalpages"]) || 1
      const hasMore = page < totalPages

      return {
        success: true,
        results: syncResults,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          hasMore: hasMore,
        },
        summary: {
          total: syncResults.length,
          created: syncResults.filter((r) => r.action === "created").length,
          updated: syncResults.filter((r) => r.action === "updated").length,
          errors: syncResults.filter((r) => r.action === "error").length,
        },
      }
    } catch (error) {
      console.error("Product sync error:", error)
      return {
        success: false,
        error: "Ürün senkronizasyonu hatası: " + error.message,
      }
    }
  }

  // Tüm ürünleri senkronize et
  async syncAllProducts() {
    try {
      let page = 1
      let allResults = []
      const totalSummary = { total: 0, created: 0, updated: 0, errors: 0 }

      do {
        const result = await this.syncProducts(page, 100)

        if (!result.success) {
          return result
        }

        allResults = allResults.concat(result.results)
        totalSummary.total += result.summary.total
        totalSummary.created += result.summary.created
        totalSummary.updated += result.summary.updated
        totalSummary.errors += result.summary.errors

        if (!result.pagination.hasMore) {
          break
        }

        page++

        // Sayfa arası bekleme
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } while (page <= 50) // Maksimum 50 sayfa (5000 ürün)

      return {
        success: true,
        results: allResults,
        summary: totalSummary,
      }
    } catch (error) {
      console.error("Sync all products error:", error)
      return {
        success: false,
        error: "Tüm ürün senkronizasyonu hatası: " + error.message,
      }
    }
  }

  // Kategori senkronizasyonu
  async syncCategories() {
    try {
      if (!this.isConfigured) {
        return {
          success: false,
          error: "API yapılandırılmamış",
        }
      }

      const response = await this.makeRequest("GET", "/products/categories", {
        per_page: 100,
      })

      if (!response.success) {
        return response
      }

      const categories = response.data
      const syncResults = []

      for (const wooCategory of categories) {
        try {
          // Kategori tablosuna ekle/güncelle
          await this.dbManager.runQuery(
            `
            INSERT OR REPLACE INTO categories (name, description, parent_id, is_active)
            VALUES (?, ?, ?, 1)
          `,
            [wooCategory.name, wooCategory.description || "", wooCategory.parent || null],
          )

          syncResults.push({
            action: "synced",
            categoryId: wooCategory.id,
            name: wooCategory.name,
          })
        } catch (error) {
          console.error(`Category sync error for ${wooCategory.name}:`, error)
          syncResults.push({
            action: "error",
            categoryId: wooCategory.id,
            name: wooCategory.name,
            error: error.message,
          })
        }
      }

      return {
        success: true,
        results: syncResults,
        summary: {
          total: syncResults.length,
          synced: syncResults.filter((r) => r.action === "synced").length,
          errors: syncResults.filter((r) => r.action === "error").length,
        },
      }
    } catch (error) {
      console.error("Category sync error:", error)
      return {
        success: false,
        error: "Kategori senkronizasyonu hatası: " + error.message,
      }
    }
  }

  // API durumunu kontrol et
  getStatus() {
    return {
      configured: this.isConfigured,
      baseURL: this.baseURL,
      hasCredentials: !!(this.consumerKey && this.consumerSecret),
      lastAPICall: this.lastAPICall,
    }
  }

  // API yapılandırmasını temizle
  async clearConfiguration() {
    try {
      await this.dbManager.setSetting("woocommerce_url", "", true)
      await this.dbManager.setSetting("woocommerce_consumer_key", "", true)
      await this.dbManager.setSetting("woocommerce_consumer_secret", "", true)

      this.baseURL = null
      this.consumerKey = null
      this.consumerSecret = null
      this.isConfigured = false

      return { success: true }
    } catch (error) {
      console.error("Clear WooCommerce configuration error:", error)
      return {
        success: false,
        error: "Yapılandırma temizlenemedi: " + error.message,
      }
    }
  }

  // Webhook endpoint'i için imza doğrulama
  verifyWebhookSignature(payload, signature, secret) {
    const expectedSignature = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("base64")
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  }

  // Test ürünü oluştur (geliştirme için)
  async createTestProduct() {
    try {
      if (!this.isConfigured) {
        return {
          success: false,
          error: "API yapılandırılmamış",
        }
      }

      const testProduct = {
        name: "Test Ürün - PROVANYA POS",
        type: "simple",
        regular_price: "10.00",
        description: "PROVANYA POS test ürünü",
        short_description: "Test ürünü",
        sku: "TEST-POS-" + Date.now(),
        manage_stock: true,
        stock_quantity: 100,
        in_stock: true,
        status: "publish",
      }

      const response = await this.makeRequest("POST", "/products", testProduct)

      if (response.success) {
        return {
          success: true,
          product: response.data,
        }
      } else {
        return response
      }
    } catch (error) {
      console.error("Create test product error:", error)
      return {
        success: false,
        error: "Test ürün oluşturulamadı: " + error.message,
      }
    }
  }

  // API durumunu detaylı kontrol et
  async checkConfiguration() {
    try {
      const url = await this.dbManager.getSetting("woocommerce_url")
      const consumerKey = await this.dbManager.getSetting("woocommerce_consumer_key")
      const consumerSecret = await this.dbManager.getSetting("woocommerce_consumer_secret")

      const status = {
        hasURL: !!(url && url.trim() !== ""),
        hasConsumerKey: !!(consumerKey && consumerKey.trim() !== ""),
        hasConsumerSecret: !!(consumerSecret && consumerSecret.trim() !== ""),
        isConfigured: this.isConfigured,
        baseURL: this.baseURL,
      }

      status.isComplete = status.hasURL && status.hasConsumerKey && status.hasConsumerSecret

      return {
        success: true,
        status: status,
        message: status.isComplete ? "API yapılandırması tamamlanmış" : "API yapılandırması eksik",
      }
    } catch (error) {
      console.error("Check configuration error:", error)
      return {
        success: false,
        error: "Yapılandırma kontrolü hatası: " + error.message,
      }
    }
  }
}

module.exports = WooCommerceAPI
