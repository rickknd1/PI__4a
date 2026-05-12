import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, Order } from '../services/api.service';
import { CartService, CartItem } from '../services/cart.service';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.component.html',
})
export class OrdersComponent implements OnInit {
  orders: Order[] = [];
  loading = true;
  errorMessage = '';

  showOrderForm = false;
  orderForm = {
    shippingAddress: '',
    paymentMethod: '',
  };

  private userId: string = '';

  constructor(
    private apiService: ApiService,
    public cartService: CartService,
    private route: ActivatedRoute,
    public router: Router,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    const u = this.auth.getCurrentUser();
    this.userId = (u as any)?.userId || (u as any)?.id || '';
    this.loadOrders();

    this.route.queryParams.subscribe(params => {
      if (params['openForm'] === 'true') this.showOrderForm = true;
    });
  }

  getCartItems(): CartItem[] { return this.cartService.getCartItems(); }
  getCartTotal(): number { return this.cartService.getTotalPrice(); }
  goToProducts() { this.router.navigate(['/products']); }

  loadOrders() {
    this.loading = true;
    this.errorMessage = '';
    if (!this.userId) {
      // Pas connecté → pas de commandes spécifiques, on tente la liste globale
      this.apiService.getAllOrders().subscribe({
        next: data => {
          this.orders = data || [];
          this.loading = false;
        },
        error: () => {
          this.orders = [];
          this.loading = false;
        },
      });
      return;
    }
    this.apiService.getOrdersByMember(this.userId).subscribe({
      next: data => {
        this.orders = data || [];
        this.loading = false;
      },
      error: err => {
        console.error('Erreur chargement commandes par membre:', err);
        this.apiService.getAllOrders().subscribe({
          next: allOrders => {
            this.orders = (allOrders || []).filter(o => o.memberId === this.userId);
            this.loading = false;
          },
          error: err2 => {
            console.error('Erreur chargement toutes commandes:', err2);
            this.orders = [];
            this.loading = false;
          },
        });
      },
    });
  }

  createOrder() {
    const cartItems = this.cartService.getCartItems();
    if (cartItems.length === 0) {
      alert('Votre panier est vide');
      return;
    }
    if (!this.orderForm.shippingAddress || !this.orderForm.shippingAddress.trim()) {
      alert('Veuillez saisir une adresse de livraison');
      return;
    }
    if (!this.orderForm.paymentMethod) {
      alert('Veuillez sélectionner un mode de paiement');
      return;
    }
    if (!this.userId) {
      alert('Utilisateur non identifié — reconnectez-vous');
      return;
    }
    const validPaymentMethods = ['CARTE', 'PAYPAL', 'ESPECES'];
    if (!validPaymentMethods.includes(this.orderForm.paymentMethod)) {
      alert('Mode de paiement invalide. Utilisez CARTE, PAYPAL ou ESPECES');
      return;
    }

    const orderData = {
      memberId: this.userId,
      shippingAddress: this.orderForm.shippingAddress.trim(),
      paymentMethod: this.orderForm.paymentMethod,
      items: cartItems.map(item => ({ productId: item.id, quantity: item.quantity })),
    };

    this.apiService.createOrder(orderData).subscribe({
      next: () => {
        alert('Commande créée avec succès !');
        this.cartService.clearCart();
        this.loadOrders();
        this.showOrderForm = false;
        this.orderForm = { shippingAddress: '', paymentMethod: '' };
        this.router.navigate(['/orders']);
      },
      error: err => {
        console.error('Erreur création commande:', err);
        const errorMsg = err.error?.message || 'Erreur lors de la création de la commande';
        alert(errorMsg);
      },
    });
  }

  cancelOrder(orderId: string) {
    if (confirm('Annuler cette commande ?')) {
      this.apiService.updateOrderStatus(orderId, 'CANCELLED').subscribe({
        next: () => {
          alert('✅ Commande annulée');
          this.loadOrders();
        },
        error: err => {
          console.error('Erreur annulation:', err);
          alert('❌ Erreur lors de l\'annulation');
        },
      });
    }
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

  getStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING': return '⏳ En attente';
      case 'CONFIRMED': return '✅ Confirmée';
      case 'SHIPPED': return '🚚 Expédiée';
      case 'DELIVERED': return '📦 Livrée';
      case 'CANCELLED': return '❌ Annulée';
      default: return status;
    }
  }
}
