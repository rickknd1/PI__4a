import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, Product } from '../services/api.service';
import { CartService } from '../services/cart.service';
import { RecentlyViewedService } from '../services/recently-viewed.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products.component.html',
})
export class ProductsComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  loading = true;
  selectedType = 'ALL';
  searchTerm = '';

  productTypes = [
    { value: 'ALL', label: 'Tous' },
    { value: 'JERSEY', label: 'Maillots' },
    { value: 'TSHIRT', label: 'T-Shirts' },
    { value: 'HAT', label: 'Casquettes' },
    { value: 'SCARF', label: 'Écharpes' },
    { value: 'ACCESSORY', label: 'Accessoires' },
    { value: 'CERTIFICATE', label: 'Certificats' },
  ];

  constructor(
    private apiService: ApiService,
    private cartService: CartService,
    private router: Router,
    private recentlyViewed: RecentlyViewedService,
  ) {}

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.loading = true;
    this.apiService.getAllProducts().subscribe({
      next: data => {
        this.products = (data || []).filter(p => p.productType !== 'EVENT_TICKET');
        this.applyFilters();
        this.loading = false;
      },
      error: err => {
        console.error('Erreur chargement:', err);
        this.loading = false;
      },
    });
  }

  applyFilters() {
    let filtered = [...this.products];
    if (this.selectedType !== 'ALL') filtered = filtered.filter(p => p.productType === this.selectedType);
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.description && p.description.toLowerCase().includes(term)),
      );
    }
    filtered = filtered.filter(p => p.isAvailable);
    this.filteredProducts = filtered;
  }

  onTypeChange() { this.applyFilters(); }
  onSearchChange() { this.applyFilters(); }

  addToCart(product: Product) {
    this.cartService.addToCart(product, 1);
    alert(`✅ ${product.name} ajouté au panier`);
  }

  buyNow(product: Product) {
    this.cartService.addToCart(product, 1);
    this.router.navigate(['/cart']);
  }

  viewProduct(product: Product) {
    this.recentlyViewed.addProduct(product);
    this.router.navigate(['/products', product.id]);
  }

  getProductTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      JERSEY: 'Maillot', TSHIRT: 'T-Shirt', HAT: 'Casquette',
      SCARF: 'Écharpe', ACCESSORY: 'Accessoire', CERTIFICATE: 'Certificat',
    };
    return labels[type] || type;
  }

  getStockStatus(stock: number): string {
    if (stock <= 0) return 'Rupture de stock';
    if (stock < 10) return `Plus que ${stock}`;
    return 'En stock';
  }

  getStockStatusClass(stock: number): string {
    if (stock <= 0) return 'text-red-600';
    if (stock < 10) return 'text-orange-500';
    return 'text-green-600';
  }
}
