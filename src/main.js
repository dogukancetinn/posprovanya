const { app, BrowserWindow, ipcMain, Menu, dialog } = require("electron")
const path = require("path")
const isDev = process.env.NODE_ENV === "development"

// Veritabanı ve diğer modülleri import et
const DatabaseManager = require("./database/DatabaseManager")
const SyncManager = require("./sync/SyncManager")
const WooCommerceAPI = require("./api/WooCommerceAPI")

class POSApplication {
  constructor() {
    this.mainWindow = null
    this.dbManager = null
    this.syncManager = null
    this.wooAPI = null
    this.isOnline = false
  }

  async initialize() {
    try {
      // Veritabanı yöneticisini başlat
      this.dbManager = new DatabaseManager()
      await this.dbManager.initialize()

      // WooCommerce API'yi başlat
      this.wooAPI = new WooCommerceAPI(this.dbManager)
      await this.wooAPI.initialize()

      // Sync yöneticisini başlat
      this.syncManager = new SyncManager(this.dbManager, this.wooAPI)
      await this.syncManager.initialize()

      console.log("POS Application initialized successfully")
    } catch (error) {
      console.error("Failed to initialize POS Application:", error)
      dialog.showErrorBox("Initialization Error", "Failed to initialize the application: " + error.message)
    }
  }

  createWindow() {
    // Ana pencereyi oluştur
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1000,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, "preload.js"),
      },
      icon: path.join(__dirname, "../assets/icon.ico"),
      title: "PROVANYA POS",
      show: false, // Yükleme tamamlanana kadar gizle
    })

    // HTML dosyasını yükle
    this.mainWindow.loadFile(path.join(__dirname, "renderer/index.html"))

    // Pencere hazır olduğunda göster
    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow.show()

      // Development modunda DevTools'u aç
      if (isDev) {
        this.mainWindow.webContents.openDevTools()
      }
    })

    // Pencere kapatıldığında
    this.mainWindow.on("closed", () => {
      this.mainWindow = null
    })

    // Menü oluştur
    this.createMenu()
  }

  createMenu() {
    const template = [
      {
        label: "Dosya",
        submenu: [
          {
            label: "Yeni Satış",
            accelerator: "CmdOrCtrl+N",
            click: () => {
              this.mainWindow.webContents.send("new-sale")
            },
          },
          {
            label: "Satış Geçmişi",
            accelerator: "CmdOrCtrl+H",
            click: () => {
              this.mainWindow.webContents.send("show-history")
            },
          },
          { type: "separator" },
          {
            label: "Çıkış",
            accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
            click: () => {
              app.quit()
            },
          },
        ],
      },
      {
        label: "Araçlar",
        submenu: [
          {
            label: "Senkronizasyon",
            accelerator: "F5",
            click: () => {
              this.syncManager.forcSync()
            },
          },
          {
            label: "Ayarlar",
            accelerator: "CmdOrCtrl+,",
            click: () => {
              this.mainWindow.webContents.send("show-settings")
            },
          },
        ],
      },
      {
        label: "Geliştirici",
        submenu: [
          {
            label: "DevTools Aç/Kapat",
            accelerator: "F12",
            click: () => {
              if (this.mainWindow.webContents.isDevToolsOpened()) {
                this.mainWindow.webContents.closeDevTools()
              } else {
                this.mainWindow.webContents.openDevTools()
              }
            },
          },
          {
            label: "Console Temizle",
            accelerator: "CmdOrCtrl+K",
            click: () => {
              this.mainWindow.webContents.send("clear-console")
            },
          },
          {
            label: "Sayfa Yenile",
            accelerator: "CmdOrCtrl+R",
            click: () => {
              this.mainWindow.webContents.reload()
            },
          },
          {
            label: "Zorla Yenile",
            accelerator: "CmdOrCtrl+Shift+R",
            click: () => {
              this.mainWindow.webContents.reloadIgnoringCache()
            },
          },
          { type: "separator" },
          {
            label: "Debug Modu",
            type: "checkbox",
            checked: isDev,
            click: (menuItem) => {
              this.mainWindow.webContents.send("toggle-debug", menuItem.checked)
            },
          },
          {
            label: "Performans İzleme",
            click: () => {
              this.mainWindow.webContents.send("show-performance")
            },
          },
          {
            label: "Hata Logları",
            click: () => {
              this.mainWindow.webContents.send("show-error-logs")
            },
          },
        ],
      },
      {
        label: "Yardım",
        submenu: [
          {
            label: "Hakkında",
            click: () => {
              dialog.showMessageBox(this.mainWindow, {
                type: "info",
                title: "PROVANYA POS Hakkında",
                message: "PROVANYA POS v1.0.0",
                detail: "Standalone Desktop Point of Sale Application\nNode.js + Electron ile geliştirilmiştir.",
              })
            },
          },
        ],
      },
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }

  setupIPCHandlers() {
    // Ürün arama
    ipcMain.handle("search-product", async (event, barcode) => {
      try {
        return await this.dbManager.searchProductByBarcode(barcode)
      } catch (error) {
        console.error("Product search error:", error)
        throw error
      }
    })

    // Satış kaydetme
    ipcMain.handle("save-sale", async (event, saleData) => {
      try {
        const result = await this.dbManager.saveSale(saleData)

        // Online ise WooCommerce stok güncelle
        if (this.isOnline && this.wooAPI.isConfigured) {
          await this.wooAPI.updateStock(saleData.items)
        }

        return result
      } catch (error) {
        console.error("Save sale error:", error)
        throw error
      }
    })

    // Satış geçmişi
    ipcMain.handle("get-sales-history", async (event, filters) => {
      try {
        return await this.dbManager.getSalesHistory(filters)
      } catch (error) {
        console.error("Sales history error:", error)
        throw error
      }
    })

    // Ayarları getir
    ipcMain.handle("get-settings", async () => {
      try {
        return await this.dbManager.getSettings()
      } catch (error) {
        console.error("Get settings error:", error)
        throw error
      }
    })

    // Ayarları kaydet
    ipcMain.handle("save-settings", async (event, settings) => {
      try {
        const results = {}

        // Her ayarı ayrı ayrı kaydet
        for (const [key, value] of Object.entries(settings)) {
          const encrypted = key.includes("password") || key.includes("secret") || key.includes("key")
          await this.dbManager.setSetting(key, value, encrypted)
          results[key] = { success: true }
        }

        // WooCommerce ayarları güncellendiyse API'yi yeniden yapılandır
        if (settings.woocommerce_url || settings.woocommerce_consumer_key || settings.woocommerce_consumer_secret) {
          await this.wooAPI.initialize()
        }

        // Subdomain ayarları güncellendiyse SyncManager'ı yapılandır
        if (settings.subdomain_db_url || settings.subdomain_api_key) {
          await this.syncManager.configureSubdomain({
            url: settings.subdomain_db_url,
            apiKey: settings.subdomain_api_key,
          })
        }

        return { success: true, results }
      } catch (error) {
        console.error("Save settings error:", error)
        throw error
      }
    })

    // Database bağlantı testi
    ipcMain.handle("test-database-connection", async () => {
      try {
        return await this.dbManager.testConnection()
      } catch (error) {
        console.error("Database test error:", error)
        throw error
      }
    })

    // WooCommerce bağlantı testi
    ipcMain.handle("test-woocommerce-connection", async () => {
      try {
        return await this.wooAPI.testConnection()
      } catch (error) {
        console.error("WooCommerce test error:", error)
        throw error
      }
    })

    // Yerel ürünleri getir
    ipcMain.handle("get-local-products", async (event, filters) => {
      try {
        return await this.dbManager.getProducts(filters)
      } catch (error) {
        console.error("Get local products error:", error)
        throw error
      }
    })

    // Ürünleri senkronize et
    ipcMain.handle("sync-products", async () => {
      try {
        if (this.wooAPI && this.wooAPI.isConfigured) {
          return await this.wooAPI.syncAllProducts()
        } else {
          return {
            success: false,
            error: "WooCommerce API yapılandırılmamış",
          }
        }
      } catch (error) {
        console.error("Sync products error:", error)
        throw error
      }
    })

    // Müşterileri getir
    ipcMain.handle("get-customers", async (event, filters) => {
      try {
        return await this.dbManager.getCustomers(filters)
      } catch (error) {
        console.error("Get customers error:", error)
        throw error
      }
    })

    // Müşteri kaydet
    ipcMain.handle("save-customer", async (event, customerData) => {
      try {
        return await this.dbManager.saveCustomer(customerData)
      } catch (error) {
        console.error("Save customer error:", error)
        throw error
      }
    })

    // Raporları getir
    ipcMain.handle("get-reports", async (event, reportType, filters) => {
      try {
        return await this.dbManager.getReports(reportType, filters)
      } catch (error) {
        console.error("Get reports error:", error)
        throw error
      }
    })

    // Veri dışa aktar
    ipcMain.handle("export-data", async (event, exportOptions) => {
      try {
        return await this.dbManager.exportData(exportOptions.type)
      } catch (error) {
        console.error("Export data error:", error)
        throw error
      }
    })

    // Veri içe aktar
    ipcMain.handle("import-data", async (event, importData) => {
      try {
        return await this.dbManager.importData(importData)
      } catch (error) {
        console.error("Import data error:", error)
        throw error
      }
    })

    // Senkronizasyon durumu
    ipcMain.handle("get-sync-status", async () => {
      try {
        return this.syncManager.getSyncStatus()
      } catch (error) {
        console.error("Get sync status error:", error)
        return {
          isOnline: this.isOnline,
          lastSyncTime: 0,
          pendingSales: 0,
          error: error.message,
        }
      }
    })

    // Manuel senkronizasyon
    ipcMain.handle("manual-sync", async () => {
      try {
        return await this.syncManager.syncNow()
      } catch (error) {
        console.error("Manual sync error:", error)
        throw error
      }
    })

    ipcMain.handle("test-subdomain-connection", async () => {
      try {
        return await this.syncManager.testSubdomainConnection()
      } catch (error) {
        console.error("Subdomain test error:", error)
        throw error
      }
    })

    ipcMain.handle("check-woocommerce-config", async () => {
      try {
        return await this.wooAPI.checkConfiguration()
      } catch (error) {
        console.error("Check WooCommerce config error:", error)
        throw error
      }
    })

    ipcMain.handle("add-offline-operation", async (event, operation) => {
      try {
        return await this.syncManager.addOfflineOperation(operation)
      } catch (error) {
        console.error("Add offline operation error:", error)
        throw error
      }
    })

    ipcMain.handle("clear-offline-queue", async () => {
      try {
        return this.syncManager.clearOfflineQueue()
      } catch (error) {
        console.error("Clear offline queue error:", error)
        throw error
      }
    })

    ipcMain.handle("update-sync-settings", async (event, settings) => {
      try {
        return await this.syncManager.updateSyncSettings(settings)
      } catch (error) {
        console.error("Update sync settings error:", error)
        throw error
      }
    })

    ipcMain.handle("force-sync", async () => {
      try {
        return await this.syncManager.forceSync()
      } catch (error) {
        console.error("Force sync error:", error)
        throw error
      }
    })

    // Ödeme işlemi
    ipcMain.handle("process-payment", async (event, paymentData) => {
      try {
        // Fiziksel POS entegrasyonu burada yapılacak
        // Şimdilik mock response
        return {
          success: true,
          transactionId: Date.now().toString(),
          method: paymentData.method,
        }
      } catch (error) {
        console.error("Payment processing error:", error)
        throw error
      }
    })
  }

  async checkInternetConnection() {
    // İnternet bağlantısını kontrol et
    setInterval(async () => {
      try {
        const response = await require("axios").get("https://www.google.com", { timeout: 5000 })
        const wasOffline = !this.isOnline
        this.isOnline = response.status === 200

        if (wasOffline && this.isOnline) {
          console.log("Internet connection restored, starting sync...")
          this.syncManager.syncPendingSales()
        }
      } catch (error) {
        this.isOnline = false
      }

      // Renderer'a durum bildir
      if (this.mainWindow) {
        this.mainWindow.webContents.send("connection-status", this.isOnline)
      }
    }, 10000) // Her 10 saniyede kontrol et
  }
}

// Uygulama instance'ı
const posApp = new POSApplication()

// Electron app event handlers
app.whenReady().then(async () => {
  await posApp.initialize()
  posApp.createWindow()
  posApp.setupIPCHandlers()
  posApp.checkInternetConnection()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      posApp.createWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("before-quit", async () => {
  // Uygulama kapanmadan önce temizlik işlemleri
  if (posApp.dbManager) {
    await posApp.dbManager.close()
  }
})

// Hata yakalama
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error)
  dialog.showErrorBox("Unexpected Error", error.message)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
})
