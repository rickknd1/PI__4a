import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService, Product } from '../services/api.service';
import { CartService } from '../services/cart.service';
import { RecentlyViewedService } from '../services/recently-viewed.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './product-detail.component.html',
})
export class ProductDetailComponent implements OnInit {
  product: Product | null = null;
  loading = true;
  recommendations: Product[] = [];
  certificateName: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private cartService: CartService,
    private recentlyViewed: RecentlyViewedService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loading = true;
        this.apiService.getProductById(id).subscribe({
          next: (product: Product) => {
            this.product = product;
            this.recentlyViewed.addProduct(product);
            this.loading = false;
            this.loadRecommendations(product.id);
          },
          error: () => (this.loading = false),
        });
      } else {
        this.loading = false;
      }
    });
  }

  loadRecommendations(productId: string) {
    this.apiService.getProductRecommendations(productId).subscribe({
      next: (data: Product[]) => (this.recommendations = data || []),
      error: (err: any) => console.error('Recommendations error:', err),
    });
  }

  viewProduct(product: Product) {
    this.router.navigate(['/products', product.id]);
  }

  addToCart() {
    if (this.product) {
      this.cartService.addToCart(this.product, 1);
      alert(`✅ ${this.product.name} ajouté au panier`);
    }
  }

  buyNow() {
    if (this.product) {
      this.cartService.addToCart(this.product, 1);
      this.router.navigate(['/cart']);
    }
  }

  goBack() {
    if (this.product?.productType === 'EVENT_TICKET') this.router.navigate(['/tickets']);
    else this.router.navigate(['/products']);
  }

  getProductTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      JERSEY: 'Maillot', TSHIRT: 'T-Shirt', HAT: 'Casquette',
      SCARF: 'Écharpe', ACCESSORY: 'Accessoire', CERTIFICATE: 'Certificat',
      EVENT_TICKET: 'Billet Événement',
    };
    return labels[type] || type;
  }

  getMapUrl(venue: string | undefined): SafeResourceUrl {
    const url = venue ? `https://www.google.com/maps?q=${encodeURIComponent(venue)}&output=embed` : '';
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  /**
   * Generate a personalized certificate as a printable HTML window.
   * Uses native browser print (no jsPDF/html2canvas dep needed).
   */
  generateCertificate() {
    if (!this.certificateName.trim()) {
      alert('Veuillez entrer votre nom');
      return;
    }
    const clubName = this.product?.clubName || this.product?.name || 'Notre Club';
    const objet = this.product?.name || '';
    const date = new Date().toLocaleDateString('fr-FR');
    const year = new Date().getFullYear();
    const safe = (s: string) => s.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Certificat ${safe(this.certificateName)}</title>
      <style>
        @page { size: A4 landscape; margin: 0; }
        body { margin: 0; font-family: Georgia, "Times New Roman", serif; }
        .cert { background: linear-gradient(135deg, #fff8e7 0%, #fff 100%); border: 2px solid #fbbf24; border-radius: 24px; padding: 40px; margin: 20px; }
        h1 { font-size: 42px; color: #1e3a8a; margin: 10px 0 0; text-align: center; }
        .name { font-size: 48px; font-weight: bold; color: #b45309; margin: 20px 0; border-bottom: 2px dashed #fbbf24; display: inline-block; padding-bottom: 10px; }
        .objet { background: #fef3c7; border-radius: 16px; padding: 20px; margin: 30px 0; text-align: center; }
        .footer { display: flex; justify-content: space-between; margin-top: 50px; }
        .footer div { width: 45%; text-align: center; border-top: 1px solid #333; padding-top: 10px; font-size: 14px; }
        .club { font-size: 14px; letter-spacing: 4px; color: #b45309; text-align: center; }
        @media print { .noprint { display: none; } }
      </style></head><body>
      <div class="cert">
        <div style="text-align:center"><div style="font-size:48px">🏆</div>
        <div class="club">${safe(clubName).toUpperCase()}</div>
        <h1>CERTIFICAT DE MEMBRE</h1></div>
        <div style="text-align:center; margin: 40px 0;">
          <p style="font-size:18px">Ce certificat est décerné à</p>
          <p class="name">${safe(this.certificateName)}</p>
          <p style="font-size:18px">pour son engagement et son soutien au sein de notre club.</p>
        </div>
        <div class="objet">
          <p style="font-size:14px; color:#92400e; text-transform:uppercase">Objet</p>
          <p style="font-size:24px; font-weight:bold; color:#1e3a8a">${safe(objet)}</p>
          <p style="font-size:14px; color:#92400e">Délivré le ${date}</p>
        </div>
        <div class="footer">
          <div>Le Président du Club</div>
          <div>Cachet officiel</div>
        </div>
        <div style="margin-top:40px; text-align:center; font-size:12px; color:#9ca3af">
          ${safe(clubName)} – Fier membre depuis ${year}
        </div>
      </div>
      <div class="noprint" style="text-align:center; margin:20px;">
        <button onclick="window.print()" style="padding:10px 20px; background:#1e3a8a; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer">Imprimer / Sauvegarder en PDF</button>
      </div>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }
}
