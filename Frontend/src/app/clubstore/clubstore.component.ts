// =============================================================================
// CLUBSTORE COMPONENT — page boutique merchandising integree dans v1.3
// =============================================================================
// Composant standalone qui affiche le catalogue produits + un mini-panier
// in-memory + soumission de commande. C'est une version lecture / commande
// simple — on n'a PAS reimporte tout le projet cstore-frontend (incompatible
// niveau dependances Tailwind/themes), on a extrait juste l'essentiel pour
// avoir une integration visible a la demo.
//
// ROUTES :  /boutique  (sidebar front-office, icone sac)
// API    :  Gateway (8084) -> store-service (8087)
// =============================================================================

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ClubstoreService,
  StoreOrderRequest,
  StoreProduct,
} from './clubstore.service';

interface CartLine {
  product: StoreProduct;
  quantity: number;
}

@Component({
  selector: 'app-clubstore',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 space-y-6">
      <!-- HEADER -->
      <div class="flex items-center justify-between">
        <div>
          <h1
            class="text-2xl font-semibold text-gray-800 dark:text-white/90"
          >
            Boutique du club
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Merchandising officiel · paiement à la livraison · TND
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button
            (click)="loadProducts()"
            class="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            Actualiser
          </button>
          <button
            (click)="openMyOrders()"
            class="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
          >
            Mes commandes
          </button>
          <button *ngIf="isAdmin"
            (click)="openAdmin()"
            class="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition"
          >
            Admin
          </button>
          <div
            class="relative px-4 py-2 text-sm bg-brand-500 text-white rounded-lg cursor-pointer"
            (click)="showCart = !showCart"
          >
            Panier ({{ cart.length }})
          </div>
        </div>
      </div>

      <!-- LOADING / ERROR -->
      <div
        *ngIf="loading"
        class="bg-white dark:bg-gray-800 rounded-xl p-8 text-center text-gray-500"
      >
        Chargement du catalogue...
      </div>

      <div
        *ngIf="!loading && products.length === 0"
        class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6"
      >
        <p class="text-amber-800 dark:text-amber-200 font-medium">
          Aucun produit en boutique pour l'instant.
        </p>
        <p class="text-sm text-amber-700 dark:text-amber-300 mt-1">
          Le catalogue est vide ou le service store-service (port 8087) n'est
          pas démarré. Vérifie Eureka et le Gateway.
        </p>
      </div>

      <!-- CATALOG GRID -->
      <div
        *ngIf="!loading && products.length > 0"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
      >
        <div
          *ngFor="let p of products"
          class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition"
        >
          <div
            class="h-40 bg-gradient-to-br from-brand-100 to-brand-300 dark:from-brand-900/30 dark:to-brand-800/40 flex items-center justify-center text-4xl"
          >
            {{ iconFor(p.productType) }}
          </div>
          <div class="p-4 space-y-2">
            <div class="flex items-start justify-between gap-2">
              <h3
                class="font-semibold text-gray-800 dark:text-white/90 line-clamp-1"
              >
                {{ p.name }}
              </h3>
              <span
                class="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 shrink-0"
              >
                {{ p.productType }}
              </span>
            </div>
            <p
              class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[2rem]"
            >
              {{ p.description || 'Aucune description.' }}
            </p>
            <div class="flex items-center justify-between pt-2">
              <span
                class="text-lg font-bold text-brand-600 dark:text-brand-400"
              >
                {{ p.price }} TND
              </span>
              <span
                class="text-xs"
                [class.text-emerald-600]="p.stockQuantity > 0"
                [class.text-red-500]="p.stockQuantity === 0"
              >
                {{ p.stockQuantity > 0 ? 'En stock (' + p.stockQuantity + ')' : 'Rupture' }}
              </span>
            </div>
            <button
              (click)="addToCart(p)"
              [disabled]="p.stockQuantity === 0"
              class="w-full mt-2 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition"
            >
              Ajouter au panier
            </button>
          </div>
        </div>
      </div>

      <!-- CART MODAL -->
      <div
        *ngIf="showCart"
        class="fixed inset-0 bg-black/40 z-[999] flex items-center justify-center p-4"
        (click)="showCart = false"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
          (click)="$event.stopPropagation()"
        >
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-xl font-semibold text-gray-800 dark:text-white/90">
              Mon panier
            </h2>
          </div>
          <div class="p-6 space-y-3" *ngIf="cart.length > 0; else emptyCart">
            <div
              *ngFor="let line of cart; let i = index"
              class="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3"
            >
              <div>
                <div class="font-medium text-gray-800 dark:text-white/90">
                  {{ line.product.name }}
                </div>
                <div class="text-sm text-gray-500">
                  {{ line.product.price }} TND × {{ line.quantity }}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  [(ngModel)]="line.quantity"
                  class="w-16 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
                <button
                  (click)="removeLine(i)"
                  class="text-red-500 text-sm hover:underline"
                >
                  Retirer
                </button>
              </div>
            </div>

            <!-- ORDER FORM -->
            <div class="pt-4 space-y-3">
              <input
                [(ngModel)]="shippingAddress"
                placeholder="Adresse de livraison"
                class="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
              />
              <select
                [(ngModel)]="paymentMethod"
                class="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
              >
                <option value="CASH_ON_DELIVERY">Paiement à la livraison</option>
                <option value="BANK_TRANSFER">Virement bancaire</option>
                <option value="ESPECES">Espèces (paiement en personne)</option>
              </select>
              <p class="text-[11px] text-gray-500 dark:text-gray-400">
                Le paiement en ligne par carte bancaire n'est pas encore disponible
                sur la boutique. Choisis livraison ou virement.
              </p>
            </div>

            <div
              class="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700"
            >
              <span class="text-lg font-bold text-gray-800 dark:text-white/90">
                Total : {{ total() }} TND
              </span>
              <button
                (click)="checkout()"
                [disabled]="placingOrder || !shippingAddress"
                class="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white rounded-lg transition"
              >
                {{ placingOrder ? 'Envoi...' : 'Commander' }}
              </button>
            </div>
            <div *ngIf="orderMessage" class="text-sm pt-2"
                 [class.text-emerald-600]="orderOk"
                 [class.text-red-500]="!orderOk">
              {{ orderMessage }}
            </div>
          </div>
          <ng-template #emptyCart>
            <div class="p-8 text-center text-gray-500">
              Ton panier est vide. Ajoute des produits depuis le catalogue.
            </div>
          </ng-template>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- ADMIN BOUTIQUE (modal) — CRUD produits + gestion orders       -->
      <!-- ============================================================ -->
      <div *ngIf="showAdmin" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
           (click)="showAdmin = false">
        <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6"
             (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold dark:text-white">⚙️ Admin Boutique</h3>
            <button (click)="showAdmin = false"
                    class="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
          </div>

          <!-- Onglets -->
          <div class="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
            <button (click)="adminTab = 'products'"
                    [class.border-b-2]="adminTab === 'products'"
                    [class.border-amber-500]="adminTab === 'products'"
                    [class.text-amber-600]="adminTab === 'products'"
                    class="px-4 py-2 text-sm font-medium dark:text-gray-300">
              Produits ({{ products.length }})
            </button>
            <button (click)="adminTab = 'orders'; loadAllOrders()"
                    [class.border-b-2]="adminTab === 'orders'"
                    [class.border-amber-500]="adminTab === 'orders'"
                    [class.text-amber-600]="adminTab === 'orders'"
                    class="px-4 py-2 text-sm font-medium dark:text-gray-300">
              Commandes ({{ allOrders.length }})
            </button>
          </div>

          <!-- ===== PRODUITS TAB ===== -->
          <div *ngIf="adminTab === 'products'">
            <h4 class="font-semibold mb-2 dark:text-white">{{ editingProduct?.id ? 'Modifier' : 'Ajouter' }} un produit</h4>
            <form (submit)="saveProduct(); $event.preventDefault()" class="grid grid-cols-2 gap-3 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <input [(ngModel)]="productForm.name" name="name" placeholder="Nom *" required
                     class="border rounded-lg p-2 text-sm dark:bg-gray-900 dark:text-white"/>
              <input [(ngModel)]="productForm.price" name="price" type="number" step="0.01" min="0" placeholder="Prix TND *" required
                     class="border rounded-lg p-2 text-sm dark:bg-gray-900 dark:text-white"/>
              <input [(ngModel)]="productForm.description" name="description" placeholder="Description"
                     class="border rounded-lg p-2 text-sm dark:bg-gray-900 dark:text-white col-span-2"/>
              <select [(ngModel)]="productForm.productType" name="productType" required
                      class="border rounded-lg p-2 text-sm dark:bg-gray-900 dark:text-white">
                <option value="TSHIRT">TSHIRT</option>
                <option value="SWEATSHIRT">SWEATSHIRT</option>
                <option value="HAT">HAT</option>
                <option value="ACCESSORY">ACCESSORY</option>
                <option value="TICKET">TICKET</option>
                <option value="MEMBERSHIP">MEMBERSHIP</option>
              </select>
              <input [(ngModel)]="productForm.stockQuantity" name="stockQuantity" type="number" min="0" placeholder="Stock *" required
                     class="border rounded-lg p-2 text-sm dark:bg-gray-900 dark:text-white"/>
              <div class="col-span-2 flex gap-2">
                <button type="submit" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">
                  {{ editingProduct?.id ? 'Mettre à jour' : 'Ajouter' }}
                </button>
                <button type="button" (click)="resetProductForm()" class="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-lg text-sm dark:text-white">
                  Annuler
                </button>
              </div>
            </form>

            <h4 class="font-semibold mb-2 dark:text-white">Catalogue</h4>
            <div class="space-y-2">
              <div *ngFor="let p of products" class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div>
                  <strong class="dark:text-white">{{ p.name }}</strong>
                  <span class="ml-2 text-xs text-gray-500">{{ p.productType }} · {{ p.price }} TND · stock {{ p.stockQuantity }}</span>
                </div>
                <div class="flex gap-2">
                  <button (click)="editProduct(p)" class="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded text-sm">✏️ Éditer</button>
                  <button (click)="deleteProduct(p)" class="text-red-600 hover:bg-red-50 px-3 py-1 rounded text-sm">🗑️ Supprimer</button>
                </div>
              </div>
            </div>
          </div>

          <!-- ===== ORDERS TAB ===== -->
          <div *ngIf="adminTab === 'orders'">
            <div *ngIf="loadingAllOrders" class="text-center text-gray-500 py-6">Chargement...</div>
            <div *ngIf="!loadingAllOrders && allOrders.length === 0" class="text-center text-gray-500 py-6">Aucune commande.</div>
            <div *ngIf="!loadingAllOrders && allOrders.length > 0" class="space-y-2">
              <div *ngFor="let o of allOrders" class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div class="flex items-center justify-between mb-2">
                  <div>
                    <strong class="dark:text-white">#{{ o.orderNumber }}</strong>
                    <span class="ml-2 text-xs text-gray-500">{{ o.memberId }} · {{ o.totalAmount }} TND</span>
                  </div>
                  <select [ngModel]="o.status" (ngModelChange)="changeOrderStatus(o, $event)"
                          class="border rounded-lg p-1 text-sm dark:bg-gray-900 dark:text-white">
                    <option value="PENDING">PENDING</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="SHIPPED">SHIPPED</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
                <div class="text-sm dark:text-gray-300">
                  <span *ngFor="let it of o.items; let last = last">{{ it.quantity }}× {{ it.productName }}<span *ngIf="!last">, </span></span>
                </div>
                <div *ngIf="o.shippingAddress" class="text-xs text-gray-500 mt-1">
                  📍 {{ o.shippingAddress }} · 💳 {{ paymentLabel(o.paymentMethod) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- MES COMMANDES (modal) — historique des orders du user         -->
      <!-- ============================================================ -->
      <div *ngIf="showMyOrders" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
           (click)="showMyOrders = false">
        <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6"
             (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold dark:text-white">📦 Mes commandes</h3>
            <button (click)="showMyOrders = false"
                    class="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
          </div>

          <div *ngIf="loadingOrders" class="text-center text-gray-500 py-6">Chargement...</div>

          <div *ngIf="!loadingOrders && myOrders.length === 0" class="text-center text-gray-500 py-6">
            Aucune commande pour le moment.
          </div>

          <div *ngIf="!loadingOrders && myOrders.length > 0" class="space-y-3">
            <div *ngFor="let o of myOrders"
                 class="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <div>
                  <strong class="dark:text-white">#{{ o.orderNumber }}</strong>
                  <span class="ml-2 text-xs px-2 py-0.5 rounded-full"
                        [class.bg-yellow-100]="o.status === 'PENDING'"
                        [class.text-yellow-800]="o.status === 'PENDING'"
                        [class.bg-blue-100]="o.status === 'CONFIRMED'"
                        [class.text-blue-800]="o.status === 'CONFIRMED'"
                        [class.bg-emerald-100]="o.status === 'DELIVERED' || o.status === 'PAID'"
                        [class.text-emerald-800]="o.status === 'DELIVERED' || o.status === 'PAID'"
                        [class.bg-red-100]="o.status === 'CANCELLED'"
                        [class.text-red-800]="o.status === 'CANCELLED'">
                    {{ o.status }}
                  </span>
                </div>
                <span class="font-semibold dark:text-white">{{ o.totalAmount }} TND</span>
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {{ o.orderDate | date:'medium' }}
              </div>
              <div class="text-sm dark:text-gray-300">
                <span *ngFor="let it of o.items; let last = last">
                  {{ it.quantity }}× {{ it.productName }}<span *ngIf="!last">, </span>
                </span>
              </div>
              <div *ngIf="o.shippingAddress" class="text-xs text-gray-500 mt-1">
                📍 {{ o.shippingAddress }} · 💳 {{ paymentLabel(o.paymentMethod) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ClubstoreComponent implements OnInit {
  loading = true;
  products: StoreProduct[] = [];

  // Cart
  cart: CartLine[] = [];
  showCart = false;

  // Order form
  shippingAddress = '';
  paymentMethod = 'CASH_ON_DELIVERY';
  placingOrder = false;
  orderMessage = '';
  orderOk = false;

  // My orders
  showMyOrders = false;
  myOrders: any[] = [];
  loadingOrders = false;

  // Admin
  isAdmin = false;
  showAdmin = false;
  adminTab: 'products' | 'orders' = 'products';
  productForm: StoreProduct = this.emptyProductForm();
  editingProduct: StoreProduct | null = null;
  allOrders: any[] = [];
  loadingAllOrders = false;

  constructor(private store: ClubstoreService, private http: HttpClient) {}

  ngOnInit(): void {
    this.loadProducts();
    this.computeIsAdmin();
  }

  /** isAdmin = role bureau (PRESIDENT/TRESORIER/RH/SECRETAIRE_GENERALE/VICE_PRESIDENT). */
  private computeIsAdmin(): void {
    try {
      const raw = localStorage.getItem('currentUser') || localStorage.getItem('user');
      if (!raw) { this.isAdmin = false; return; }
      const u = JSON.parse(raw);
      const role = (u?.user?.role || u?.role || '').toUpperCase();
      const ADMIN_ROLES = ['PRESIDENT', 'VICE_PRESIDENT', 'TRESORIER', 'RH', 'SECRETAIRE_GENERALE'];
      this.isAdmin = ADMIN_ROLES.includes(role);
    } catch {
      this.isAdmin = false;
    }
  }

  loadProducts(): void {
    this.loading = true;
    this.store.list().subscribe({
      next: (list) => {
        this.products = list || [];
        this.loading = false;
      },
      error: () => {
        this.products = [];
        this.loading = false;
      },
    });
  }

  iconFor(type: string): string {
    const map: Record<string, string> = {
      TSHIRT: '👕',
      JERSEY: '🎽',
      SCARF: '🧣',
      HAT: '🧢',
      ACCESSORY: '🎒',
      CERTIFICATE: '🎓',
      EVENT_TICKET: '🎫',
    };
    return map[type] || '🛍️';
  }

  addToCart(p: StoreProduct): void {
    const existing = this.cart.find((l) => l.product.id === p.id);
    if (existing) {
      existing.quantity++;
    } else {
      this.cart.push({ product: p, quantity: 1 });
    }
  }

  removeLine(idx: number): void {
    this.cart.splice(idx, 1);
  }

  total(): number {
    return this.cart.reduce(
      (sum, l) => sum + (l.product.price || 0) * l.quantity,
      0,
    );
  }

  checkout(): void {
    this.orderMessage = '';
    this.orderOk = false;

    // ---- Client-side validation (mirror backend constraints) -------------
    // Backend regex: shippingAddress NotBlank, length 5-255 — quantity > 0,
    // productId NotBlank. Any of these → 400 with empty body, so we filter
    // here to give a clear local message instead.
    if (!this.cart.length) {
      this.orderMessage = 'Le panier est vide.'; return;
    }
    const addr = (this.shippingAddress || '').trim();
    if (addr.length < 5) {
      this.orderMessage = "L'adresse de livraison doit contenir au moins 5 caractères.";
      return;
    }
    const badLine = this.cart.find(l => !l.product?.id || (l.quantity ?? 0) < 1);
    if (badLine) {
      this.orderMessage =
        "Une ligne du panier est invalide (produit ou quantité). Retire-la et réessaie.";
      return;
    }

    this.placingOrder = true;
    const memberId = this.guessMemberId();
    const req: StoreOrderRequest = {
      memberId,
      shippingAddress: addr,
      paymentMethod: this.paymentMethod,
      items: this.cart.map((l) => ({
        productId: l.product.id!,
        quantity: l.quantity,
      })),
    };
    this.store.placeOrder(req).subscribe({
      next: (o) => {
        this.placingOrder = false;
        this.orderOk = true;
        this.orderMessage =
          'Commande créée ! Numéro : ' + (o.orderNumber || o.id || '—') +
          '. Paiement attendu : ' + this.paymentLabel(this.paymentMethod) + '.';
        this.cart = [];
        setTimeout(() => {
          this.showCart = false;
          this.orderMessage = '';
          this.shippingAddress = '';
        }, 3500);
      },
      error: (e) => {
        this.placingOrder = false;
        this.orderOk = false;
        // Spring renvoie parfois { errors: [...] } pour les @Valid : on
        // déballe ce cas, sinon on affiche le message générique.
        const errs = e?.error?.errors || e?.error?.fieldErrors;
        const detail = Array.isArray(errs) && errs.length
          ? errs.map((x: any) => x.defaultMessage || x.message || x).join(' · ')
          : (e?.error?.message || e?.error?.error || e?.message || 'Service indisponible');
        this.orderMessage = 'Erreur lors de la création de la commande : ' + detail;
      },
    });
  }

  paymentLabel(code: string): string {
    return ({
      CASH_ON_DELIVERY: 'à la livraison',
      BANK_TRANSFER: 'par virement bancaire',
      ESPECES: 'en espèces',
    } as Record<string, string>)[code] || code;
  }

  openMyOrders(): void {
    this.showMyOrders = true;
    this.loadingOrders = true;
    const memberId = this.guessMemberId();
    this.store.myOrders(memberId).subscribe({
      next: (orders) => {
        this.myOrders = (orders || []).sort((a: any, b: any) =>
          new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime()
        );
        this.loadingOrders = false;
      },
      error: () => {
        this.myOrders = [];
        this.loadingOrders = false;
      }
    });
  }

  // ============================================================
  //  ADMIN BOUTIQUE — CRUD products + manage orders
  // ============================================================
  private emptyProductForm(): StoreProduct {
    return { name: '', description: '', price: 0, productType: 'TSHIRT', stockQuantity: 0 };
  }

  openAdmin(): void {
    this.showAdmin = true;
    this.adminTab = 'products';
    this.resetProductForm();
  }

  resetProductForm(): void {
    this.productForm = this.emptyProductForm();
    this.editingProduct = null;
  }

  editProduct(p: StoreProduct): void {
    this.editingProduct = p;
    this.productForm = { ...p };
  }

  saveProduct(): void {
    const op = this.editingProduct?.id
      ? this.store.update(this.editingProduct.id, this.productForm)
      : this.store.create(this.productForm);
    op.subscribe({
      next: () => {
        this.resetProductForm();
        this.loadProducts();
      },
      error: (err) => alert('Erreur : ' + (err?.error?.message || err?.message || 'Service indisponible'))
    });
  }

  deleteProduct(p: StoreProduct): void {
    if (!p.id) return;
    if (!confirm(`Supprimer "${p.name}" ?`)) return;
    this.store.remove(p.id).subscribe({
      next: () => this.loadProducts(),
      error: (err) => alert('Erreur : ' + (err?.error?.message || err?.message))
    });
  }

  loadAllOrders(): void {
    this.loadingAllOrders = true;
    this.store.allOrders().subscribe({
      next: (orders) => {
        this.allOrders = (orders || []).sort((a: any, b: any) =>
          new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime()
        );
        this.loadingAllOrders = false;
      },
      error: () => {
        this.allOrders = [];
        this.loadingAllOrders = false;
      }
    });
  }

  changeOrderStatus(order: any, newStatus: string): void {
    if (!order.id || order.status === newStatus) return;
    this.store.updateOrderStatus(order.id, newStatus).subscribe({
      next: (updated) => {
        order.status = updated.status;
      },
      error: (err) => alert('Erreur : ' + (err?.error?.message || err?.message))
    });
  }

  // Recupere le memberId depuis le bon storage (AuthService stocke sous
  // la cle "currentUser", pas "user"). Tolerant aux structures imbriquees.
  private guessMemberId(): string {
    try {
      const raw =
        localStorage.getItem('currentUser') || localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        const u = parsed?.user ?? parsed;
        return u.id || u.userId || u._id || 'demo-member';
      }
    } catch (_) {
      // ignore
    }
    return 'demo-member';
  }
}
