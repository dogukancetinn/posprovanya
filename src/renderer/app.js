// PROVANYA POS - Ana Renderer Process JavaScript
// Bu dosya HTML sayfasında çalışan ana uygulama mantığını içerir

class POSApp {
  constructor() {
    this.currentPage = 'dashboard'
    this.cart = {
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0,
      customer: { name: '', phone: '' }
    }
    this.selectedPaymentMethod = null
    this.isOnline = false
    this.isSyncing = false
    this.settings = {}
    this.products = []
    this.customers = []
    this.currentProduct = null
    
    // Debug mode
    this.debugMode = false
    this.performanceMonitor = false
    
    // Initialize app
    this.init()
  }

  async init() {
    try {
      console.log('🚀 PROVANYA POS başlatılıyor...')
      
      // DOM yüklenene kadar bekle
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initializeApp())
      } else {
        await this.initializeApp()
      }
    } catch (error) {
      console.error('App initialization error:', error)
      this.showNotification('Uygulama başlatılamadı: ' + error.message, 'error')
    }
  }

  async initializeApp() {
    try {
      // Event listener'ları kur
      this.setupEventListeners()
      
      // Ayarları yükle
      await this.loadSettings()
      
      // Dashboard'u yükle
      await this.loadDashboard()
      
      // Bağlantı durumunu kontrol et
      this.checkConnectionStatus()
      
      // Otomatik senkronizasyonu başlat
      this.startPeriodicSync()
      
      console.log('✅ PROVANYA POS başarıyla başlatıldı')
      this.showNotification('PROVANYA POS başarıyla başlatıldı', 'success')
      
    } catch (error) {
      console.error('App initialization error:', error)
      this.showNotification('Başlatma hatası: ' + error.message, 'error')
    }
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = e.currentTarget.dataset.page
        this.navigateToPage(page)
      })
    })

    // Barcode input
    const barcodeInput = document.getElementById('barcodeInput')
    if (barcodeInput) {
      barcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.searchProduct()
        }
      })
      
      // Auto-focus barcode input
      barcodeInput.focus()
    }

    // Search button
    const searchBtn = document.getElementById('searchBtn')
    if (searchBtn) {
      searchBtn.addEventListener('click', () => this.searchProduct())
    }

    // Add to cart button
    const addToCartBtn = document.getElementById('addToCartBtn')
    if (addToCartBtn) {
      addToCartBtn.addEventListener('click', () => this.addToCart())
    }

    // Payment method buttons
    document.querySelectorAll('.payment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectPaymentMethod(e.currentTarget.dataset.method)
      })
    })

    // Complete sale button
    const completeSaleBtn = document.getElementById('completeSaleBtn')
    if (completeSaleBtn) {
      completeSaleBtn.addEventListener('click', () => this.completeSale())
    }

    // Clear cart button
    const clearCartBtn = document.getElementById('clearCartBtn')
    if (clearCartBtn) {
      clearCartBtn.addEventListener('click', () => this.clearCart())
    }

    // Discount controls
    const applyDiscountBtn = document.getElementById('applyDiscountBtn')
    if (applyDiscountBtn) {
      applyDiscountBtn.addEventListener('click', () => this.applyDiscount())
    }

    // Settings buttons
    this.setupSettingsEventListeners()
    
    // Products page
    this.setupProductsEventListeners()
    
    // Customers page
    this.setupCustomersEventListeners()
    
    // Reports page
    this.setupReportsEventListeners()

    // Modal close buttons
    this.setupModalEventListeners()

    // Electron IPC listeners
    this.setupElectronListeners()
  }

  setupSettingsEventListeners() {
    // WooCommerce settings
    const testWooBtn = document.getElementById('testWooConnectionBtn')
    if (testWooBtn) {
      testWooBtn.addEventListener('click', () => this.testWooCommerceConnection())
    }

    const saveWooBtn = document.getElementById('saveWooSettingsBtn')
    if (saveWooBtn) {
      saveWooBtn.addEventListener('click', () => this.saveWooCommerceSettings())
    }

    // Database settings
    const testDbBtn = document.getElementById('testDbConnectionBtn')
    if (testDbBtn) {
      testDbBtn.addEventListener('click', () => this.testDatabaseConnection())
    }

    const saveDbBtn = document.getElementById('saveDbSettingsBtn')
    if (saveDbBtn) {
      saveDbBtn.addEventListener('click', () => this.saveDatabaseSettings())
    }

    // POS settings
    const testPosBtn = document.getElementById('testPosConnectionBtn')
    if (testPosBtn) {
      testPosBtn.addEventListener('click', () => this.testPOSConnection())
    }

    const savePosBtn = document.getElementById('savePosSettingsBtn')
    if (savePosBtn) {
      savePosBtn.addEventListener('click', () => this.savePOSSettings())
    }

    // Backup buttons
    const createBackupBtn = document.getElementById('createBackupBtn')
    if (createBackupBtn) {
      createBackupBtn.addEventListener('click', () => this.createBackup())
    }

    const restoreBackupBtn = document.getElementById('restoreBackupBtn')
    if (restoreBackupBtn) {
      restoreBackupBtn.addEventListener('click', () => this.restoreBackup())
    }
  }

  setupProductsEventListeners() {
    // Sync products button
    const syncProductsBtn = document.getElementById('syncProductsBtn')
    if (syncProductsBtn) {
      syncProductsBtn.addEventListener('click', () => this.syncProducts())
    }

    // Product search
    const productSearchInput = document.getElementById('productSearchInput')
    if (productSearchInput) {
      productSearchInput.addEventListener('input', (e) => {
        this.filterProducts(e.target.value)
      })
    }

    // Category filter
    const categoryFilter = document.getElementById('categoryFilter')
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.filterProductsByCategory(e.target.value)
      })
    }
  }

  setupCustomersEventListeners() {
    // Add customer button
    const addCustomerBtn = document.getElementById('addCustomerBtn')
    if (addCustomerBtn) {
      addCustomerBtn.addEventListener('click', () => this.showCustomerModal())
    }

    // Customer search
    const customerSearchInput = document.getElementById('customerSearchInput')
    if (customerSearchInput) {
      customerSearchInput.addEventListener('input', (e) => {
        this.filterCustomers(e.target.value)
      })
    }

    // Save customer button
    const saveCustomerBtn = document.getElementById('saveCustomerBtn')
    if (saveCustomerBtn) {
      saveCustomerBtn.addEventListener('click', () => this.saveCustomer())
    }
  }

  setupReportsEventListeners() {
    // Generate report button
    const generateReportBtn = document.getElementById('generateReportBtn')
    if (generateReportBtn) {
      generateReportBtn.addEventListener('click', () => this.generateReport())
    }

    // Report type change
    const reportType = document.getElementById('reportType')
    if (reportType) {
      reportType.addEventListener('change', () => this.updateReportFilters())
    }
  }

  setupModalEventListeners() {
    // Close modal buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal')
        if (modal) {
          this.closeModal(modal.id)
        }
      })
    })

    // Modal background click to close
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal.id)
        }
      })
    })
  }

  setupElectronListeners() {
    if (window.electronAPI) {
      // Connection status updates
      window.electronAPI.onConnectionStatus((event, isOnline) => {
        this.updateConnectionStatus(isOnline)
      })

      // Menu shortcuts
      window.electronAPI.onNewSale(() => {
        this.navigateToPage('pos')
        this.clearCart()
      })

      window.electronAPI.onShowHistory(() => {
        this.showSalesHistory()
      })

      window.electronAPI.onShowSettings(() => {
        this.navigateToPage('settings')
      })
    }
  }

  // Navigation
  navigateToPage(pageId) {
    try {
      // Hide all pages
      document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active')
      })

      // Show selected page
      const targetPage = document.getElementById(pageId + 'Page')
      if (targetPage) {
        targetPage.classList.add('active')
        this.currentPage = pageId

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(btn => {
          btn.classList.remove('active')
        })
        
        const activeNavBtn = document.querySelector(`[data-page="${pageId}"]`)
        if (activeNavBtn) {
          activeNavBtn.classList.add('active')
        }

        // Load page data
        this.loadPageData(pageId)
      }
    } catch (error) {
      console.error('Navigation error:', error)
      this.showNotification('Sayfa yüklenemedi: ' + error.message, 'error')
    }
  }

  async loadPageData(pageId) {
    try {
      switch (pageId) {
        case 'dashboard':
          await this.loadDashboard()
          break
        case 'pos':
          await this.loadPOSPage()
          break
        case 'products':
          await this.loadProducts()
          break
        case 'customers':
          await this.loadCustomers()
          break
        case 'reports':
          await this.loadReports()
          break
        case 'settings':
          await this.loadSettings()
          break
      }
    } catch (error) {
      console.error(`Load page data error (${pageId}):`, error)
      this.showNotification('Sayfa verileri yüklenemedi: ' + error.message, 'error')
    }
  }

  // Dashboard
  async loadDashboard() {
    try {
      if (!window.electronAPI) {
        this.showNotification('Electron API bulunamadı', 'error')
        return
      }

      // Dashboard istatistiklerini al
      const syncStatus = await window.electronAPI.getSyncStatus()
      const salesHistory = await window.electronAPI.getSalesHistory({ limit: 5 })

      // Bugünkü satışları hesapla
      const today = new Date().toISOString().split('T')[0]
      const todaySales = salesHistory.filter(sale => 
        sale.created_at.startsWith(today)
      )

      const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0)
      const todayTransactions = todaySales.length

      // Dashboard kartlarını güncelle
      this.updateElement('todaySales', `₺${todayRevenue.toFixed(2)}`)
      this.updateElement('todayTransactions', todayTransactions.toString())
      this.updateElement('totalProducts', syncStatus.totalProducts || '0')
      this.updateElement('lowStockCount', syncStatus.lowStockCount || '0')

      // Son işlemleri göster
      this.updateRecentTransactions(salesHistory.slice(0, 5))

      // Satış grafiğini çiz
      this.drawSalesChart()

    } catch (error) {
      console.error('Load dashboard error:', error)
      this.showNotification('Dashboard yüklenemedi: ' + error.message, 'error')
    }
  }

  async loadPOSPage() {
    // POS sayfası için özel yükleme işlemleri
    const barcodeInput = document.getElementById('barcodeInput')
    if (barcodeInput) {
      barcodeInput.focus()
    }
    
    this.updateCartDisplay()
  }

  // Product search
  async searchProduct() {
    try {
      const barcodeInput = document.getElementById('barcodeInput')
      const barcode = barcodeInput.value.trim()

      if (!barcode) {
        this.showNotification('Lütfen barkod girin', 'warning')
        return
      }

      this.showLoading('Ürün aranıyor...')

      const product = await window.electronAPI.searchProduct(barcode)

      this.hideLoading()

      if (product) {
        this.displayProduct(product)
        barcodeInput.value = ''
      } else {
        this.showNotification('Ürün bulunamadı: ' + barcode, 'warning')
        this.hideProductInfo()
      }

    } catch (error) {
      this.hideLoading()
      console.error('Product search error:', error)
      this.showNotification('Ürün arama hatası: ' + error.message, 'error')
    }
  }

  displayProduct(product) {
    try {
      this.currentProduct = product

      // Product info section'ı göster
      const productInfo = document.getElementById('productInfo')
      if (productInfo) {
        productInfo.style.display = 'block'

        // Ürün bilgilerini doldur
        this.updateElement('productName', product.name)
        this.updateElement('productPrice', `₺${product.price.toFixed(2)}`)
        this.updateElement('productStock', `Stok: ${product.stock}`)

        // Ürün resmini güncelle
        const productImage = document.getElementById('productImage')
        if (productImage) {
          productImage.src = product.image || '/placeholder.svg'
          productImage.alt = product.name
        }

        // Quantity input'u sıfırla
        const quantityInput = document.getElementById('quantity')
        if (quantityInput) {
          quantityInput.value = '1'
          quantityInput.max = product.stock
        }
      }
    } catch (error) {
      console.error('Display product error:', error)
      this.showNotification('Ürün gösterilemedi: ' + error.message, 'error')
    }
  }

  hideProductInfo() {
    const productInfo = document.getElementById('productInfo')
    if (productInfo) {
      productInfo.style.display = 'none'
    }
    this.currentProduct = null
  }

  // Cart management
  addToCart() {
    try {
      if (!this.currentProduct) {
        this.showNotification('Önce bir ürün seçin', 'warning')
        return
      }

      const quantityInput = document.getElementById('quantity')
      const quantity = parseInt(quantityInput.value) || 1

      if (quantity <= 0) {
        this.showNotification('Geçersiz miktar', 'warning')
        return
      }

      if (quantity > this.currentProduct.stock) {
        this.showNotification('Yetersiz stok', 'warning')
        return
      }

      // Sepette aynı ürün var mı kontrol et
      const existingItemIndex = this.cart.items.findIndex(item => item.id === this.currentProduct.id)

      if (existingItemIndex >= 0) {
        // Mevcut ürünün miktarını artır
        const existingItem = this.cart.items[existingItemIndex]
        const newQuantity = existingItem.quantity + quantity

        if (newQuantity > this.currentProduct.stock) {
          this.showNotification('Yetersiz stok', 'warning')
          return
        }

        existingItem.quantity = newQuantity
        existingItem.total = existingItem.price * newQuantity
      } else {
        // Yeni ürün ekle
        const cartItem = {
          id: this.currentProduct.id,
          name: this.currentProduct.name,
          barcode: this.currentProduct.barcode,
          price: this.currentProduct.price,
          quantity: quantity,
          total: this.currentProduct.price * quantity,
          stock: this.currentProduct.stock
        }

        this.cart.items.push(cartItem)
      }

      this.calculateCartTotals()
      this.updateCartDisplay()
      this.hideProductInfo()

      this.showNotification(`${this.currentProduct.name} sepete eklendi`, 'success')

      // Barkod input'a odaklan
      const barcodeInput = document.getElementById('barcodeInput')
      if (barcodeInput) {
        barcodeInput.focus()
      }

    } catch (error) {
      console.error('Add to cart error:', error)
      this.showNotification('Sepete eklenemedi: ' + error.message, 'error')
    }
  }

  removeFromCart(productId) {
    try {
      const itemIndex = this.cart.items.findIndex(item => item.id === productId)
      
      if (itemIndex >= 0) {
        const removedItem = this.cart.items[itemIndex]
        this.cart.items.splice(itemIndex, 1)
        
        this.calculateCartTotals()
        this.updateCartDisplay()
        
        this.showNotification(`${removedItem.name} sepetten çıkarıldı`, 'info')
      }
    } catch (error) {
      console.error('Remove from cart error:', error)
      this.showNotification('Sepetten çıkarılamadı: ' + error.message, 'error')
    }
  }

  updateCartQuantity(productId, newQuantity) {
    try {
      const item = this.cart.items.find(item => item.id === productId)
      
      if (item) {
        if (newQuantity <= 0) {
          this.removeFromCart(productId)
          return
        }

        if (newQuantity > item.stock) {
          this.showNotification('Yetersiz stok', 'warning')
          return
        }

        item.quantity = newQuantity
        item.total = item.price * newQuantity
        
        this.calculateCartTotals()
        this.updateCartDisplay()
      }
    } catch (error) {
      console.error('Update cart quantity error:', error)
      this.showNotification('Miktar güncellenemedi: ' + error.message, 'error')
    }
  }

  calculateCartTotals() {
    this.cart.subtotal = this.cart.items.reduce((sum, item) => sum + item.total, 0)
    this.cart.total = this.cart.subtotal - this.cart.discount
  }

  updateCartDisplay() {
    try {
      const cartItemsContainer = document.getElementById('cartItems')
      
      if (!cartItemsContainer) return

      if (this.cart.items.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">Sepet boş</p>'
      } else {
        cartItemsContainer.innerHTML = this.cart.items.map(item => `
          <div class="cart-item">
            <div class="cart-item-info">
              <div class="cart-item-name">${item.name}</div>
              <div class="cart-item-details">
                ${item.quantity} x ₺${item.price.toFixed(2)} = ₺${item.total.toFixed(2)}
              </div>
            </div>
            <div class="cart-item-actions">
              <button class="btn btn-sm btn-secondary" onclick="app.updateCartQuantity(${item.id}, ${item.quantity - 1})">
                <i class="fas fa-minus"></i>
              </button>
              <span class="quantity">${item.quantity}</span>
              <button class="btn btn-sm btn-secondary" onclick="app.updateCartQuantity(${item.id}, ${item.quantity + 1})">
                <i class="fas fa-plus"></i>
              </button>
              <button class="btn btn-sm btn-warning" onclick="app.removeFromCart(${item.id})">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `).join('')
      }

      // Toplamları güncelle
      this.updateElement('subtotal', `₺${this.cart.subtotal.toFixed(2)}`)
      this.updateElement('discount', `₺${this.cart.discount.toFixed(2)}`)
      this.updateElement('total', `₺${this.cart.total.toFixed(2)}`)

      // Complete sale button durumu
      const completeSaleBtn = document.getElementById('completeSaleBtn')
      if (completeSaleBtn) {
        completeSaleBtn.disabled = this.cart.items.length === 0 || !this.selectedPaymentMethod
      }

    } catch (error) {
      console.error('Update cart display error:', error)
    }
  }

  clearCart() {
    this.cart.items = []
    this.cart.subtotal = 0
    this.cart.discount = 0
    this.cart.total = 0
    this.cart.customer = { name: '', phone: '' }
    this.selectedPaymentMethod = null

    this.updateCartDisplay()
    this.hideProductInfo()

    // Customer inputs'u temizle
    const customerName = document.getElementById('customerName')
    const customerPhone = document.getElementById('customerPhone')
    if (customerName) customerName.value = ''
    if (customerPhone) customerPhone.value = ''

    // Payment method selection'ı temizle
    document.querySelectorAll('.payment-btn').forEach(btn => {
      btn.classList.remove('selected')
    })

    this.showNotification('Sepet temizlendi', 'info')
  }

  // Payment
  selectPaymentMethod(method) {
    this.selectedPaymentMethod = method

    // Visual feedback
    document.querySelectorAll('.payment-btn').forEach(btn => {
      btn.classList.remove('selected')
    })

    const selectedBtn = document.querySelector(`[data-method="${method}"]`)
    if (selectedBtn) {
      selectedBtn.classList.add('selected')
    }

    // Complete sale button durumu
    const completeSaleBtn = document.getElementById('completeSaleBtn')
    if (completeSaleBtn) {
      completeSaleBtn.disabled = this.cart.items.length === 0
    }
  }

  applyDiscount() {
    try {
      const discountAmount = parseFloat(document.getElementById('discountAmount').value) || 0
      const discountType = document.getElementById('discountType').value

      if (discountAmount < 0) {
        this.showNotification('İndirim miktarı negatif olamaz', 'warning')
        return
      }

      if (discountType === 'percent') {
        if (discountAmount > 100) {
          this.showNotification('İndirim %100\'den fazla olamaz', 'warning')
          return
        }
        this.cart.discount = (this.cart.subtotal * discountAmount) / 100
      } else {
        if (discountAmount > this.cart.subtotal) {
          this.showNotification('İndirim ara toplamdan fazla olamaz', 'warning')
          return
        }
        this.cart.discount = discountAmount
      }

      this.calculateCartTotals()
      this.updateCartDisplay()

      this.showNotification('İndirim uygulandı', 'success')

    } catch (error) {
      console.error('Apply discount error:', error)
      this.showNotification('İndirim uygulanamadı: ' + error.message, 'error')
    }
  }

  async completeSale() {
    try {
      if (this.cart.items.length === 0) {
        this.showNotification('Sepet boş', 'warning')
        return
      }

      if (!this.selectedPaymentMethod) {
        this.showNotification('Ödeme yöntemi seçin', 'warning')
        return
      }

      this.showLoading('Satış işleniyor...')

      // Müşteri bilgilerini al
      const customerName = document.getElementById('customerName')
      const customerPhone = document.getElementById('customerPhone')

      this.cart.customer = {
        name: customerName ? customerName.value.trim() : '',
        phone: customerPhone ? customerPhone.value.trim() : ''
      }

      // Ödeme işlemini başlat
      let paymentResult
      if (this.selectedPaymentMethod === 'cash') {
        paymentResult = await this.processCashPayment()
      } else if (this.selectedPaymentMethod === 'card') {
        paymentResult = await this.processCardPayment()
      }

      if (!paymentResult || !paymentResult.success) {
        this.hideLoading()
        this.showNotification('Ödeme işlemi başarısız: ' + (paymentResult?.error || 'Bilinmeyen hata'), 'error')
        return
      }

      // Satışı kaydet
      const saleData = {
        items: this.cart.items,
        subtotal: this.cart.subtotal,
        discount: this.cart.discount,
        total: this.cart.total,
        paymentMethod: this.selectedPaymentMethod,
        customer: this.cart.customer,
        transactionData: paymentResult.transaction
      }

      const saleResult = await window.electronAPI.saveSale(saleData)

      this.hideLoading()

      if (saleResult.success) {
        this.showNotification(`Satış tamamlandı! Fiş No: ${saleResult.saleNumber}`, 'success')
        
        // Sepeti temizle
        this.clearCart()
        
        // Dashboard'u güncelle
        if (this.currentPage === 'dashboard') {
          await this.loadDashboard()
        }
      } else {
        this.showNotification('Satış kaydedilemedi: ' + saleResult.error, 'error')
      }

    } catch (error) {
      this.hideLoading()
      console.error('Complete sale error:', error)
      this.showNotification('Satış tamamlanamadı: ' + error.message, 'error')
    }
  }

  async processCashPayment() {
    try {
      // Nakit ödeme için basit onay
      return {
        success: true,
        transaction: {
          id: 'CASH_' + Date.now(),
          method: 'cash',
          amount: this.cart.total,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('Cash payment error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async processCardPayment() {
    try {
      this.showNotification('POS cihazında kartı okutun...', 'info')
      
      const paymentData = {
        amount: this.cart.total,
        method: 'card'
      }

      const result = await window.electronAPI.processPayment(paymentData)
      
      if (result.success) {
        this.showNotification('Kart ödemesi onaylandı', 'success')
      }
      
      return result
    } catch (error) {
      console.error('Card payment error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Products page
  async loadProducts() {
    try {
      this.showLoading('Ürünler yükleniyor...')

      const products = await window.electronAPI.getLocalProducts()
      this.products = products || []

      this.displayProducts(this.products)
      this.loadProductCategories()

      this.hideLoading()
    } catch (error) {
      this.hideLoading()
      console.error('Load products error:', error)
      this.showNotification('Ürünler yüklenemedi: ' + error.message, 'error')
    }
  }

  displayProducts(products) {
    const productsGrid = document.getElementById('productsGrid')
    if (!productsGrid) return

    if (products.length === 0) {
      productsGrid.innerHTML = '<div class="empty-state">Ürün bulunamadı</div>'
      return
    }

    productsGrid.innerHTML = products.map(product => `
      <div class="product-card" onclick="app.showProductDetail(${product.id})">
        <img src="${product.image || '/placeholder.svg'}" alt="${product.name}" class="product-image-small">
        <div class="product-info">
          <h5 class="product-name">${product.name}</h5>
          <div class="product-price">₺${product.price.toFixed(2)}</div>
          <div class="product-stock">Stok: ${product.stock}</div>
          <div class="product-barcode">${product.barcode}</div>
          <span class="stock-badge ${this.getStockBadgeClass(product.stock)}">${this.getStockStatus(product.stock)}</span>
        </div>
      </div>
    `).join('')
  }

  getStockBadgeClass(stock) {
    if (stock <= 0) return 'out-of-stock'
    if (stock <= 10) return 'low-stock'
    return 'in-stock'
  }

  getStockStatus(stock) {
    if (stock <= 0) return 'Stok Yok'
    if (stock <= 10) return 'Az Stok'
    return 'Stokta'
  }

  async syncProducts() {
    try {
      this.showLoading('WooCommerce\'den ürünler senkronize ediliyor...')

      const result = await window.electronAPI.syncProducts()

      this.hideLoading()

      if (result.success) {
        this.showNotification(`Senkronizasyon tamamlandı: ${result.summary.total} ürün işlendi`, 'success')
        await this.loadProducts()
      } else {
        this.showNotification('Senkronizasyon başarısız: ' + result.error, 'error')
      }
    } catch (error) {
      this.hideLoading()
      console.error('Sync products error:', error)
      this.showNotification('Senkronizasyon hatası: ' + error.message, 'error')
    }
  }

  filterProducts(searchTerm) {
    if (!searchTerm) {
      this.displayProducts(this.products)
      return
    }

    const filtered = this.products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode.includes(searchTerm)
    )

    this.displayProducts(filtered)
  }

  filterProductsByCategory(category) {
    if (!category) {
      this.displayProducts(this.products)
      return
    }

    const filtered = this.products.filter(product => product.category === category)
    this.displayProducts(filtered)
  }

  loadProductCategories() {
    const categoryFilter = document.getElementById('categoryFilter')
    if (!categoryFilter) return

    const categories = [...new Set(this.products.map(p => p.category).filter(Boolean))]
    
    categoryFilter.innerHTML = '<option value="">Tüm Kategoriler</option>' +
      categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')
  }

  // Settings
  async loadSettings() {
    try {
      this.settings = await window.electronAPI.getSettings()

      // WooCommerce ayarlarını doldur
      this.updateElement('wooUrl', this.settings.woocommerce_url || '', 'value')
      this.updateElement('wooConsumerKey', this.settings.woocommerce_consumer_key || '', 'value')
      this.updateElement('wooConsumerSecret', this.settings.woocommerce_consumer_secret || '', 'value')

      // Database ayarlarını doldur
      this.updateElement('subdomainUrl', this.settings.subdomain_db_url || '', 'value')
      this.updateElement('syncInterval', this.settings.sync_interval_minutes || '15', 'value')

      // POS ayarlarını doldur
      this.updateElement('posDevice', this.settings.pos_device || 'beko300tr', 'value')
      this.updateElement('posPort', this.settings.pos_port || 'COM1', 'value')

      // Backup ayarlarını doldur
      this.updateElement('backupInterval', this.settings.backup_interval || '24', 'value')
      this.updateElement('backupLocation', this.settings.backup_location || 'C:\\PROVANYA\\Backups', 'value')

    } catch (error) {
      console.error('Load settings error:', error)
      this.showNotification('Ayarlar yüklenemedi: ' + error.message, 'error')
    }
  }

  async saveWooCommerceSettings() {
    try {
      const settings = {
        woocommerce_url: document.getElementById('wooUrl').value.trim(),
        woocommerce_consumer_key: document.getElementById('wooConsumerKey').value.trim(),
        woocommerce_consumer_secret: document.getElementById('wooConsumerSecret').value.trim()
      }

      if (!settings.woocommerce_url || !settings.woocommerce_consumer_key || !settings.woocommerce_consumer_secret) {
        this.showNotification('Tüm alanları doldurun', 'warning')
        return
      }

      this.showLoading('WooCommerce ayarları kaydediliyor...')

      const result = await window.electronAPI.saveSettings(settings)

      this.hideLoading()

      if (result.success) {
        this.showNotification('WooCommerce ayarları kaydedildi', 'success')
        this.updateConnectionStatus('woo', 'saved')
      } else {
        this.showNotification('Ayarlar kaydedilemedi: ' + result.error, 'error')
      }
    } catch (error) {
      this.hideLoading()
      console.error('Save WooCommerce settings error:', error)
      this.showNotification('Ayarlar kaydedilemedi: ' + error.message, 'error')
    }
  }

  async testWooCommerceConnection() {
    try {
      this.showLoading('WooCommerce bağlantısı test ediliyor...')

      const result = await window.electronAPI.testWooCommerceConnection()

      this.hideLoading()

      const statusElement = document.getElementById('wooStatus')
      const statusText = document.getElementById('wooStatusText')

      if (result.success) {
        this.updateConnectionStatus('woo', 'success')
        if (statusText) statusText.textContent = 'Bağlantı başarılı'
        this.showNotification('WooCommerce bağlantısı başarılı', 'success')
      } else {
        this.updateConnectionStatus('woo', 'error')
        if (statusText) statusText.textContent = 'Bağlantı başarısız: ' + result.error
        this.showNotification('WooCommerce bağlantısı başarısız: ' + result.error, 'error')
      }
    } catch (error) {
      this.hideLoading()
      console.error('Test WooCommerce connection error:', error)
      this.showNotification('Bağlantı testi hatası: ' + error.message, 'error')
    }
  }

  async testDatabaseConnection() {
    try {
      this.showLoading('Database bağlantısı test ediliyor...')

      const result = await window.electronAPI.testDatabaseConnection()

      this.hideLoading()

      if (result.success) {
        this.updateConnectionStatus('db', 'success')
        this.showNotification('Database bağlantısı başarılı', 'success')
      } else {
        this.updateConnectionStatus('db', 'error')
        this.showNotification('Database bağlantısı başarısız: ' + result.error, 'error')
      }
    } catch (error) {
      this.hideLoading()
      console.error('Test database connection error:', error)
      this.showNotification('Database testi hatası: ' + error.message, 'error')
    }
  }

  // Customers
  async loadCustomers() {
    try {
      this.showLoading('Müşteriler yükleniyor...')

      const customers = await window.electronAPI.getCustomers()
      this.customers = customers || []

      this.displayCustomers(this.customers)

      this.hideLoading()
    } catch (error) {
      this.hideLoading()
      console.error('Load customers error:', error)
      this.showNotification('Müşteriler yüklenemedi: ' + error.message, 'error')
    }
  }

  displayCustomers(customers) {
    const customersTable = document.getElementById('customersTable')
    const tbody = customersTable ? customersTable.querySelector('tbody') : null
    
    if (!tbody) return

    if (customers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Müşteri bulunamadı</td></tr>'
      return
    }

    tbody.innerHTML = customers.map(customer => `
      <tr onclick="app.editCustomer('${customer.customer_name}')">
        <td>${customer.customer_name || '-'}</td>
        <td>${customer.customer_phone || '-'}</td>
        <td>-</td>
        <td>₺${(customer.total_spent || 0).toFixed(2)}</td>
        <td>${this.formatDate(customer.last_order)}</td>
        <td><span class="badge badge-success">Aktif</span></td>
        <td>
          <button class="btn btn-sm btn-info" onclick="event.stopPropagation(); app.viewCustomerDetails('${customer.customer_name}')">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn btn-sm btn-warning" onclick="event.stopPropagation(); app.editCustomer('${customer.customer_name}')">
            <i class="fas fa-edit"></i>
          </button>
        </td>
      </tr>
    `).join('')
  }

  // Reports
  async loadReports() {
    try {
      // Varsayılan tarih aralığını ayarla
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)

      const reportStartDate = document.getElementById('reportStartDate')
      const reportEndDate = document.getElementById('reportEndDate')

      if (reportStartDate) reportStartDate.value = startDate.toISOString().split('T')[0]
      if (reportEndDate) reportEndDate.value = endDate.toISOString().split('T')[0]

      // Varsayılan raporu oluştur
      await this.generateReport()
    } catch (error) {
      console.error('Load reports error:', error)
      this.showNotification('Raporlar yüklenemedi: ' + error.message, 'error')
    }
  }

  async generateReport() {
    try {
      const reportType = document.getElementById('reportType').value
      const startDate = document.getElementById('reportStartDate').value
      const endDate = document.getElementById('reportEndDate').value

      if (!startDate || !endDate) {
        this.showNotification('Tarih aralığı seçin', 'warning')
        return
      }

      this.showLoading('Rapor oluşturuluyor...')

      const filters = { startDate, endDate }
      const reportData = await window.electronAPI.getReports(reportType, filters)

      this.hideLoading()

      if (reportData) {
        this.displayReport(reportType, reportData)
        this.showNotification('Rapor oluşturuldu', 'success')
      } else {
        this.showNotification('Rapor oluşturulamadı', 'error')
      }
    } catch (error) {
      this.hideLoading()
      console.error('Generate report error:', error)
      this.showNotification('Rapor hatası: ' + error.message, 'error')
    }
  }

  displayReport(type, data) {
    // Rapor verilerini tabloda göster
    const reportTable = document.getElementById('reportTable')
    const thead = document.getElementById('reportTableHead')
    const tbody = document.getElementById('reportTableBody')

    if (!reportTable || !thead || !tbody) return

    // Rapor tipine göre başlıkları ayarla
    let headers = []
    let rows = []

    switch (type) {
      case 'sales':
        headers = ['Tarih', 'Satış Sayısı', 'Toplam Tutar', 'Ortalama']
        rows = data.map(item => [
          this.formatDate(item.date),
          item.total_sales || 0,
          `₺${(item.total_revenue || 0).toFixed(2)}`,
          `₺${(item.avg_sale || 0).toFixed(2)}`
        ])
        break
      case 'products':
        headers = ['Ürün', 'Kategori', 'Satılan Adet', 'Toplam Gelir']
        rows = data.map(item => [
          item.name,
          item.category || '-',
          item.total_sold || 0,
          `₺${(item.total_revenue || 0).toFixed(2)}`
        ])
        break
      default:
        headers = ['Veri']
        rows = [['Rapor verisi bulunamadı']]
    }

    thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>'
    tbody.innerHTML = rows.map(row => 
      '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>'
    ).join('')
  }

  // Utility functions
  updateElement(id, value, property = 'textContent') {
    const element = document.getElementById(id)
    if (element) {
      if (property === 'value') {
        element.value = value
      } else {
        element[property] = value
      }
    }
  }

  showLoading(message = 'Yükleniyor...') {
    // Loading indicator göster
    const loadingElements = document.querySelectorAll('.loading')
    loadingElements.forEach(el => {
      el.innerHTML = `<div class="spinner"></div> ${message}`
      el.style.display = 'block'
    })
  }

  hideLoading() {
    const loadingElements = document.querySelectorAll('.loading')
    loadingElements.forEach(el => {
      el.style.display = 'none'
    })
  }

  showNotification(message, type = 'info') {
    try {
      const container = document.getElementById('notificationContainer')
      if (!container) {
        console.log(`Notification (${type}): ${message}`)
        return
      }

      const notification = document.createElement('div')
      notification.className = `notification ${type}`
      notification.innerHTML = `
        <div class="notification-content">
          <i class="fas fa-${this.getNotificationIcon(type)}"></i>
          <span>${message}</span>
        </div>
      `

      container.appendChild(notification)

      // 5 saniye sonra kaldır
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 5000)

      // Click to dismiss
      notification.addEventListener('click', () => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      })

    } catch (error) {
      console.error('Show notification error:', error)
    }
  }

  getNotificationIcon(type) {
    switch (type) {
      case 'success': return 'check-circle'
      case 'error': return 'exclamation-circle'
      case 'warning': return 'exclamation-triangle'
      case 'info': return 'info-circle'
      default: return 'info-circle'
    }
  }

  updateConnectionStatus(type, status) {
    const statusElement = document.getElementById(`${type}Status`)
    if (statusElement) {
      statusElement.className = `status-indicator ${status}`
    }
  }

  formatDate(dateString) {
    if (!dateString) return '-'
    
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('tr-TR')
    } catch (error) {
      return dateString
    }
  }

  formatDateTime(dateString) {
    if (!dateString) return '-'
    
    try {
      const date = new Date(dateString)
      return date.toLocaleString('tr-TR')
    } catch (error) {
      return dateString
    }
  }

  // Modal management
  showModal(modalId) {
    const modal = document.getElementById(modalId)
    if (modal) {
      modal.style.display = 'block'
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId)
    if (modal) {
      modal.style.display = 'none'
    }
  }

  // Connection monitoring
  async checkConnectionStatus() {
    try {
      const syncStatus = await window.electronAPI.getSyncStatus()
      
      this.isOnline = syncStatus.isOnline
      this.isSyncing = syncStatus.isSyncing

      // Connection status güncelle
      const connectionIcon = document.getElementById('connectionIcon')
      const connectionText = document.getElementById('connectionText')
      const connectionStatus = document.getElementById('connectionStatus')

      if (connectionStatus) {
        if (this.isOnline) {
          connectionStatus.className = 'connection-status online'
          if (connectionIcon) connectionIcon.className = 'fas fa-wifi'
          if (connectionText) connectionText.textContent = 'Çevrimiçi'
        } else {
          connectionStatus.className = 'connection-status offline'
          if (connectionIcon) connectionIcon.className = 'fas fa-wifi-slash'
          if (connectionText) connectionText.textContent = 'Çevrimdışı'
        }
      }

      // Sync status güncelle
      const syncIcon = document.getElementById('syncIcon')
      const syncText = document.getElementById('syncText')

      if (this.isSyncing) {
        if (syncIcon) {
          syncIcon.className = 'fas fa-sync-alt spinning'
        }
        if (syncText) syncText.textContent = 'Senkronize ediliyor...'
      } else {
        if (syncIcon) {
          syncIcon.className = 'fas fa-sync-alt'
        }
        if (syncText) {
          const lastSync = syncStatus.lastSyncTime
          if (lastSync) {
            syncText.textContent = 'Son: ' + this.formatDateTime(new Date(lastSync))
          } else {
            syncText.textContent = 'Henüz senkronize edilmedi'
          }
        }
      }

    } catch (error) {
      console.error('Check connection status error:', error)
    }
  }

  startPeriodicSync() {
    // Her 30 saniyede bağlantı durumunu kontrol et
    setInterval(() => {
      this.checkConnectionStatus()
    }, 30000)

    // Her 5 dakikada manuel sync tetikle
    setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        try {
          await window.electronAPI.manualSync()
        } catch (error) {
          console.error('Periodic sync error:', error)
        }
      }
    }, 300000) // 5 dakika
  }

  // Chart drawing (simple implementation)
  drawSalesChart() {
    const canvas = document.getElementById('salesChart')
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    
    // Simple chart drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#3498db'
    ctx.fillRect(50, 50, 100, 100)
    ctx.fillStyle = '#2c3e50'
    ctx.font = '14px Arial'
    ctx.fillText('Satış Grafiği', 10, 20)
    ctx.fillText('(Chart.js entegrasyonu gerekli)', 10, 180)
  }

  updateRecentTransactions(transactions) {
    const tbody = document.querySelector('#recentTransactions tbody')
    if (!tbody) return

    if (transactions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Son işlem bulunamadı</td></tr>'
      return
    }

    tbody.innerHTML = transactions.map(sale => `
      <tr onclick="app.viewSaleDetails(${sale.id})">
        <td>${this.formatDateTime(sale.created_at)}</td>
        <td>${sale.customer_name || 'Misafir'}</td>
        <td>${sale.item_count || 0}</td>
        <td>₺${sale.total.toFixed(2)}</td>
        <td>${this.getPaymentMethodText(sale.payment_method)}</td>
        <td>
          <button class="btn btn-sm btn-info" onclick="event.stopPropagation(); app.viewSaleDetails(${sale.id})">
            <i class="fas fa-eye"></i>
          </button>
        </td>
      </tr>
    `).join('')
  }

  getPaymentMethodText(method) {
    switch (method) {
      case 'cash': return 'Nakit'
      case 'card': return 'Kart'
      case 'mixed': return 'Karma'
      default: return method
    }
  }

  // Error handling
  handleError(error, context = 'Genel') {
    console.error(`${context} error:`, error)
    
    let userMessage = 'Bir hata oluştu'
    
    if (error.message) {
      if (error.message.includes('ENOTFOUND')) {
        userMessage = 'İnternet bağlantısı bulunamadı'
      } else if (error.message.includes('ECONNREFUSED')) {
        userMessage = 'Sunucuya bağlanılamadı'
      } else if (error.message.includes('timeout')) {
        userMessage = 'Bağlantı zaman aşımı'
      } else {
        userMessage = error.message
      }
    }
    
    this.showNotification(`${context}: ${userMessage}`, 'error')
  }

  // Placeholder functions for missing features
  showProductDetail(productId) {
    console.log('Show product detail:', productId)
    this.showNotification('Ürün detay özelliği geliştiriliyor', 'info')
  }

  showCustomerModal() {
    this.showModal('customerModal')
  }

  editCustomer(customerName) {
    console.log('Edit customer:', customerName)
    this.showNotification('Müşteri düzenleme özelliği geliştiriliyor', 'info')
  }

  viewCustomerDetails(customerName) {
    console.log('View customer details:', customerName)
    this.showNotification('Müşteri detay özelliği geliştiriliyor', 'info')
  }

  saveCustomer() {
    console.log('Save customer')
    this.showNotification('Müşteri kaydetme özelliği geliştiriliyor', 'info')
    this.closeModal('customerModal')
  }

  viewSaleDetails(saleId) {
    console.log('View sale details:', saleId)
    this.showNotification('Satış detay özelliği geliştiriliyor', 'info')
  }

  showSalesHistory() {
    this.showModal('salesHistoryModal')
    this.showNotification('Satış geçmişi özelliği geliştiriliyor', 'info')
  }

  async createBackup() {
    try {
      this.showLoading('Yedek oluşturuluyor...')
      
      const result = await window.electronAPI.exportData()
      
      this.hideLoading()
      
      if (result.success) {
        this.showNotification('Yedek başarıyla oluşturuldu', 'success')
      } else {
        this.showNotification('Yedek oluşturulamadı: ' + result.error, 'error')
      }
    } catch (error) {
      this.hideLoading()
      this.handleError(error, 'Yedekleme')
    }
  }

  restoreBackup() {
    this.showNotification('Yedek geri yükleme özelliği geliştiriliyor', 'info')
  }

  testPOSConnection() {
    this.showNotification('POS bağlantı testi özelliği geliştiriliyor', 'info')
  }

  savePOSSettings() {
    this.showNotification('POS ayarları kaydetme özelliği geliştiriliyor', 'info')
  }

  saveDatabaseSettings() {
    this.showNotification('Database ayarları kaydetme özelliği geliştiriliyor', 'info')
  }

  updateReportFilters() {
    console.log('Update report filters')
  }
}

// Global app instance
let app

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app = new POSApp()
  })
} else {
  app = new POSApp()
}

// Global functions for onclick handlers
window.app = app