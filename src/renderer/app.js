// POS Application Frontend Logic
class POSApp {
  constructor() {
    this.cart = []
    this.currentProduct = null
    this.selectedPaymentMethod = null
    this.isOnline = false
    this.subtotal = 0
    this.discount = 0
    this.total = 0

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.initialize()
      })
    } else {
      this.initialize()
    }
  }

  async initialize() {
    try {
      console.log("[v0] Initializing POS App...")

      // DOM yüklenmesini bekle
      if (document.readyState === "loading") {
        await new Promise((resolve) => {
          document.addEventListener("DOMContentLoaded", resolve)
        })
      }

      // Event listener'ları başlat
      this.initializeEventListeners()
      this.initializeTestButtons()

      // Varsayılan sayfa göster
      this.showPage("dashboardPage")

      // Dashboard verilerini yükle
      await this.loadDashboardData()

      setTimeout(() => {
        this.runStartupTests()
      }, 2000) // 2 saniye bekle ki UI yüklensin

      console.log("[v0] POS App initialized successfully")
    } catch (error) {
      console.error("[v0] POS App initialization error:", error)
      this.showError("Uygulama başlatılamadı: " + error.message)
    }
  }

  initializeEventListeners() {
    const barcodeInput = document.getElementById("barcodeInput")
    const searchBtn = document.getElementById("searchBtn")

    if (!barcodeInput || !searchBtn) {
      console.error("[v0] Critical DOM elements not found")
      return
    }

    barcodeInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.searchProduct()
      }
    })

    searchBtn.addEventListener("click", () => {
      this.searchProduct()
    })

    // Sepete ekleme
    const addToCartBtn = document.getElementById("addToCartBtn")
    if (addToCartBtn) {
      addToCartBtn.addEventListener("click", () => {
        this.addToCart()
      })
    } else {
      console.error("[v0] Element not found: addToCartBtn")
    }

    // Sepet temizleme
    const clearCartBtn = document.getElementById("clearCartBtn")
    if (clearCartBtn) {
      clearCartBtn.addEventListener("click", () => {
        this.clearCart()
      })
    } else {
      console.error("[v0] Element not found: clearCartBtn")
    }

    // İndirim uygulama
    const applyDiscountBtn = document.getElementById("applyDiscountBtn")
    if (applyDiscountBtn) {
      applyDiscountBtn.addEventListener("click", () => {
        this.applyDiscount()
      })
    } else {
      console.error("[v0] Element not found: applyDiscountBtn")
    }

    // Ödeme yöntemi seçimi
    const paymentBtns = document.querySelectorAll(".payment-btn")
    if (paymentBtns) {
      paymentBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          this.selectPaymentMethod(e.currentTarget.dataset.method)
        })
      })
    } else {
      console.error("[v0] Elements not found: .payment-btn")
    }

    // Satış tamamlama
    const completeSaleBtn = document.getElementById("completeSaleBtn")
    if (completeSaleBtn) {
      completeSaleBtn.addEventListener("click", () => {
        this.completeSale()
      })
    } else {
      console.error("[v0] Element not found: completeSaleBtn")
    }

    // Hızlı işlemler
    const salesHistoryBtn = document.getElementById("salesHistoryBtn")
    if (salesHistoryBtn) {
      salesHistoryBtn.addEventListener("click", () => {
        this.showSalesHistory()
      })
    } else {
      console.error("[v0] Element not found: salesHistoryBtn")
    }

    const syncBtn = document.getElementById("syncBtn")
    if (syncBtn) {
      syncBtn.addEventListener("click", () => {
        this.manualSync()
      })
    } else {
      console.error("[v0] Element not found: syncBtn")
    }

    // Modal işlemleri
    const cancelPaymentBtn = document.getElementById("cancelPaymentBtn")
    if (cancelPaymentBtn) {
      cancelPaymentBtn.addEventListener("click", () => {
        this.hideModal("paymentModal")
      })
    } else {
      console.error("[v0] Element not found: cancelPaymentBtn")
    }

    const confirmPaymentBtn = document.getElementById("confirmPaymentBtn")
    if (confirmPaymentBtn) {
      confirmPaymentBtn.addEventListener("click", () => {
        this.processPayment()
      })
    } else {
      console.error("[v0] Element not found: confirmPaymentBtn")
    }

    const closeSalesHistoryBtn = document.getElementById("closeSalesHistoryModal")
    if (closeSalesHistoryBtn) {
      closeSalesHistoryBtn.addEventListener("click", () => {
        this.hideModal("salesHistoryModal")
      })
    } else {
      console.error("[v0] Element not found: closeSalesHistoryBtn")
    }

    const navBtns = document.querySelectorAll(".nav-item")
    if (navBtns) {
      navBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const page = e.currentTarget.dataset.page
          const pageId = page === "dashboard" ? "dashboardPage" : page + "Page"
          this.showPage(pageId)
        })
      })
    } else {
      console.error("[v0] Elements not found: .nav-item")
    }

    const testWooCommerceBtn = document.getElementById("testWooConnectionBtn")
    if (testWooCommerceBtn) {
      testWooCommerceBtn.addEventListener("click", () => {
        this.testWooCommerceConnection()
      })
    } else {
      console.error("[v0] Element not found: testWooConnectionBtn")
    }

    const testDatabaseBtn = document.getElementById("testDbConnectionBtn")
    if (testDatabaseBtn) {
      testDatabaseBtn.addEventListener("click", () => {
        this.testDatabaseConnection()
      })
    } else {
      console.error("[v0] Element not found: testDbConnectionBtn")
    }

    const syncProductsBtn = document.getElementById("syncProductsBtn")
    if (syncProductsBtn) {
      syncProductsBtn.addEventListener("click", () => {
        this.syncProducts()
      })
    } else {
      console.error("[v0] Element not found: syncProductsBtn")
    }

    // Product detail modal
    const closeProductDetailBtn = document.getElementById("closeProductDetailBtn")
    if (closeProductDetailBtn) {
      closeProductDetailBtn.addEventListener("click", () => {
        this.hideModal("productDetailModal")
      })
    } else {
      console.error("[v0] Element not found: closeProductDetailBtn")
    }

    const addProductToCartBtn = document.getElementById("addToCartFromDetailBtn")
    if (addProductToCartBtn) {
      addProductToCartBtn.addEventListener("click", () => {
        this.addProductToCartFromModal()
      })
    } else {
      console.error("[v0] Element not found: addToCartFromDetailBtn")
    }
  }

  initializeElectronListeners() {
    // Electron IPC event listeners
    window.electronAPI.onNewSale(() => {
      this.clearCart()
      const barcodeInput = document.getElementById("barcodeInput")
      if (barcodeInput) {
        barcodeInput.focus()
      } else {
        console.error("[v0] Element not found: barcodeInput")
      }
    })

    window.electronAPI.onShowHistory(() => {
      this.showSalesHistory()
    })

    window.electronAPI.onConnectionStatus((event, isOnline) => {
      this.updateConnectionStatus(isOnline)
    })
  }

  async searchProduct() {
    const barcode = document.getElementById("barcodeInput").value.trim()
    if (!barcode) return

    try {
      // Loading state
      const searchBtn = document.getElementById("searchBtn")
      if (searchBtn) {
        searchBtn.innerHTML = '<i class="fas fa-spinner spinning"></i> Aranıyor...'
      } else {
        console.error("[v0] Element not found: searchBtn")
      }

      const product = await window.electronAPI.searchProduct(barcode)

      if (product) {
        this.currentProduct = product
        this.displayProductInfo(product)
      } else {
        this.showError("Ürün bulunamadı!")
        this.hideProductInfo()
      }
    } catch (error) {
      console.error("Product search error:", error)
      this.showError("Ürün arama hatası: " + error.message)
    } finally {
      const searchBtn = document.getElementById("searchBtn")
      if (searchBtn) {
        searchBtn.innerHTML = '<i class="fas fa-search"></i> Ara'
      } else {
        console.error("[v0] Element not found: searchBtn")
      }
    }
  }

  displayProductInfo(product) {
    const productInfo = document.getElementById("productInfo")
    const productImage = document.getElementById("productImage")
    const productName = document.getElementById("productName")
    const productPrice = document.getElementById("productPrice")
    const productStock = document.getElementById("productStock")

    if (productInfo && productImage && productName && productPrice && productStock) {
      productImage.src = product.image || "/diverse-products-still-life.png"
      productName.textContent = product.name
      productPrice.textContent = `₺${product.price.toFixed(2)}`
      productStock.textContent = `Stok: ${product.stock} adet`

      productInfo.style.display = "block"
      document.getElementById("quantity").value = 1
    } else {
      console.error("[v0] Critical DOM elements not found")
    }
  }

  hideProductInfo() {
    const productInfo = document.getElementById("productInfo")
    if (productInfo) {
      productInfo.style.display = "none"
      this.currentProduct = null
    } else {
      console.error("[v0] Element not found: productInfo")
    }
  }

  addToCart() {
    if (!this.currentProduct) return

    const quantity = Number.parseInt(document.getElementById("quantity").value) || 1

    if (quantity > this.currentProduct.stock) {
      this.showError("Yetersiz stok!")
      return
    }

    // Sepette aynı ürün var mı kontrol et
    const existingItem = this.cart.find((item) => item.id === this.currentProduct.id)

    if (existingItem) {
      existingItem.quantity += quantity
      existingItem.total = existingItem.quantity * existingItem.price
    } else {
      this.cart.push({
        id: this.currentProduct.id,
        name: this.currentProduct.name,
        price: this.currentProduct.price,
        quantity: quantity,
        total: this.currentProduct.price * quantity,
        barcode: this.currentProduct.barcode,
      })
    }

    this.updateCartDisplay()
    this.hideProductInfo()
    const barcodeInput = document.getElementById("barcodeInput")
    if (barcodeInput) {
      barcodeInput.value = ""
      barcodeInput.focus()
    } else {
      console.error("[v0] Element not found: barcodeInput")
    }

    this.showSuccess("Ürün sepete eklendi!")
  }

  removeFromCart(productId) {
    this.cart = this.cart.filter((item) => item.id !== productId)
    this.updateCartDisplay()
  }

  updateCartQuantity(productId, newQuantity) {
    const item = this.cart.find((item) => item.id === productId)
    if (item) {
      item.quantity = Math.max(1, newQuantity)
      item.total = item.quantity * item.price
      this.updateCartDisplay()
    }
  }

  clearCart() {
    this.cart = []
    this.discount = 0
    this.updateCartDisplay()
    this.hideProductInfo()
    const barcodeInput = document.getElementById("barcodeInput")
    if (barcodeInput) {
      barcodeInput.value = ""
    } else {
      console.error("[v0] Element not found: barcodeInput")
    }
    const discountAmount = document.getElementById("discountAmount")
    if (discountAmount) {
      discountAmount.value = ""
    } else {
      console.error("[v0] Element not found: discountAmount")
    }
    const customerName = document.getElementById("customerName")
    if (customerName) {
      customerName.value = ""
    } else {
      console.error("[v0] Element not found: customerName")
    }
    const customerPhone = document.getElementById("customerPhone")
    if (customerPhone) {
      customerPhone.value = ""
    } else {
      console.error("[v0] Element not found: customerPhone")
    }
    this.selectedPaymentMethod = null
    const paymentBtns = document.querySelectorAll(".payment-btn")
    if (paymentBtns) {
      paymentBtns.forEach((btn) => {
        btn.classList.remove("selected")
      })
    } else {
      console.error("[v0] Elements not found: .payment-btn")
    }
  }

  updateCartDisplay() {
    const cartItems = document.getElementById("cartItems")

    if (cartItems) {
      if (this.cart.length === 0) {
        cartItems.innerHTML = '<p class="empty-cart">Sepet boş</p>'
        this.subtotal = 0
        this.total = 0
      } else {
        cartItems.innerHTML = this.cart
          .map(
            (item) => `
                  <div class="cart-item">
                      <div class="cart-item-info">
                          <div class="cart-item-name">${item.name}</div>
                          <div class="cart-item-details">₺${item.price.toFixed(2)} x ${item.quantity}</div>
                      </div>
                      <div class="cart-item-actions">
                          <input type="number" value="${item.quantity}" min="1" 
                                 onchange="posApp.updateCartQuantity(${item.id}, this.value)"
                                 style="width: 60px; padding: 0.25rem;">
                          <span style="font-weight: bold; margin: 0 0.5rem;">₺${item.total.toFixed(2)}</span>
                          <button onclick="posApp.removeFromCart(${item.id})" 
                                  class="btn btn-warning" style="padding: 0.25rem 0.5rem;">
                              <i class="fas fa-trash"></i>
                          </button>
                      </div>
                  </div>
              `,
          )
          .join("")
      }

      this.subtotal = this.cart.reduce((sum, item) => sum + item.total, 0)
    } else {
      console.error("[v0] Element not found: cartItems")
    }

    this.total = Math.max(0, this.subtotal - this.discount)

    const subtotal = document.getElementById("subtotal")
    if (subtotal) {
      subtotal.textContent = `₺${this.subtotal.toFixed(2)}`
    } else {
      console.error("[v0] Element not found: subtotal")
    }

    const discount = document.getElementById("discount")
    if (discount) {
      discount.textContent = `₺${this.discount.toFixed(2)}`
    } else {
      console.error("[v0] Element not found: discount")
    }

    const total = document.getElementById("total")
    if (total) {
      total.textContent = `₺${this.total.toFixed(2)}`
    } else {
      console.error("[v0] Element not found: total")
    }

    // Satış tamamlama butonunu aktif/pasif yap
    const completeSaleBtn = document.getElementById("completeSaleBtn")
    if (completeSaleBtn) {
      completeSaleBtn.disabled = this.cart.length === 0 || !this.selectedPaymentMethod
    } else {
      console.error("[v0] Element not found: completeSaleBtn")
    }
  }

  applyDiscount() {
    const discountAmount = Number.parseFloat(document.getElementById("discountAmount").value) || 0
    const discountType = document.getElementById("discountType").value

    if (discountAmount <= 0) {
      this.showError("Geçerli bir indirim miktarı girin!")
      return
    }

    if (discountType === "percent") {
      if (discountAmount > 100) {
        this.showError("İndirim yüzdesi 100'den fazla olamaz!")
        return
      }
      this.discount = (this.subtotal * discountAmount) / 100
    } else {
      if (discountAmount > this.subtotal) {
        this.showError("İndirim miktarı ara toplamdan fazla olamaz!")
        return
      }
      this.discount = discountAmount
    }

    this.updateCartDisplay()
    this.showSuccess("İndirim uygulandı!")
  }

  selectPaymentMethod(method) {
    this.selectedPaymentMethod = method

    const paymentBtns = document.querySelectorAll(".payment-btn")
    if (paymentBtns) {
      paymentBtns.forEach((btn) => {
        btn.classList.remove("selected")
      })
    } else {
      console.error("[v0] Elements not found: .payment-btn")
    }

    const selectedBtn = document.querySelector(`[data-method="${method}"]`)
    if (selectedBtn) {
      selectedBtn.classList.add("selected")
    } else {
      console.error(`[v0] Element not found: [data-method="${method}"]`)
    }

    this.updateCartDisplay()
  }

  async completeSale() {
    if (this.cart.length === 0 || !this.selectedPaymentMethod) return

    const saleData = {
      items: this.cart,
      subtotal: this.subtotal,
      discount: this.discount,
      total: this.total,
      paymentMethod: this.selectedPaymentMethod,
      customer: {
        name: document.getElementById("customerName").value,
        phone: document.getElementById("customerPhone").value,
      },
      timestamp: new Date().toISOString(),
    }

    if (this.selectedPaymentMethod === "card") {
      this.showPaymentModal(saleData)
    } else {
      await this.processCashPayment(saleData)
    }
  }

  showPaymentModal(saleData) {
    const modal = document.getElementById("paymentModal")
    const content = document.getElementById("paymentContent")

    if (modal && content) {
      content.innerHTML = `
              <div style="text-align: center; padding: 2rem;">
                  <i class="fas fa-credit-card" style="font-size: 3rem; color: #3498db; margin-bottom: 1rem;"></i>
                  <h4>POS Cihazında Ödeme</h4>
                  <p>Toplam: <strong>₺${saleData.total.toFixed(2)}</strong></p>
                  <p>Lütfen müşteriden kartını POS cihazına okutmasını isteyin.</p>
                  <div style="margin: 2rem 0;">
                      <i class="fas fa-spinner spinning" style="font-size: 2rem; color: #f39c12;"></i>
                      <p>POS cihazı bekleniyor...</p>
                  </div>
              </div>
          `

      modal.style.display = "block"

      // Mock POS response - gerçek entegrasyonda POS cihazından gelecek
      setTimeout(() => {
        content.innerHTML = `
              <div style="text-align: center; padding: 2rem;">
                  <i class="fas fa-check-circle" style="font-size: 3rem; color: #2ecc71; margin-bottom: 1rem;"></i>
                  <h4>Ödeme Başarılı</h4>
                  <p>Toplam: <strong>₺${saleData.total.toFixed(2)}</strong></p>
                  <p>İşlem No: <strong>${Date.now()}</strong></p>
              </div>
          `

        const confirmPaymentBtn = document.getElementById("confirmPaymentBtn")
        if (confirmPaymentBtn) {
          confirmPaymentBtn.style.display = "inline-flex"
        } else {
          console.error("[v0] Element not found: confirmPaymentBtn")
        }
      }, 3000)
    } else {
      console.error("[v0] Critical DOM elements not found")
    }
  }

  async processPayment() {
    try {
      const saleData = {
        items: this.cart,
        subtotal: this.subtotal,
        discount: this.discount,
        total: this.total,
        paymentMethod: this.selectedPaymentMethod,
        customer: {
          name: document.getElementById("customerName").value,
          phone: document.getElementById("customerPhone").value,
        },
        timestamp: new Date().toISOString(),
      }

      const result = await window.electronAPI.saveSale(saleData)

      if (result.success) {
        const paymentModal = document.getElementById("paymentModal")
        if (paymentModal) {
          this.hideModal("paymentModal")
        } else {
          console.error("[v0] Element not found: paymentModal")
        }
        this.showSuccess("Satış başarıyla tamamlandı!")
        this.clearCart()

        // Fiş yazdırma simülasyonu
        this.printReceipt(saleData, result.saleId)
      } else {
        this.showError("Satış kaydedilemedi: " + result.error)
      }
    } catch (error) {
      console.error("Payment processing error:", error)
      this.showError("Ödeme işlemi hatası: " + error.message)
    }
  }

  async processCashPayment(saleData) {
    try {
      const result = await window.electronAPI.saveSale(saleData)

      if (result.success) {
        this.showSuccess("Nakit ödeme tamamlandı!")
        this.clearCart()
        this.printReceipt(saleData, result.saleId)
      } else {
        this.showError("Satış kaydedilemedi: " + result.error)
      }
    } catch (error) {
      console.error("Cash payment error:", error)
      this.showError("Nakit ödeme hatası: " + error.message)
    }
  }

  printReceipt(saleData, saleId) {
    // Fiş yazdırma simülasyonu - gerçek uygulamada yazıcı entegrasyonu yapılacak
    console.log("Printing receipt for sale:", saleId)

    const receiptWindow = window.open("", "_blank", "width=300,height=600")
    receiptWindow.document.write(`
            <html>
                <head>
                    <title>Fiş - ${saleId}</title>
                    <style>
                        body { font-family: monospace; font-size: 12px; margin: 10px; }
                        .center { text-align: center; }
                        .line { border-top: 1px dashed #000; margin: 10px 0; }
                        .total { font-weight: bold; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="center">
                        <h3>PROVANYA POS</h3>
                        <p>Satış Fişi</p>
                        <p>Fiş No: ${saleId}</p>
                        <p>${new Date(saleData.timestamp).toLocaleString("tr-TR")}</p>
                    </div>
                    <div class="line"></div>
                    ${saleData.items
                      .map(
                        (item) => `
                        <div>
                            ${item.name}<br>
                            ${item.quantity} x ₺${item.price.toFixed(2)} = ₺${item.total.toFixed(2)}
                        </div>
                    `,
                      )
                      .join("<br>")}
                    <div class="line"></div>
                    <div>Ara Toplam: ₺${saleData.subtotal.toFixed(2)}</div>
                    <div>İndirim: ₺${saleData.discount.toFixed(2)}</div>
                    <div class="total">TOPLAM: ₺${saleData.total.toFixed(2)}</div>
                    <div>Ödeme: ${saleData.paymentMethod === "cash" ? "Nakit" : "Kart"}</div>
                    ${saleData.customer.name ? `<div>Müşteri: ${saleData.customer.name}</div>` : ""}
                    <div class="line"></div>
                    <div class="center">
                        <p>Teşekkür ederiz!</p>
                    </div>
                </body>
            </html>
        `)
    receiptWindow.document.close()
    receiptWindow.print()
  }

  async showSalesHistory() {
    try {
      const sales = await window.electronAPI.getSalesHistory({})
      const modal = document.getElementById("salesHistoryModal")
      const content = document.getElementById("salesHistoryContent")

      if (modal && content) {
        if (sales.length === 0) {
          content.innerHTML = '<p class="empty-cart">Henüz satış kaydı bulunmuyor.</p>'
        } else {
          content.innerHTML = `
                      <div style="max-height: 400px; overflow-y: auto;">
                          <table style="width: 100%; border-collapse: collapse;">
                              <thead>
                                  <tr style="background: #f8f9fa; border-bottom: 2px solid #ddd;">
                                      <th style="padding: 0.75rem; text-align: left;">Tarih</th>
                                      <th style="padding: 0.75rem; text-align: left;">Fiş No</th>
                                      <th style="padding: 0.75rem; text-align: right;">Toplam</th>
                                      <th style="padding: 0.75rem; text-align: center;">Ödeme</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  ${sales
                                    .map(
                                      (sale) => `
                                      <tr style="border-bottom: 1px solid #eee;">
                                          <td style="padding: 0.75rem;">${new Date(sale.timestamp).toLocaleString("tr-TR")}</td>
                                          <td style="padding: 0.75rem;">${sale.id}</td>
                                          <td style="padding: 0.75rem; text-align: right;">₺${sale.total.toFixed(2)}</td>
                                          <td style="padding: 0.75rem; text-align: center;">
                                              ${sale.paymentMethod === "cash" ? "Nakit" : "Kart"}
                                          </td>
                                      </tr>
                                  `,
                                    )
                                    .join("")}
                              </tbody>
                          </table>
                      </div>
                  `
        }

        modal.style.display = "block"
      } else {
        console.error("[v0] Critical DOM elements not found")
      }
    } catch (error) {
      console.error("Sales history error:", error)
      this.showError("Satış geçmişi yüklenemedi: " + error.message)
    }
  }

  async manualSync() {
    try {
      const syncBtn = document.getElementById("syncBtn")
      const originalContent = syncBtn ? syncBtn.innerHTML : ""

      if (syncBtn) {
        syncBtn.innerHTML = '<i class="fas fa-spinner spinning"></i> Senkronize ediliyor...'
        syncBtn.disabled = true
      } else {
        console.error("[v0] Element not found: syncBtn")
      }

      const result = await window.electronAPI.manualSync()

      if (result.success) {
        this.showSuccess(`Senkronizasyon tamamlandı! ${result.syncedCount} kayıt senkronize edildi.`)
      } else {
        this.showError("Senkronizasyon hatası: " + result.error)
      }
    } catch (error) {
      console.error("Manual sync error:", error)
      this.showError("Senkronizasyon hatası: " + error.message)
    } finally {
      const syncBtn = document.getElementById("syncBtn")
      if (syncBtn) {
        syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Senkronize Et'
        syncBtn.disabled = false
      } else {
        console.error("[v0] Element not found: syncBtn")
      }
    }
  }

  updateConnectionStatus(isOnline) {
    this.isOnline = isOnline
    const statusElement = document.getElementById("connectionStatus")
    const iconElement = document.getElementById("connectionIcon")
    const textElement = document.getElementById("connectionText")

    if (statusElement && iconElement && textElement) {
      if (isOnline) {
        statusElement.className = "connection-status online"
        iconElement.className = "fas fa-wifi"
        textElement.textContent = "Çevrimiçi"
      } else {
        statusElement.className = "connection-status offline"
        iconElement.className = "fas fa-wifi-slash"
        textElement.textContent = "Çevrimdışı"
      }
    } else {
      console.error("[v0] Critical DOM elements not found")
    }
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId)
    if (modal) {
      modal.style.display = "block"
    } else {
      console.error(`[v0] Modal element not found: ${modalId}`)
    }
  }

  hideModal(modalId) {
    const modal = document.getElementById(modalId)
    if (modal) {
      modal.style.display = "none"
    } else {
      console.error(`[v0] Modal element not found: ${modalId}`)
    }
  }

  showSuccess(message) {
    // Basit toast notification - gerçek uygulamada daha gelişmiş olacak
    const toast = document.createElement("div")
    toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2ecc71;
            color: white;
            padding: 1rem 2rem;
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        `
    toast.textContent = message
    document.body.appendChild(toast)

    setTimeout(() => {
      document.body.removeChild(toast)
    }, 3000)
  }

  showError(message) {
    const toast = document.createElement("div")
    toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e74c3c;
            color: white;
            padding: 1rem 2rem;
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        `
    toast.textContent = message
    document.body.appendChild(toast)

    setTimeout(() => {
      document.body.removeChild(toast)
    }, 5000)
  }

  showPage(pageId) {
    const targetPage = document.getElementById(pageId)
    if (!targetPage) {
      console.error(`[v0] Page element not found: ${pageId}`)
      return
    }

    document.querySelectorAll(".page").forEach((page) => {
      page.classList.remove("active")
    })

    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.remove("active")
    })

    targetPage.classList.add("active")

    let dataPageValue = pageId.replace("Page", "")
    if (pageId === "dashboardPage") {
      dataPageValue = "dashboard"
    }

    const activeBtn = document.querySelector(`[data-page="${dataPageValue}"]`)
    if (activeBtn) {
      activeBtn.classList.add("active")
    }

    // Sayfa özel işlemleri
    if (pageId === "productsPage") {
      this.initializeProductsPage()
    } else if (pageId === "settingsPage") {
      this.loadSettings()
    }
  }

  async loadSettings() {
    try {
      const settings = await window.electronAPI.getSettings()

      const wooCommerceUrl = document.getElementById("wooUrl")
      if (wooCommerceUrl) {
        wooCommerceUrl.value = settings.wooCommerce?.url || ""
      } else {
        console.error("[v0] Element not found: wooUrl")
      }

      const wooCommerceKey = document.getElementById("wooConsumerKey")
      if (wooCommerceKey) {
        wooCommerceKey.value = settings.wooCommerce?.consumerKey || ""
      } else {
        console.error("[v0] Element not found: wooConsumerKey")
      }

      const wooCommerceSecret = document.getElementById("wooConsumerSecret")
      if (wooCommerceSecret) {
        wooCommerceSecret.value = settings.wooCommerce?.consumerSecret || ""
      } else {
        console.error("[v0] Element not found: wooConsumerSecret")
      }

      // Database ayarları
      const subdomainUrl = document.getElementById("subdomainUrl")
      if (subdomainUrl) {
        subdomainUrl.value = settings.database?.subdomainUrl || ""
      } else {
        console.error("[v0] Element not found: subdomainUrl")
      }

      const databaseName = document.getElementById("dbName")
      if (databaseName) {
        databaseName.value = settings.database?.name || ""
      } else {
        console.error("[v0] Element not found: dbName")
      }

      const databaseUser = document.getElementById("dbUsername")
      if (databaseUser) {
        databaseUser.value = settings.database?.user || ""
      } else {
        console.error("[v0] Element not found: dbUsername")
      }

      const databasePassword = document.getElementById("dbPassword")
      if (databasePassword) {
        databasePassword.value = settings.database?.password || ""
      } else {
        console.error("[v0] Element not found: dbPassword")
      }

      const dbHost = document.getElementById("dbHost")
      if (dbHost) {
        dbHost.value = settings.database?.host || "localhost"
      }

      const dbPort = document.getElementById("dbPort")
      if (dbPort) {
        dbPort.value = settings.database?.port || "3306"
      }

      const syncInterval = document.getElementById("syncInterval")
      if (syncInterval) {
        syncInterval.value = settings.database?.syncInterval || "5"
      }

      // POS cihazı ayarları
      const posDevice = document.getElementById("posDevice")
      if (posDevice) {
        posDevice.value = settings.pos?.device || "beko300tr"
      } else {
        console.error("[v0] Element not found: posDevice")
      }

      const posPort = document.getElementById("posPort")
      if (posPort) {
        posPort.value = settings.pos?.port || "COM1"
      } else {
        console.error("[v0] Element not found: posPort")
      }
    } catch (error) {
      console.error("Settings load error:", error)
      this.showError("Ayarlar yüklenemedi: " + error.message)
    }
  }

  async saveSettings() {
    try {
      const settings = {
        wooCommerce: {
          url: document.getElementById("wooUrl").value,
          consumerKey: document.getElementById("wooConsumerKey").value,
          consumerSecret: document.getElementById("wooConsumerSecret").value,
        },
        database: {
          subdomainUrl: document.getElementById("subdomainUrl").value,
          name: document.getElementById("dbName").value,
          user: document.getElementById("dbUsername").value,
          password: document.getElementById("dbPassword").value,
          host: document.getElementById("dbHost").value,
          port: document.getElementById("dbPort").value,
          syncInterval: document.getElementById("syncInterval").value,
        },
        pos: {
          device: document.getElementById("posDevice").value,
          port: document.getElementById("posPort").value,
        },
      }

      const result = await window.electronAPI.saveSettings(settings)

      if (result.success) {
        this.showSuccess("Ayarlar başarıyla kaydedildi!")
      } else {
        this.showError("Ayarlar kaydedilemedi: " + result.error)
      }
    } catch (error) {
      console.error("Settings save error:", error)
      this.showError("Ayarlar kaydedilemedi: " + error.message)
    }
  }

  async testWooCommerceConnection() {
    try {
      const btn = document.getElementById("testWooConnectionBtn")
      const originalText = btn ? btn.textContent : ""

      if (btn) {
        btn.textContent = "Test ediliyor..."
        btn.disabled = true
      } else {
        console.error("[v0] Element not found: testWooConnectionBtn")
      }

      const result = await window.electronAPI.testWooCommerceConnection()

      if (result.success) {
        this.showSuccess("WooCommerce bağlantısı başarılı!")
      } else {
        this.showError("WooCommerce bağlantı hatası: " + result.error)
      }
    } catch (error) {
      console.error("WooCommerce test error:", error)
      this.showError("WooCommerce test hatası: " + error.message)
    } finally {
      const btn = document.getElementById("testWooConnectionBtn")
      if (btn) {
        btn.textContent = "Bağlantıyı Test Et"
        btn.disabled = false
      } else {
        console.error("[v0] Element not found: testWooConnectionBtn")
      }
    }
  }

  async testDatabaseConnection() {
    try {
      const btn = document.getElementById("testDbConnectionBtn")
      const originalText = btn ? btn.textContent : ""

      if (btn) {
        btn.textContent = "Test ediliyor..."
        btn.disabled = true
      } else {
        console.error("[v0] Element not found: testDbConnectionBtn")
      }

      const result = await window.electronAPI.testDatabaseConnection()

      if (result.success) {
        this.showSuccess("Veritabanı bağlantısı başarılı!")
      } else {
        this.showError("Veritabanı bağlantı hatası: " + result.error)
      }
    } catch (error) {
      console.error("Database test error:", error)
      this.showError("Veritabanı test hatası: " + error.message)
    } finally {
      const btn = document.getElementById("testDbConnectionBtn")
      if (btn) {
        btn.textContent = "Bağlantıyı Test Et"
        btn.disabled = false
      } else {
        console.error("[v0] Element not found: testDbConnectionBtn")
      }
    }
  }

  async initializeProductsPage() {
    // Sayfa ilk açıldığında local ürünleri yükle
    await this.loadLocalProducts()
  }

  async loadLocalProducts() {
    try {
      const products = await window.electronAPI.getLocalProducts()
      this.displayProducts(products, "localProductsList")
    } catch (error) {
      console.error("Local products load error:", error)
      this.showError("Yerel ürünler yüklenemedi: " + error.message)
    }
  }

  async syncProducts() {
    try {
      const btn = document.getElementById("syncProductsBtn")
      const originalText = btn ? btn.textContent : ""

      if (btn) {
        btn.textContent = "Senkronize ediliyor..."
        btn.disabled = true
      } else {
        console.error("[v0] Element not found: syncProductsBtn")
      }

      const result = await window.electronAPI.syncProducts()

      if (result.success) {
        this.showSuccess(`${result.syncedCount} ürün senkronize edildi!`)
        await this.loadLocalProducts() // Local listeyi güncelle
      } else {
        this.showError("Ürün senkronizasyonu hatası: " + result.error)
      }
    } catch (error) {
      console.error("Product sync error:", error)
      this.showError("Ürün senkronizasyonu hatası: " + error.message)
    } finally {
      const btn = document.getElementById("syncProductsBtn")
      if (btn) {
        btn.textContent = "Ürünleri Senkronize Et"
        btn.disabled = false
      } else {
        console.error("[v0] Element not found: syncProductsBtn")
      }
    }
  }

  displayProducts(products, containerId) {
    const container = document.getElementById(containerId)

    if (container) {
      if (products.length === 0) {
        container.innerHTML = '<p class="empty-cart">Ürün bulunamadı.</p>'
        return
      }

      container.innerHTML = products
        .map(
          (product) => `
        <div class="product-card" onclick="posApp.showProductDetail(${product.id})">
          <img src="${product.image || "/diverse-products-still-life.png"}" 
               alt="${product.name}" class="product-image">
          <div class="product-info">
            <h4 class="product-name">${product.name}</h4>
            <p class="product-price">₺${product.price.toFixed(2)}</p>
            <p class="product-stock">Stok: ${product.stock} adet</p>
            <p class="product-barcode">${product.barcode}</p>
          </div>
          <button class="btn btn-primary btn-sm" 
                  onclick="event.stopPropagation(); posApp.quickAddToCart(${product.id})">
            <i class="fas fa-plus"></i> Sepete Ekle
          </button>
        </div>
      `,
        )
        .join("")
    } else {
      console.error(`[v0] Container element not found: ${containerId}`)
    }
  }

  async showProductDetail(productId) {
    try {
      const product = await window.electronAPI.getProductById(productId)

      if (!product) {
        this.showError("Ürün bulunamadı!")
        return
      }

      // Modal içeriğini doldur
      const modalProductImage = document.getElementById("modalProductImage")
      if (modalProductImage) {
        modalProductImage.src = product.image || "/diverse-products-still-life.png"
      } else {
        console.error("[v0] Element not found: modalProductImage")
      }

      const modalProductName = document.getElementById("modalProductName")
      if (modalProductName) {
        modalProductName.textContent = product.name
      } else {
        console.error("[v0] Element not found: modalProductName")
      }

      const modalProductPrice = document.getElementById("modalProductPrice")
      if (modalProductPrice) {
        modalProductPrice.textContent = `₺${product.price.toFixed(2)}`
      } else {
        console.error("[v0] Element not found: modalProductPrice")
      }

      const modalProductStock = document.getElementById("modalProductStock")
      if (modalProductStock) {
        modalProductStock.textContent = product.stock
      } else {
        console.error("[v0] Element not found: modalProductStock")
      }

      const modalProductBarcode = document.getElementById("modalProductBarcode")
      if (modalProductBarcode) {
        modalProductBarcode.textContent = product.barcode
      } else {
        console.error("[v0] Element not found: modalProductBarcode")
      }

      const modalProductDescription = document.getElementById("modalProductDescription")
      if (modalProductDescription) {
        modalProductDescription.textContent = product.description || "Açıklama bulunmuyor."
      } else {
        console.error("[v0] Element not found: modalProductDescription")
      }

      // Ürün ID'sini modal'a kaydet
      const productDetailModal = document.getElementById("productDetailModal")
      if (productDetailModal) {
        productDetailModal.dataset.productId = productId
      } else {
        console.error("[v0] Element not found: productDetailModal")
      }

      this.showModal("productDetailModal")
    } catch (error) {
      console.error("Product detail error:", error)
      this.showError("Ürün detayları yüklenemedi: " + error.message)
    }
  }

  async quickAddToCart(productId) {
    try {
      const product = await window.electronAPI.getProductById(productId)

      if (!product) {
        this.showError("Ürün bulunamadı!")
        return
      }

      if (product.stock <= 0) {
        this.showError("Ürün stokta yok!")
        return
      }

      // Sepette aynı ürün var mı kontrol et
      const existingItem = this.cart.find((item) => item.id === product.id)

      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          this.showError("Yetersiz stok!")
          return
        }
        existingItem.quantity += 1
        existingItem.total = existingItem.quantity * existingItem.price
      } else {
        this.cart.push({
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          total: product.price,
          barcode: product.barcode,
        })
      }

      this.updateCartDisplay()
      this.showSuccess("Ürün sepete eklendi!")

      // POS sayfasına geç
      this.showPage("posPage")
    } catch (error) {
      console.error("Quick add to cart error:", error)
      this.showError("Ürün sepete eklenemedi: " + error.message)
    }
  }

  async addProductToCartFromModal() {
    const productId = Number.parseInt(document.getElementById("productDetailModal").dataset.productId)
    const quantity = Number.parseInt(document.getElementById("modalQuantity").value) || 1

    try {
      const product = await window.electronAPI.getProductById(productId)

      if (!product) {
        this.showError("Ürün bulunamadı!")
        return
      }

      if (quantity > product.stock) {
        this.showError("Yetersiz stok!")
        return
      }

      // Sepette aynı ürün var mı kontrol et
      const existingItem = this.cart.find((item) => item.id === product.id)

      if (existingItem) {
        if (existingItem.quantity + quantity > product.stock) {
          this.showError("Yetersiz stok!")
          return
        }
        existingItem.quantity += quantity
        existingItem.total = existingItem.quantity * existingItem.price
      } else {
        this.cart.push({
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: quantity,
          total: product.price * quantity,
          barcode: product.barcode,
        })
      }

      this.updateCartDisplay()
      this.hideModal("productDetailModal")
      this.showSuccess("Ürün sepete eklendi!")

      // POS sayfasına geç
      this.showPage("posPage")
    } catch (error) {
      console.error("Add product to cart error:", error)
      this.showError("Ürün sepete eklenemedi: " + error.message)
    }
  }

  async runAllAPITests() {
    try {
      console.log("[v0] Starting comprehensive API tests...")

      const testResults = {
        database: { status: "pending", message: "", duration: 0 },
        woocommerce: { status: "pending", message: "", duration: 0 },
        subdomain: { status: "pending", message: "", duration: 0 },
        sync: { status: "pending", message: "", duration: 0 },
      }

      // Test sonuçlarını gösterecek modal oluştur
      this.showTestResultsModal(testResults)

      // Database test
      const dbStart = Date.now()
      try {
        const dbResult = await window.electronAPI.testDatabaseConnection()
        testResults.database = {
          status: dbResult.success ? "success" : "error",
          message: dbResult.success ? "Veritabanı bağlantısı başarılı" : dbResult.error,
          duration: Date.now() - dbStart,
        }
      } catch (error) {
        testResults.database = {
          status: "error",
          message: "Database test hatası: " + error.message,
          duration: Date.now() - dbStart,
        }
      }
      this.updateTestResult("database", testResults.database)

      // WooCommerce test
      const wooStart = Date.now()
      try {
        const wooResult = await window.electronAPI.testWooCommerceConnection()
        testResults.woocommerce = {
          status: wooResult.success ? "success" : "warning",
          message: wooResult.success ? "WooCommerce bağlantısı başarılı" : wooResult.error || "API yapılandırılmamış",
          duration: Date.now() - wooStart,
        }
      } catch (error) {
        testResults.woocommerce = {
          status: "error",
          message: "WooCommerce test hatası: " + error.message,
          duration: Date.now() - wooStart,
        }
      }
      this.updateTestResult("woocommerce", testResults.woocommerce)

      // Subdomain test
      const subdomainStart = Date.now()
      try {
        const subdomainResult = await window.electronAPI.testSubdomainConnection()
        testResults.subdomain = {
          status: subdomainResult.success ? "success" : "warning",
          message: subdomainResult.success
            ? "Subdomain bağlantısı başarılı"
            : subdomainResult.error || "Subdomain yapılandırılmamış",
          duration: Date.now() - subdomainStart,
        }
      } catch (error) {
        testResults.subdomain = {
          status: "error",
          message: "Subdomain test hatası: " + error.message,
          duration: Date.now() - subdomainStart,
        }
      }
      this.updateTestResult("subdomain", testResults.subdomain)

      // Sync status test
      const syncStart = Date.now()
      try {
        const syncResult = await window.electronAPI.getSyncStatus()
        testResults.sync = {
          status: "success",
          message: `Sync durumu: ${syncResult.isOnline ? "Online" : "Offline"}, Son sync: ${syncResult.lastSyncDate || "Hiç"}`,
          duration: Date.now() - syncStart,
        }
      } catch (error) {
        testResults.sync = {
          status: "error",
          message: "Sync test hatası: " + error.message,
          duration: Date.now() - syncStart,
        }
      }
      this.updateTestResult("sync", testResults.sync)

      console.log("[v0] API tests completed:", testResults)

      // Test özeti göster
      const successCount = Object.values(testResults).filter((r) => r.status === "success").length
      const totalTests = Object.keys(testResults).length

      if (successCount === totalTests) {
        this.showSuccess(`Tüm API testleri başarılı! (${successCount}/${totalTests})`)
      } else {
        this.showWarning(`API testleri tamamlandı: ${successCount}/${totalTests} başarılı`)
      }

      return testResults
    } catch (error) {
      console.error("[v0] API tests error:", error)
      this.showError("API testleri sırasında hata: " + error.message)
      return null
    }
  }

  showTestResultsModal(testResults) {
    // Test sonuçları modalını oluştur
    const modal = document.createElement("div")
    modal.className = "modal active"
    modal.id = "apiTestModal"

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>API Bağlantı Testleri</h3>
          <button class="modal-close" onclick="document.getElementById('apiTestModal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="test-results">
            <div class="test-item" id="test-database">
              <div class="test-icon"><i class="fas fa-database"></i></div>
              <div class="test-info">
                <div class="test-name">Veritabanı</div>
                <div class="test-status">Test ediliyor...</div>
              </div>
              <div class="test-result"><i class="fas fa-spinner spinning"></i></div>
            </div>
            <div class="test-item" id="test-woocommerce">
              <div class="test-icon"><i class="fab fa-wordpress"></i></div>
              <div class="test-info">
                <div class="test-name">WooCommerce API</div>
                <div class="test-status">Test ediliyor...</div>
              </div>
              <div class="test-result"><i class="fas fa-spinner spinning"></i></div>
            </div>
            <div class="test-item" id="test-subdomain">
              <div class="test-icon"><i class="fas fa-cloud"></i></div>
              <div class="test-info">
                <div class="test-name">Subdomain Database</div>
                <div class="test-status">Test ediliyor...</div>
              </div>
              <div class="test-result"><i class="fas fa-spinner spinning"></i></div>
            </div>
            <div class="test-item" id="test-sync">
              <div class="test-icon"><i class="fas fa-sync-alt"></i></div>
              <div class="test-info">
                <div class="test-name">Senkronizasyon</div>
                <div class="test-status">Test ediliyor...</div>
              </div>
              <div class="test-result"><i class="fas fa-spinner spinning"></i></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('apiTestModal').remove()">Kapat</button>
          <button class="btn btn-primary" onclick="posApp.runAllAPITests()">Testleri Tekrarla</button>
        </div>
      </div>
    `

    document.body.appendChild(modal)
  }

  updateTestResult(testType, result) {
    const testItem = document.getElementById(`test-${testType}`)
    if (!testItem) return

    const statusElement = testItem.querySelector(".test-status")
    const resultElement = testItem.querySelector(".test-result")

    statusElement.textContent = result.message

    let icon = ""
    let className = ""

    switch (result.status) {
      case "success":
        icon = '<i class="fas fa-check-circle text-success"></i>'
        className = "test-success"
        break
      case "warning":
        icon = '<i class="fas fa-exclamation-triangle text-warning"></i>'
        className = "test-warning"
        break
      case "error":
        icon = '<i class="fas fa-times-circle text-error"></i>'
        className = "test-error"
        break
      default:
        icon = '<i class="fas fa-spinner spinning"></i>'
        className = "test-pending"
    }

    resultElement.innerHTML = icon
    testItem.className = `test-item ${className}`

    // Duration göster
    if (result.duration) {
      statusElement.textContent += ` (${result.duration}ms)`
    }
  }

  async runStartupTests() {
    try {
      console.log("[v0] Running startup API tests...")

      // Sadece kritik testleri çalıştır
      const dbResult = await window.electronAPI.testDatabaseConnection()
      if (!dbResult.success) {
        this.showError("Kritik hata: Veritabanı bağlantısı başarısız - " + dbResult.error)
        return false
      }

      // WooCommerce ve Subdomain testleri opsiyonel (warning olarak göster)
      try {
        const wooResult = await window.electronAPI.checkWooCommerceConfig()
        if (wooResult.success && !wooResult.status.isComplete) {
          this.showWarning("WooCommerce API yapılandırması eksik")
        }
      } catch (error) {
        console.warn("[v0] WooCommerce config check failed:", error.message)
      }

      console.log("[v0] Startup tests completed successfully")
      return true
    } catch (error) {
      console.error("[v0] Startup tests failed:", error)
      this.showError("Başlangıç testleri başarısız: " + error.message)
      return false
    }
  }

  initializeTestButtons() {
    // API Test butonu
    const apiTestBtn = document.getElementById("runApiTestsBtn")
    if (apiTestBtn) {
      apiTestBtn.addEventListener("click", () => {
        this.runAllAPITests()
      })
    }

    // Startup test butonu
    const startupTestBtn = document.getElementById("runStartupTestsBtn")
    if (startupTestBtn) {
      startupTestBtn.addEventListener("click", () => {
        this.runStartupTests()
      })
    }
  }
}

let posApp
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    posApp = new POSApp()
    window.posApp = posApp
  })
} else {
  posApp = new POSApp()
  window.posApp = posApp
}
