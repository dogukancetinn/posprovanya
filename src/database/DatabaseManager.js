const Database = require("better-sqlite3")
const path = require("path")
const fs = require("fs")
const crypto = require("crypto-js")
const { app } = require("electron")
const log = require("electron-log")

class DatabaseManager {
  constructor() {
    this.db = null
    this.dbPath = null
    this.encryptionKey = this.getEncryptionKey()
    this.isInitialized = false
    this.connectionPool = null
  }

  getEncryptionKey() {
    // Güvenli şifreleme anahtarı oluştur/al
    const keyPath = path.join(app.getPath("userData"), ".dbkey")

    try {
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, "utf8")
      } else {
        // Yeni anahtar oluştur
        const key = crypto.lib.WordArray.random(256 / 8).toString()
        fs.writeFileSync(keyPath, key, { mode: 0o600 }) // Sadece owner okuyabilir
        return key
      }
    } catch (error) {
      console.error("Encryption key error:", error)
      // Fallback key - production'da daha güvenli olmalı
      return "provanya-pos-default-key-2024"
    }
  }

  async initialize() {
    try {
      // Veritabanı dizinini oluştur
      const dbDir = path.join(app.getPath("userData"), "database")
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true })
      }

      this.dbPath = path.join(dbDir, "pos.db")

      this.db = new Database(this.dbPath)
      log.info("Connected to SQLite database:", this.dbPath)

      // Veritabanı ayarları
      this.db.pragma("foreign_keys = ON")
      this.db.pragma("journal_mode = WAL")
      this.db.pragma("synchronous = NORMAL")
      this.db.pragma("cache_size = 10000")
      this.db.pragma("temp_store = memory")

      // Tabloları oluştur
      await this.createTables()

      // Varsayılan verileri ekle
      await this.seedDefaultData()

      this.isInitialized = true
      log.info("Database initialized successfully")
    } catch (error) {
      log.error("Database initialization error:", error)
      throw error
    }
  }

  async createTables() {
    const tables = [
      // Ürünler tablosu
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        barcode TEXT UNIQUE NOT NULL,
        price REAL NOT NULL,
        stock INTEGER DEFAULT 0,
        category TEXT,
        description TEXT,
        image TEXT,
        woocommerce_id INTEGER,
        tax_rate REAL DEFAULT 0.18,
        min_stock INTEGER DEFAULT 0,
        supplier TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Satışlar tablosu
      `CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_number TEXT UNIQUE NOT NULL,
        subtotal REAL NOT NULL,
        discount REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        total REAL NOT NULL,
        payment_method TEXT NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        notes TEXT,
        status TEXT DEFAULT 'completed',
        synced INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Satış kalemleri tablosu
      `CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        product_barcode TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
      )`,

      // Senkronizasyon log tablosu
      `CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id INTEGER,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Ayarlar tablosu
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        encrypted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Stok hareketleri tablosu
      `CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        movement_type TEXT NOT NULL, -- 'in', 'out', 'adjustment'
        quantity INTEGER NOT NULL,
        reason TEXT,
        reference_id INTEGER, -- sale_id veya diğer referanslar
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id)
      )`,

      // Kategoriler tablosu
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        parent_id INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categories (id)
      )`,

      // Ödeme işlemleri tablosu
      `CREATE TABLE IF NOT EXISTS payment_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        payment_method TEXT NOT NULL,
        amount REAL NOT NULL,
        transaction_id TEXT,
        pos_response TEXT,
        status TEXT DEFAULT 'completed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE
      )`,
    ]

    for (const tableSQL of tables) {
      await this.runQuery(tableSQL)
    }

    // İndeksler oluştur
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode)",
      "CREATE INDEX IF NOT EXISTS idx_products_woocommerce_id ON products (woocommerce_id)",
      "CREATE INDEX IF NOT EXISTS idx_products_category ON products (category)",
      "CREATE INDEX IF NOT EXISTS idx_products_is_active ON products (is_active)",
      "CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (created_at)",
      "CREATE INDEX IF NOT EXISTS idx_sales_synced ON sales (synced)",
      "CREATE INDEX IF NOT EXISTS idx_sales_sale_number ON sales (sale_number)",
      "CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items (sale_id)",
      "CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items (product_id)",
      "CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements (product_id)",
      "CREATE INDEX IF NOT EXISTS idx_payment_transactions_sale_id ON payment_transactions (sale_id)",
      "CREATE INDEX IF NOT EXISTS idx_sync_log_created_at ON sync_log (created_at)",
    ]

    for (const indexSQL of indexes) {
      await this.runQuery(indexSQL)
    }
  }

  async seedDefaultData() {
    // Varsayılan ayarları ekle
    const defaultSettings = [
      { key: "woocommerce_url", value: "", encrypted: 1 },
      { key: "woocommerce_consumer_key", value: "", encrypted: 1 },
      { key: "woocommerce_consumer_secret", value: "", encrypted: 1 },
      { key: "subdomain_db_url", value: "", encrypted: 1 },
      { key: "last_sync_time", value: "0", encrypted: 0 },
      { key: "pos_device_id", value: crypto.lib.WordArray.random(128 / 8).toString(), encrypted: 0 },
      { key: "auto_sync_enabled", value: "1", encrypted: 0 },
      { key: "sync_interval_minutes", value: "15", encrypted: 0 },
    ]

    for (const setting of defaultSettings) {
      await this.setSetting(setting.key, setting.value, setting.encrypted === 1)
    }

    // Örnek ürünler ekle (test için)
    const sampleProducts = [
      {
        name: "Coca Cola 330ml",
        barcode: "8690637008016",
        price: 5.5,
        stock: 100,
        category: "İçecek",
        description: "Coca Cola Kutu 330ml",
      },
      {
        name: "Ekmek 500gr",
        barcode: "1234567890123",
        price: 3.0,
        stock: 50,
        category: "Fırın",
        description: "Beyaz Ekmek 500gr",
      },
      {
        name: "Süt 1L",
        barcode: "8690504001234",
        price: 8.75,
        stock: 30,
        category: "Süt Ürünleri",
        description: "Tam Yağlı Süt 1 Litre",
      },
    ]

    for (const product of sampleProducts) {
      const existing = await this.getQuery("SELECT id FROM products WHERE barcode = ?", [product.barcode])
      if (!existing) {
        await this.addProduct(product)
      }
    }
  }

  // Temel veritabanı işlemleri
  runQuery(sql, params = []) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized")
      }
      
      const stmt = this.db.prepare(sql)
      const result = stmt.run(params)
      return { id: result.lastInsertRowid, changes: result.changes }
    } catch (error) {
      log.error("SQL Error:", { error: error.message, sql, params })
      throw error
    }
  }

  getQuery(sql, params = []) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized")
      }
      
      const stmt = this.db.prepare(sql)
      return stmt.get(params)
    } catch (error) {
      log.error("SQL Error:", { error: error.message, sql, params })
      throw error
    }
  }

  allQuery(sql, params = []) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized")
      }
      
      const stmt = this.db.prepare(sql)
      return stmt.all(params)
    } catch (error) {
      log.error("SQL Error:", { error: error.message, sql, params })
      throw error
    }
  }

  // Ürün işlemleri
  async searchProductByBarcode(barcode) {
    try {
      const product = await this.getQuery(
        "SELECT * FROM products WHERE barcode = ? AND is_active = 1", 
        [barcode]
      )
      return product
    } catch (error) {
      log.error("Product search error:", error)
      throw error
    }
  }

  async addProduct(productData) {
    try {
      const result = await this.runQuery(
        `
        INSERT INTO products (name, barcode, price, stock, category, description, image, woocommerce_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          productData.name,
          productData.barcode,
          productData.price,
          productData.stock || 0,
          productData.category || null,
          productData.description || null,
          productData.image || null,
          productData.woocommerce_id || null,
        ],
      )

      // Stok hareketi kaydet
      if (productData.stock > 0) {
        await this.addStockMovement(result.id, "in", productData.stock, "İlk stok girişi")
      }

      log.info(`Product added: ${productData.name} (ID: ${result.id})`)
      return result
    } catch (error) {
      log.error("Add product error:", error)
      throw error
    }
  }

  async updateProductStock(productId, newStock, reason = "Manuel güncelleme") {
    try {
      const currentProduct = await this.getQuery("SELECT stock FROM products WHERE id = ?", [productId])
      if (!currentProduct) {
        throw new Error("Ürün bulunamadı")
      }

      const difference = newStock - currentProduct.stock

      await this.runQuery("UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
        newStock,
        productId,
      ])

      // Stok hareketi kaydet
      if (difference !== 0) {
        await this.addStockMovement(productId, difference > 0 ? "in" : "out", Math.abs(difference), reason)
      }

      return { success: true }
    } catch (error) {
      console.error("Update stock error:", error)
      throw error
    }
  }

  async addStockMovement(productId, movementType, quantity, reason, referenceId = null) {
    try {
      await this.runQuery(
        `
        INSERT INTO stock_movements (product_id, movement_type, quantity, reason, reference_id)
        VALUES (?, ?, ?, ?, ?)
      `,
        [productId, movementType, quantity, reason, referenceId],
      )
    } catch (error) {
      console.error("Stock movement error:", error)
      throw error
    }
  }

  // Satış işlemleri
  async saveSale(saleData) {
    const transaction = this.db.transaction((saleData) => {
      try {
        // Satış numarası oluştur
        const saleNumber = "POS" + Date.now()

        // Satış kaydını ekle
        const saleResult = this.runQuery(
          `
          INSERT INTO sales (sale_number, subtotal, discount, total, payment_method, customer_name, customer_phone)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          [
            saleNumber,
            saleData.subtotal,
            saleData.discount,
            saleData.total,
            saleData.paymentMethod,
            saleData.customer.name || null,
            saleData.customer.phone || null,
          ],
        )

        const saleId = saleResult.id

        // Satış kalemlerini ekle ve stok güncelle
        for (const item of saleData.items) {
          // Satış kalemi ekle
          this.runQuery(
            `
            INSERT INTO sale_items (sale_id, product_id, product_name, product_barcode, quantity, unit_price, total_price)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
            [saleId, item.id, item.name, item.barcode, item.quantity, item.price, item.total],
          )

          // Stok güncelle
          this.runQuery("UPDATE products SET stock = stock - ? WHERE id = ?", [item.quantity, item.id])

          // Stok hareketi kaydet
          this.runQuery(
            `
            INSERT INTO stock_movements (product_id, movement_type, quantity, reason, reference_id)
            VALUES (?, ?, ?, ?, ?)
          `,
            [item.id, "out", item.quantity, "Satış", saleId],
          )
        }

        log.info(`Sale saved: ${saleNumber} (ID: ${saleId}), Total: ${saleData.total}`)
        
        return {
          success: true,
          saleId: saleId,
          saleNumber: saleNumber,
        }
      } catch (error) {
        throw error
      }
    })

    try {
      return transaction(saleData)
    } catch (error) {
      log.error("Save sale error:", error)
      throw error
    }
  }

  async getSalesHistory(filters = {}) {
    try {
      let sql = `
        SELECT s.*, COUNT(si.id) as item_count
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE 1=1
      `
      const params = []

      if (filters.startDate) {
        sql += " AND s.created_at >= ?"
        params.push(filters.startDate)
      }

      if (filters.endDate) {
        sql += " AND s.created_at <= ?"
        params.push(filters.endDate)
      }

      if (filters.paymentMethod) {
        sql += " AND s.payment_method = ?"
        params.push(filters.paymentMethod)
      }

      sql += " GROUP BY s.id ORDER BY s.created_at DESC LIMIT 100"

      const sales = await this.allQuery(sql, params)
      return sales
    } catch (error) {
      console.error("Sales history error:", error)
      throw error
    }
  }

  async getPendingSalesCount() {
    try {
      const result = await this.getQuery("SELECT COUNT(*) as count FROM sales WHERE synced = 0")
      return result.count
    } catch (error) {
      console.error("Pending sales count error:", error)
      return 0
    }
  }

  async getPendingSales() {
    try {
      const sales = await this.allQuery(`
        SELECT s.*, si.product_id, si.product_name, si.product_barcode, si.quantity, si.unit_price, si.total_price
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE s.synced = 0
        ORDER BY s.created_at ASC
      `)

      // Satışları grupla
      const groupedSales = {}
      sales.forEach((sale) => {
        if (!groupedSales[sale.id]) {
          groupedSales[sale.id] = {
            id: sale.id,
            sale_number: sale.sale_number,
            subtotal: sale.subtotal,
            discount: sale.discount,
            total: sale.total,
            payment_method: sale.payment_method,
            customer_name: sale.customer_name,
            customer_phone: sale.customer_phone,
            created_at: sale.created_at,
            items: [],
          }
        }

        if (sale.product_id) {
          groupedSales[sale.id].items.push({
            product_id: sale.product_id,
            product_name: sale.product_name,
            product_barcode: sale.product_barcode,
            quantity: sale.quantity,
            unit_price: sale.unit_price,
            total_price: sale.total_price,
          })
        }
      })

      return Object.values(groupedSales)
    } catch (error) {
      console.error("Pending sales error:", error)
      throw error
    }
  }

  async markSaleAsSynced(saleId) {
    try {
      await this.runQuery("UPDATE sales SET synced = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [saleId])
      return { success: true }
    } catch (error) {
      console.error("Mark sale synced error:", error)
      throw error
    }
  }

  // Ayarlar işlemleri
  async setSetting(key, value, encrypted = false) {
    try {
      const finalValue = encrypted ? crypto.AES.encrypt(value, this.encryptionKey).toString() : value

      await this.runQuery(
        `
        INSERT OR REPLACE INTO settings (key, value, encrypted, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `,
        [key, finalValue, encrypted ? 1 : 0],
      )

      return { success: true }
    } catch (error) {
      console.error("Set setting error:", error)
      throw error
    }
  }

  async getSetting(key, defaultValue = null) {
    try {
      const setting = await this.getQuery("SELECT value, encrypted FROM settings WHERE key = ?", [key])

      if (!setting) {
        return defaultValue
      }

      if (setting.encrypted) {
        try {
          const decrypted = crypto.AES.decrypt(setting.value, this.encryptionKey).toString(crypto.enc.Utf8)
          return decrypted || defaultValue
        } catch (decryptError) {
          console.error("Decryption error for setting:", key)
          return defaultValue
        }
      }

      return setting.value
    } catch (error) {
      console.error("Get setting error:", error)
      return defaultValue
    }
  }

  // Senkronizasyon log işlemleri
  async addSyncLog(operation, tableName, recordId, status, errorMessage = null) {
    try {
      await this.runQuery(
        `
        INSERT INTO sync_log (operation, table_name, record_id, status, error_message)
        VALUES (?, ?, ?, ?, ?)
      `,
        [operation, tableName, recordId, status, errorMessage],
      )
    } catch (error) {
      console.error("Sync log error:", error)
    }
  }

  async getSyncLogs(limit = 50) {
    try {
      return await this.allQuery(
        `
        SELECT * FROM sync_log 
        ORDER BY created_at DESC 
        LIMIT ?
      `,
        [limit],
      )
    } catch (error) {
      console.error("Get sync logs error:", error)
      return []
    }
  }

  // Veritabanı bakım işlemleri
  async vacuum() {
    try {
      await this.runQuery("VACUUM")
      console.log("Database vacuum completed")
    } catch (error) {
      console.error("Vacuum error:", error)
    }
  }

  async backup(backupPath) {
    try {
      const fs = require("fs")
      fs.copyFileSync(this.dbPath, backupPath)
      console.log("Database backup created:", backupPath)
      return { success: true }
    } catch (error) {
      console.error("Backup error:", error)
      throw error
    }
  }

  async close() {
    try {
      if (this.db) {
        this.db.close()
        log.info("Database connection closed")
      }
    } catch (error) {
      log.error("Database close error:", error)
    }
  }

  // Veritabanı durumu kontrolü
  isReady() {
    return this.isInitialized && this.db !== null
  }

  async getStats() {
    try {
      const stats = {}

      stats.totalProducts = (await this.getQuery("SELECT COUNT(*) as count FROM products")).count
      stats.totalSales = (await this.getQuery("SELECT COUNT(*) as count FROM sales")).count
      stats.pendingSales = (await this.getQuery("SELECT COUNT(*) as count FROM sales WHERE synced = 0")).count
      stats.todaySales = (
        await this.getQuery(`
        SELECT COUNT(*) as count FROM sales 
        WHERE DATE(created_at) = DATE('now')
      `)
      ).count
      stats.todayRevenue = (
        await this.getQuery(`
        SELECT COALESCE(SUM(total), 0) as revenue FROM sales 
        WHERE DATE(created_at) = DATE('now')
      `)
      ).revenue

      return stats
    } catch (error) {
      console.error("Get stats error:", error)
      return {}
    }
  }

  async getProducts(filters = {}) {
    try {
      let sql = "SELECT * FROM products WHERE 1=1"
      const params = []

      if (filters.category) {
        sql += " AND category = ?"
        params.push(filters.category)
      }

      if (filters.search) {
        sql += " AND (name LIKE ? OR barcode LIKE ?)"
        params.push(`%${filters.search}%`, `%${filters.search}%`)
      }

      sql += " ORDER BY name ASC"

      const products = await this.allQuery(sql, params)
      return products
    } catch (error) {
      console.error("Get products error:", error)
      throw error
    }
  }

  async getSettings() {
    try {
      const settings = await this.allQuery("SELECT key, value, encrypted FROM settings")
      const result = {}

      for (const setting of settings) {
        if (setting.encrypted) {
          try {
            const decrypted = crypto.AES.decrypt(setting.value, this.encryptionKey).toString(crypto.enc.Utf8)
            result[setting.key] = decrypted
          } catch (decryptError) {
            console.error("Decryption error for setting:", setting.key)
            result[setting.key] = ""
          }
        } else {
          result[setting.key] = setting.value
        }
      }

      return result
    } catch (error) {
      console.error("Get settings error:", error)
      throw error
    }
  }

  async testConnection() {
    try {
      if (!this.isReady()) {
        throw new Error("Database not initialized")
      }

      // Simple test query
      const result = await this.getQuery("SELECT 1 as test")
      return { success: true, message: "Database connection successful" }
    } catch (error) {
      console.error("Database test error:", error)
      return { success: false, message: error.message }
    }
  }

  async getCustomers(filters = {}) {
    try {
      let sql = `
        SELECT DISTINCT customer_name, customer_phone, 
               COUNT(*) as total_orders,
               SUM(total) as total_spent,
               MAX(created_at) as last_order
        FROM sales 
        WHERE customer_name IS NOT NULL AND customer_name != ''
      `
      const params = []

      if (filters.search) {
        sql += " AND (customer_name LIKE ? OR customer_phone LIKE ?)"
        params.push(`%${filters.search}%`, `%${filters.search}%`)
      }

      sql += " GROUP BY customer_name, customer_phone ORDER BY last_order DESC"

      const customers = await this.allQuery(sql, params)
      return customers
    } catch (error) {
      console.error("Get customers error:", error)
      throw error
    }
  }

  async saveCustomer(customerData) {
    try {
      // Müşteri bilgileri sales tablosunda tutulduğu için
      // Bu fonksiyon gelecekte ayrı customers tablosu için kullanılabilir
      return { success: true, message: "Customer data saved with sales" }
    } catch (error) {
      console.error("Save customer error:", error)
      throw error
    }
  }

  async getReports(type = "daily", filters = {}) {
    try {
      let sql = ""
      const params = []

      switch (type) {
        case "daily":
          sql = `
            SELECT DATE(created_at) as date,
                   COUNT(*) as total_sales,
                   SUM(total) as total_revenue,
                   AVG(total) as avg_sale
            FROM sales
            WHERE created_at >= date('now', '-30 days')
            GROUP BY DATE(created_at)
            ORDER BY date DESC
          `
          break

        case "products":
          sql = `
            SELECT p.name, p.barcode, p.category,
                   SUM(si.quantity) as total_sold,
                   SUM(si.total_price) as total_revenue
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN sales s ON si.sale_id = s.id
            WHERE s.created_at >= date('now', '-30 days')
            GROUP BY p.id
            ORDER BY total_sold DESC
            LIMIT 20
          `
          break

        case "categories":
          sql = `
            SELECT p.category,
                   COUNT(DISTINCT p.id) as product_count,
                   SUM(si.quantity) as total_sold,
                   SUM(si.total_price) as total_revenue
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN sales s ON si.sale_id = s.id
            WHERE s.created_at >= date('now', '-30 days')
            GROUP BY p.category
            ORDER BY total_revenue DESC
          `
          break

        default:
          throw new Error("Invalid report type")
      }

      const reports = await this.allQuery(sql, params)
      return reports
    } catch (error) {
      console.error("Get reports error:", error)
      throw error
    }
  }

  async exportData(type = "all") {
    try {
      const data = {}

      if (type === "all" || type === "products") {
        data.products = await this.allQuery("SELECT * FROM products")
      }

      if (type === "all" || type === "sales") {
        data.sales = await this.allQuery("SELECT * FROM sales")
        data.sale_items = await this.allQuery("SELECT * FROM sale_items")
      }

      if (type === "all" || type === "settings") {
        data.settings = await this.getSettings()
      }

      return {
        success: true,
        data: data,
        exported_at: new Date().toISOString(),
      }
    } catch (error) {
      console.error("Export data error:", error)
      throw error
    }
  }

  async importData(importData) {
    const transaction = this.db.transaction((data) => {
      try {
        if (data.products) {
          for (const product of data.products) {
            this.runQuery(
              `
              INSERT OR REPLACE INTO products 
              (id, name, barcode, price, stock, category, description, image, woocommerce_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
              [
                product.id,
                product.name,
                product.barcode,
                product.price,
                product.stock,
                product.category,
                product.description,
                product.image,
                product.woocommerce_id,
                product.created_at,
                product.updated_at,
              ],
            )
          }
        }

        if (data.settings) {
          for (const [key, value] of Object.entries(data.settings)) {
            this.runQuery(
              `
              INSERT OR REPLACE INTO settings (key, value, encrypted, updated_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `,
              [key, value, 0],
            )
          }
        }

        return { success: true }
      } catch (error) {
        throw error
      }
    })

    try {
      return transaction(importData)
    } catch (error) {
      console.error("Import data error:", error)
      throw error
    }
  }
}

module.exports = DatabaseManager
