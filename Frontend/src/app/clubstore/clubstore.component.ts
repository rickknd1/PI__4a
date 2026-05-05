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

  constructor(private store: ClubstoreService, private http: HttpClient) {}

  ngOnInit(): void {
    this.loadProducts();
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

  private paymentLabel(code: string): string {
    return ({
      CASH_ON_DELIVERY: 'à la livraison',
      BANK_TRANSFER: 'par virement bancaire',
      ESPECES: 'en espèces',
    } as Record<string, string>)[code] || code;
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
