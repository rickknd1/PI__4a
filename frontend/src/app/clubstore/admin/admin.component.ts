import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Product, Order } from '../services/api.service';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-store-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
})
export class StoreAdminComponent implements OnInit {
  products: Product[] = [];
  loadingProducts = true;
  editingProduct: Product | null = null;

  newProduct: any = {
    clubId: '',
    name: '',
    description: '',
    productType: 'JERSEY',
    price: 0,
    stockQuantity: 0,
    isAvailable: true,
    imageUrl: '',
  };

  eventName = '';
  eventDate = '';
  venue = 'Stade';
  membershipDurationMonths = 12;
  membershipLevel = 'BRONZE';
  size = 'M';
  color = 'Blanc';

  imagePreview: string | null = null;
  editImagePreview: string | null = null;
  imageInputMethod: 'url' | 'file' = 'url';
  editImageInputMethod: 'url' | 'file' = 'url';

  orders: Order[] = [];
  loadingOrders = true;
  selectedStatus: { [key: string]: string } = {};
  activeTab: 'products' | 'orders' = 'products';

  selectedFile: File | null = null;
  importingPdf = false;

  isAdmin = false;

  constructor(private apiService: ApiService, private auth: AuthService) {}

  ngOnInit() {
    const u = this.auth.getCurrentUser() as any;
    const role = (u?.role || '').toUpperCase();
    this.isAdmin = ['PRESIDENT', 'VICE_PRESIDENT', 'COMMITTEE_MEMBER', 'TRESORIER', 'SECRETAIRE_GENERALE'].includes(role);
    this.newProduct.clubId = u?.clubId || 'CLUB001';
    this.loadProducts();
  }

  loadProducts() {
    this.loadingProducts = true;
    this.apiService.getAllProducts().subscribe({
      next: data => {
        this.products = data || [];
        this.loadingProducts = false;
      },
      error: err => {
        console.error(err);
        this.loadingProducts = false;
      },
    });
  }

  loadOrders() {
    this.loadingOrders = true;
    this.apiService.getAllOrders().subscribe({
      next: data => {
        this.orders = data || [];
        this.loadingOrders = false;
        this.orders.forEach(o => { if (o.id) this.selectedStatus[o.id] = o.status; });
      },
      error: () => {
        this.loadingOrders = false;
        this.orders = [];
      },
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'bg-yellow-200 text-yellow-800';
      case 'CONFIRMED': return 'bg-blue-200 text-blue-800';
      case 'SHIPPED': return 'bg-purple-200 text-purple-800';
      case 'DELIVERED': return 'bg-green-200 text-green-800';
      case 'CANCELLED': return 'bg-red-200 text-red-800';
      default: return 'bg-gray-200 text-gray-800';
    }
  }

  updateOrderStatus(orderId: string, status: string) {
    if (!status) return;
    this.apiService.updateOrderStatus(orderId, status).subscribe({
      next: () => {
        alert('✅ Statut mis à jour');
        this.loadOrders();
      },
      error: () => alert('❌ Erreur mise à jour'),
    });
  }

  onProductTypeChange() {
    this.eventName = '';
    this.eventDate = '';
    this.venue = 'Stade';
    this.membershipDurationMonths = 12;
    this.membershipLevel = 'BRONZE';
    this.size = 'M';
    this.color = 'Blanc';
  }

  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
        this.newProduct.imageUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  onImageUrlChange(url: string) {
    if (url?.trim()) {
      this.imagePreview = url;
      this.newProduct.imageUrl = url;
    } else {
      this.imagePreview = null;
      this.newProduct.imageUrl = '';
    }
  }

  onEditImageSelected(event: any) {
    const file = event.target.files[0];
    if (file && this.editingProduct) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.editImagePreview = e.target.result;
        if (this.editingProduct) this.editingProduct.imageUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  onEditImageUrlChange(url: string) {
    if (this.editingProduct) {
      if (url?.trim()) {
        this.editImagePreview = url;
        this.editingProduct.imageUrl = url;
      } else {
        this.editImagePreview = null;
        this.editingProduct.imageUrl = '';
      }
    }
  }

  clearImage() {
    this.imagePreview = null;
    this.newProduct.imageUrl = '';
  }

  resetForm() {
    this.newProduct = {
      clubId: this.newProduct.clubId,
      name: '',
      description: '',
      productType: 'JERSEY',
      price: 0,
      stockQuantity: 0,
      isAvailable: true,
      imageUrl: '',
    };
    this.eventName = '';
    this.eventDate = '';
    this.venue = 'Stade';
    this.membershipDurationMonths = 12;
    this.membershipLevel = 'BRONZE';
    this.size = 'M';
    this.color = 'Blanc';
    this.clearImage();
  }

  createProduct() {
    if (!this.newProduct.name?.trim()) { alert('Le nom du produit est requis'); return; }
    if (this.newProduct.price <= 0) { alert('Le prix doit être supérieur à 0'); return; }
    if (this.newProduct.stockQuantity < 0) { alert('Le stock ne peut pas être négatif'); return; }

    const productToSend: any = {
      clubId: this.newProduct.clubId || 'CLUB001',
      name: this.newProduct.name.trim(),
      description: this.newProduct.description?.trim() || '',
      productType: this.newProduct.productType,
      price: Number(this.newProduct.price),
      stockQuantity: Number(this.newProduct.stockQuantity),
      isAvailable: this.newProduct.isAvailable,
      eventName: 'General',
    };

    if (this.newProduct.imageUrl?.trim()) productToSend.imageUrl = this.newProduct.imageUrl;

    if (['TSHIRT', 'JERSEY', 'HAT', 'SCARF', 'ACCESSORY'].includes(this.newProduct.productType)) {
      productToSend.size = this.size;
      productToSend.color = this.color;
    }
    if (this.newProduct.productType === 'CERTIFICATE') {
      productToSend.membershipDurationMonths = this.membershipDurationMonths;
      productToSend.membershipLevel = this.membershipLevel;
    }
    if (this.newProduct.productType === 'EVENT_TICKET') {
      productToSend.eventName = this.eventName?.trim() || this.newProduct.name.trim();
      productToSend.eventDate = this.eventDate || new Date().toISOString();
      productToSend.venue = this.venue || 'Stade';
      productToSend.totalTickets = this.newProduct.stockQuantity;
      productToSend.availableTickets = this.newProduct.stockQuantity;
    }

    this.apiService.createProduct(productToSend).subscribe({
      next: () => {
        alert(`✅ Produit "${this.newProduct.name}" créé`);
        this.loadProducts();
        this.resetForm();
      },
      error: err => {
        console.error('Full error:', err);
        let msg = 'Erreur création';
        if (err.error?.message) msg = err.error.message;
        else if (err.error?.errors) msg = err.error.errors.map((e: any) => e.defaultMessage).join(', ');
        alert(`❌ ${msg}`);
      },
    });
  }

  startEdit(product: Product) {
    this.editingProduct = { ...product };
    this.editImagePreview = product.imageUrl || null;
    this.editImageInputMethod = 'url';
  }

  cancelEdit() {
    this.editingProduct = null;
    this.editImagePreview = null;
  }

  updateProduct() {
    if (!this.editingProduct) return;
    if (!this.editingProduct.name?.trim()) { alert('Nom requis'); return; }
    if (this.editingProduct.price <= 0) { alert('Prix > 0'); return; }

    const toUpdate: any = {
      clubId: this.editingProduct.clubId || 'CLUB001',
      name: this.editingProduct.name.trim(),
      description: this.editingProduct.description?.trim() || '',
      productType: this.editingProduct.productType,
      price: Number(this.editingProduct.price),
      stockQuantity: Number(this.editingProduct.stockQuantity),
      isAvailable: this.editingProduct.isAvailable,
      imageUrl: this.editingProduct.imageUrl || '',
    };

    this.apiService.updateProduct(this.editingProduct.id, toUpdate).subscribe({
      next: () => {
        alert('✅ Produit modifié');
        this.loadProducts();
        this.editingProduct = null;
        this.editImagePreview = null;
      },
      error: () => alert('Erreur modification'),
    });
  }

  deleteProduct(id: string) {
    if (confirm('Supprimer ce produit ?')) {
      this.apiService.deleteProduct(id).subscribe({
        next: () => {
          alert('✅ Supprimé');
          this.loadProducts();
        },
        error: () => alert('Erreur suppression'),
      });
    }
  }

  getProductTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      JERSEY: 'Maillot', TSHIRT: 'T-Shirt', HAT: 'Casquette',
      SCARF: 'Écharpe', ACCESSORY: 'Accessoire', EVENT_TICKET: 'Billet Événement',
      CERTIFICATE: 'Certificat',
    };
    return labels[type] || type;
  }

  switchTab(tab: 'products' | 'orders') {
    this.activeTab = tab;
    if (tab === 'orders') this.loadOrders();
  }

  onFileSelected(event: any) { this.selectedFile = event.target.files[0]; }

  importFromPdf() {
    if (!this.selectedFile) return;
    this.importingPdf = true;
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('type', this.activeTab === 'products' ? 'PRODUCT' : 'TICKET');

    this.apiService.extractFromPdf(formData).subscribe({
      next: data => {
        this.importingPdf = false;
        if (this.activeTab === 'products') {
          this.newProduct.name = data['name'] || '';
          this.newProduct.price = data['price'] || 0;
          let productType = data['productType'] || 'JERSEY';
          if (productType === 'EVENT_TICKET') productType = 'ACCESSORY';
          this.newProduct.productType = productType;
          this.size = data['size'] || 'M';
          this.color = data['color'] || 'Blanc';
          this.newProduct.stockQuantity = data['stockQuantity'] || 0;
          this.newProduct.description = data['description'] || '';
          this.newProduct.isAvailable = true;
          this.newProduct.imageUrl = data['imageUrl'] || '';
          this.onImageUrlChange(this.newProduct.imageUrl);
        } else {
          this.newProduct.name = data['name'] || '';
          this.newProduct.price = data['price'] || 0;
          this.newProduct.productType = 'EVENT_TICKET';
          this.eventName = data['eventName'] || '';
          this.eventDate = data['eventDate'] || '';
          this.venue = data['venue'] || '';
          this.newProduct.stockQuantity = data['availableTickets'] || 0;
          this.newProduct.description = data['description'] || '';
          this.newProduct.isAvailable = true;
          this.newProduct.imageUrl = data['imageUrl'] || '';
          this.onImageUrlChange(this.newProduct.imageUrl);
        }
        alert('✅ Formulaire rempli automatiquement par l\'IA !');
      },
      error: err => {
        this.importingPdf = false;
        console.error('Erreur IA:', err);
        alert('❌ Erreur lors de l\'extraction. Vérifiez la clé API Groq côté serveur.');
      },
    });
  }
}
