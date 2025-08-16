const { contextBridge, ipcRenderer } = require("electron")

// Güvenli API bridge'i renderer process için
contextBridge.exposeInMainWorld("electronAPI", {
  // Ürün işlemleri
  searchProduct: (barcode) => ipcRenderer.invoke("search-product", barcode),
  getLocalProducts: () => ipcRenderer.invoke("get-local-products"),
  syncProducts: () => ipcRenderer.invoke("sync-products"),

  // Satış işlemleri
  saveSale: (saleData) => ipcRenderer.invoke("save-sale", saleData),
  getSalesHistory: (filters) => ipcRenderer.invoke("get-sales-history", filters),

  // Ödeme işlemleri
  processPayment: (paymentData) => ipcRenderer.invoke("process-payment", paymentData),

  // Ayarlar işlemleri
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  testWooCommerceConnection: (settings) => ipcRenderer.invoke("test-woocommerce-connection", settings),
  testDatabaseConnection: (settings) => ipcRenderer.invoke("test-database-connection", settings),

  // Müşteri işlemleri
  getCustomers: () => ipcRenderer.invoke("get-customers"),
  saveCustomer: (customer) => ipcRenderer.invoke("save-customer", customer),
  deleteCustomer: (customerId) => ipcRenderer.invoke("delete-customer", customerId),

  // Rapor işlemleri
  getReports: (type, filters) => ipcRenderer.invoke("get-reports", type, filters),
  generateReport: (type, filters) => ipcRenderer.invoke("generate-report", type, filters),

  // Backup/Restore işlemleri
  exportData: () => ipcRenderer.invoke("export-data"),
  importData: (filePath) => ipcRenderer.invoke("import-data", filePath),
  createBackup: () => ipcRenderer.invoke("create-backup"),
  restoreBackup: (filePath) => ipcRenderer.invoke("restore-backup", filePath),

  // Senkronizasyon
  getSyncStatus: () => ipcRenderer.invoke("get-sync-status"),
  manualSync: () => ipcRenderer.invoke("manual-sync"),

  // Event listeners
  onNewSale: (callback) => ipcRenderer.on("new-sale", callback),
  onShowHistory: (callback) => ipcRenderer.on("show-history", callback),
  onShowSettings: (callback) => ipcRenderer.on("show-settings", callback),
  onConnectionStatus: (callback) => ipcRenderer.on("connection-status", callback),

  // Event listener temizleme
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
})
