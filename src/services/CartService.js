// Sepet yönetim servisi
class CartService {
  constructor() {
    this.items = []
    this.discounts = []
    this.customer = null
    this.subtotal = 0
    this.totalDiscount = 0
    this.taxAmount = 0
    this.total = 0
  }

  // Sepete ürün ekle
  addItem(product, quantity = 1) {
    try {
      // Stok kontrolü
      if (quantity > product.stock) {
        return {
          success: false,
          error: `Yetersiz stok! Mevcut: ${product.stock}`,
        }
      }

      // Sepette aynı ürün var mı kontrol et
      const existingItemIndex = this.items.findIndex((item) => item.id === product.id)

      if (existingItemIndex >= 0) {
        // Mevcut ürünün miktarını artır
        const existingItem = this.items[existingItemIndex]
        const newQuantity = existingItem.quantity + quantity

        if (newQuantity > product.stock) {
          return {
            success: false,
            error: `Yetersiz stok! Mevcut: ${product.stock}, Sepetteki: ${existingItem.quantity}`,
          }
        }

        existingItem.quantity = newQuantity
        existingItem.totalPrice = existingItem.unitPrice * newQuantity
        existingItem.taxAmount = existingItem.totalPrice * existingItem.taxRate
      } else {
        // Yeni ürün ekle
        const cartItem = {
          id: product.id,
          name: product.name,
          barcode: product.barcode,
          unitPrice: product.price,
          quantity: quantity,
          totalPrice: product.price * quantity,
          taxRate: product.tax_rate || 0.18,
          taxAmount: product.price * quantity * (product.tax_rate || 0.18),
          category: product.category,
          image: product.image,
          addedAt: new Date().toISOString(),
        }

        this.items.push(cartItem)
      }

      this.calculateTotals()

      return {
        success: true,
        item: this.items.find((item) => item.id === product.id),
        cartTotal: this.total,
      }
    } catch (error) {
      console.error("Add item error:", error)
      return {
        success: false,
        error: "Ürün eklenirken hata oluştu: " + error.message,
      }
    }
  }

  // Sepetten ürün çıkar
  removeItem(productId) {
    try {
      const itemIndex = this.items.findIndex((item) => item.id === productId)

      if (itemIndex === -1) {
        return {
          success: false,
          error: "Ürün sepette bulunamadı",
        }
      }

      this.items.splice(itemIndex, 1)
      this.calculateTotals()

      return {
        success: true,
        cartTotal: this.total,
      }
    } catch (error) {
      console.error("Remove item error:", error)
      return {
        success: false,
        error: "Ürün çıkarılırken hata oluştu: " + error.message,
      }
    }
  }

  // Ürün miktarını güncelle
  updateQuantity(productId, newQuantity) {
    try {
      if (newQuantity <= 0) {
        return this.removeItem(productId)
      }

      const item = this.items.find((item) => item.id === productId)

      if (!item) {
        return {
          success: false,
          error: "Ürün sepette bulunamadı",
        }
      }

      item.quantity = newQuantity
      item.totalPrice = item.unitPrice * newQuantity
      item.taxAmount = item.totalPrice * item.taxRate

      this.calculateTotals()

      return {
        success: true,
        item: item,
        cartTotal: this.total,
      }
    } catch (error) {
      console.error("Update quantity error:", error)
      return {
        success: false,
        error: "Miktar güncellenirken hata oluştu: " + error.message,
      }
    }
  }

  // İndirim ekle
  addDiscount(discountData) {
    try {
      const discount = {
        id: Date.now(),
        type: discountData.type, // 'percentage', 'amount', 'item'
        value: discountData.value,
        description: discountData.description || "İndirim",
        appliedTo: discountData.appliedTo || "total", // 'total', 'item', 'category'
        targetId: discountData.targetId || null,
        createdAt: new Date().toISOString(),
      }

      // İndirim doğrulama
      if (discount.type === "percentage" && (discount.value < 0 || discount.value > 100)) {
        return {
          success: false,
          error: "İndirim yüzdesi 0-100 arasında olmalıdır",
        }
      }

      if (discount.type === "amount" && discount.value < 0) {
        return {
          success: false,
          error: "İndirim miktarı negatif olamaz",
        }
      }

      this.discounts.push(discount)
      this.calculateTotals()

      return {
        success: true,
        discount: discount,
        cartTotal: this.total,
      }
    } catch (error) {
      console.error("Add discount error:", error)
      return {
        success: false,
        error: "İndirim eklenirken hata oluştu: " + error.message,
      }
    }
  }

  // İndirim kaldır
  removeDiscount(discountId) {
    try {
      const discountIndex = this.discounts.findIndex((discount) => discount.id === discountId)

      if (discountIndex === -1) {
        return {
          success: false,
          error: "İndirim bulunamadı",
        }
      }

      this.discounts.splice(discountIndex, 1)
      this.calculateTotals()

      return {
        success: true,
        cartTotal: this.total,
      }
    } catch (error) {
      console.error("Remove discount error:", error)
      return {
        success: false,
        error: "İndirim kaldırılırken hata oluştu: " + error.message,
      }
    }
  }

  // Müşteri bilgisi ekle
  setCustomer(customerData) {
    this.customer = {
      name: customerData.name || null,
      phone: customerData.phone || null,
      email: customerData.email || null,
      address: customerData.address || null,
      taxNumber: customerData.taxNumber || null,
    }

    return {
      success: true,
      customer: this.customer,
    }
  }

  // Toplamları hesapla
  calculateTotals() {
    // Ara toplam
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0)

    // Vergi tutarı
    this.taxAmount = this.items.reduce((sum, item) => sum + item.taxAmount, 0)

    // İndirim hesapla
    this.totalDiscount = 0

    this.discounts.forEach((discount) => {
      let discountAmount = 0

      if (discount.appliedTo === "total") {
        if (discount.type === "percentage") {
          discountAmount = (this.subtotal * discount.value) / 100
        } else if (discount.type === "amount") {
          discountAmount = discount.value
        }
      } else if (discount.appliedTo === "item" && discount.targetId) {
        const item = this.items.find((item) => item.id === discount.targetId)
        if (item) {
          if (discount.type === "percentage") {
            discountAmount = (item.totalPrice * discount.value) / 100
          } else if (discount.type === "amount") {
            discountAmount = Math.min(discount.value, item.totalPrice)
          }
        }
      }

      this.totalDiscount += discountAmount
    })

    // Toplam
    this.total = Math.max(0, this.subtotal - this.totalDiscount)
  }

  // Sepeti temizle
  clear() {
    this.items = []
    this.discounts = []
    this.customer = null
    this.subtotal = 0
    this.totalDiscount = 0
    this.taxAmount = 0
    this.total = 0
  }

  // Sepet durumunu al
  getState() {
    return {
      items: this.items,
      discounts: this.discounts,
      customer: this.customer,
      subtotal: this.subtotal,
      totalDiscount: this.totalDiscount,
      taxAmount: this.taxAmount,
      total: this.total,
      itemCount: this.items.reduce((sum, item) => sum + item.quantity, 0),
    }
  }

  // Sepet boş mu?
  isEmpty() {
    return this.items.length === 0
  }

  // Satış verisi formatla
  formatForSale() {
    return {
      items: this.items.map((item) => ({
        id: item.id,
        name: item.name,
        barcode: item.barcode,
        quantity: item.quantity,
        price: item.unitPrice,
        total: item.totalPrice,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
      })),
      subtotal: this.subtotal,
      discount: this.totalDiscount,
      taxAmount: this.taxAmount,
      total: this.total,
      customer: this.customer,
      discounts: this.discounts,
    }
  }
}

module.exports = CartService
