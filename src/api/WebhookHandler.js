// WooCommerce webhook işleyicisi
const express = require("express")
const crypto = require("crypto")

class WebhookHandler {
  constructor(dbManager, wooAPI) {
    this.dbManager = dbManager
    this.wooAPI = wooAPI
    this.app = express()
    this.server = null
    this.port = 3001
    this.webhookSecret = null
  }

  // Webhook sunucusunu başlat
  async start() {
    try {
      // Webhook secret'ını al veya oluştur
      this.webhookSecret = await this.dbManager.getSetting("webhook_secret")
      if (!this.webhookSecret) {
        this.webhookSecret = crypto.randomBytes(32).toString("hex")
        await this.dbManager.setSetting("webhook_secret", this.webhookSecret, true)
      }

      // Middleware'ler
      this.app.use(express.raw({ type: "application/json" }))
      this.app.use(this.logRequest.bind(this))

      // Webhook endpoint'leri
      this.setupRoutes()

      // Sunucuyu başlat
      this.server = this.app.listen(this.port, () => {
        console.log(`Webhook server started on port ${this.port}`)
      })

      return {
        success: true,
        port: this.port,
        webhookSecret: this.webhookSecret,
      }
    } catch (error) {
      console.error("Webhook server start error:", error)
      return {
        success: false,
        error: "Webhook sunucusu başlatılamadı: " + error.message,
      }
    }
  }

  // Route'ları ayarla
  setupRoutes() {
    // Ürün güncelleme webhook'u
    this.app.post("/webhook/product/updated", this.handleProductUpdate.bind(this))

    // Ürün oluşturma webhook'u
    this.app.post("/webhook/product/created", this.handleProductCreate.bind(this))

    // Ürün silme webhook'u
    this.app.post("/webhook/product/deleted", this.handleProductDelete.bind(this))

    // Stok güncelleme webhook'u
    this.app.post("/webhook/product/stock", this.handleStockUpdate.bind(this))

    // Genel webhook endpoint'i
    this.app.post("/webhook/woocommerce", this.handleGenericWebhook.bind(this))

    // Health check
    this.app.get("/webhook/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      })
    })

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: "Endpoint not found",
        path: req.path,
      })
    })
  }

  // İstek loglama middleware'i
  logRequest(req, res, next) {
    console.log(`Webhook: ${req.method} ${req.path} from ${req.ip}`)
    next()
  }

  // Webhook imzasını doğrula
  verifySignature(req, res, next) {
    const signature = req.get("X-WC-Webhook-Signature")
    const payload = req.body

    if (!signature) {
      return res.status(401).json({ error: "Missing signature" })
    }

    const isValid = this.wooAPI.verifyWebhookSignature(payload, signature, this.webhookSecret)

    if (!isValid) {
      console.warn("Invalid webhook signature")
      return res.status(401).json({ error: "Invalid signature" })
    }

    next()
  }

  // Ürün güncelleme webhook'u
  async handleProductUpdate(req, res) {
    try {
      const product = JSON.parse(req.body.toString())

      console.log(`Product updated webhook: ${product.name} (ID: ${product.id})`)

      // Local veritabanında ürünü güncelle
      const existingProduct = await this.dbManager.getQuery("SELECT id FROM products WHERE woocommerce_id = ?", [
        product.id,
      ])

      if (existingProduct) {
        await this.dbManager.runQuery(
          `
          UPDATE products 
          SET name = ?, price = ?, stock = ?, category = ?, description = ?, 
              image = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE woocommerce_id = ?
        `,
          [
            product.name,
            Number.parseFloat(product.price) || 0,
            Number.parseInt(product.stock_quantity) || 0,
            product.categories?.[0]?.name || "Genel",
            product.short_description || product.description || "",
            product.images?.[0]?.src || null,
            product.status === "publish" ? 1 : 0,
            product.id,
          ],
        )

        // Sync log kaydet
        await this.dbManager.addSyncLog(
          "webhook_product_update",
          "products",
          existingProduct.id,
          "success",
          `Product updated via webhook: ${product.name}`,
        )

        res.json({ success: true, action: "updated" })
      } else {
        // Ürün yoksa oluştur
        const productData = {
          name: product.name,
          barcode: product.sku || `WC${product.id}`,
          price: Number.parseFloat(product.price) || 0,
          stock: Number.parseInt(product.stock_quantity) || 0,
          category: product.categories?.[0]?.name || "Genel",
          description: product.short_description || product.description || "",
          image: product.images?.[0]?.src || null,
          woocommerce_id: product.id,
          is_active: product.status === "publish" ? 1 : 0,
        }

        const result = await this.dbManager.addProduct(productData)

        // Sync log kaydet
        await this.dbManager.addSyncLog(
          "webhook_product_create",
          "products",
          result.id,
          "success",
          `Product created via webhook: ${product.name}`,
        )

        res.json({ success: true, action: "created" })
      }
    } catch (error) {
      console.error("Product update webhook error:", error)
      res.status(500).json({
        error: "Webhook processing failed",
        message: error.message,
      })
    }
  }

  // Ürün oluşturma webhook'u
  async handleProductCreate(req, res) {
    try {
      const product = JSON.parse(req.body.toString())

      console.log(`Product created webhook: ${product.name} (ID: ${product.id})`)

      const productData = {
        name: product.name,
        barcode: product.sku || `WC${product.id}`,
        price: Number.parseFloat(product.price) || 0,
        stock: Number.parseInt(product.stock_quantity) || 0,
        category: product.categories?.[0]?.name || "Genel",
        description: product.short_description || product.description || "",
        image: product.images?.[0]?.src || null,
        woocommerce_id: product.id,
        is_active: product.status === "publish" ? 1 : 0,
      }

      const result = await this.dbManager.addProduct(productData)

      // Sync log kaydet
      await this.dbManager.addSyncLog(
        "webhook_product_create",
        "products",
        result.id,
        "success",
        `Product created via webhook: ${product.name}`,
      )

      res.json({ success: true, productId: result.id })
    } catch (error) {
      console.error("Product create webhook error:", error)
      res.status(500).json({
        error: "Webhook processing failed",
        message: error.message,
      })
    }
  }

  // Ürün silme webhook'u
  async handleProductDelete(req, res) {
    try {
      const product = JSON.parse(req.body.toString())

      console.log(`Product deleted webhook: ${product.name} (ID: ${product.id})`)

      // Ürünü pasif yap (silme yerine)
      await this.dbManager.runQuery("UPDATE products SET is_active = 0 WHERE woocommerce_id = ?", [product.id])

      // Sync log kaydet
      await this.dbManager.addSyncLog(
        "webhook_product_delete",
        "products",
        product.id,
        "success",
        `Product deactivated via webhook: ${product.name}`,
      )

      res.json({ success: true, action: "deactivated" })
    } catch (error) {
      console.error("Product delete webhook error:", error)
      res.status(500).json({
        error: "Webhook processing failed",
        message: error.message,
      })
    }
  }

  // Stok güncelleme webhook'u
  async handleStockUpdate(req, res) {
    try {
      const data = JSON.parse(req.body.toString())

      console.log(`Stock update webhook: Product ID ${data.product_id}, New stock: ${data.stock_quantity}`)

      // Stok güncelle
      await this.dbManager.runQuery("UPDATE products SET stock = ? WHERE woocommerce_id = ?", [
        Number.parseInt(data.stock_quantity) || 0,
        data.product_id,
      ])

      // Stok hareketi kaydet
      const product = await this.dbManager.getQuery("SELECT id FROM products WHERE woocommerce_id = ?", [
        data.product_id,
      ])

      if (product) {
        await this.dbManager.addStockMovement(
          product.id,
          "adjustment",
          Number.parseInt(data.stock_quantity) || 0,
          "WooCommerce webhook stock update",
        )

        // Sync log kaydet
        await this.dbManager.addSyncLog(
          "webhook_stock_update",
          "products",
          product.id,
          "success",
          `Stock updated via webhook: ${data.stock_quantity}`,
        )
      }

      res.json({ success: true })
    } catch (error) {
      console.error("Stock update webhook error:", error)
      res.status(500).json({
        error: "Webhook processing failed",
        message: error.message,
      })
    }
  }

  // Genel webhook işleyicisi
  async handleGenericWebhook(req, res) {
    try {
      const topic = req.get("X-WC-Webhook-Topic")
      const data = JSON.parse(req.body.toString())

      console.log(`Generic webhook received: ${topic}`)

      // Topic'e göre işlem yap
      switch (topic) {
        case "product.updated":
          return this.handleProductUpdate(req, res)
        case "product.created":
          return this.handleProductCreate(req, res)
        case "product.deleted":
          return this.handleProductDelete(req, res)
        default:
          console.log(`Unhandled webhook topic: ${topic}`)
          res.json({ success: true, message: "Webhook received but not processed" })
      }
    } catch (error) {
      console.error("Generic webhook error:", error)
      res.status(500).json({
        error: "Webhook processing failed",
        message: error.message,
      })
    }
  }

  // Webhook sunucusunu durdur
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log("Webhook server stopped")
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  // Webhook URL'lerini al
  getWebhookURLs() {
    const baseURL = `http://localhost:${this.port}/webhook`

    return {
      productUpdated: `${baseURL}/product/updated`,
      productCreated: `${baseURL}/product/created`,
      productDeleted: `${baseURL}/product/deleted`,
      stockUpdate: `${baseURL}/product/stock`,
      generic: `${baseURL}/woocommerce`,
      health: `${baseURL}/health`,
    }
  }

  // Webhook durumunu al
  getStatus() {
    return {
      running: !!this.server,
      port: this.port,
      webhookSecret: this.webhookSecret ? "configured" : "not configured",
      urls: this.getWebhookURLs(),
    }
  }
}

module.exports = WebhookHandler
