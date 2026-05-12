import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CartService, CartItem } from '../services/cart.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cart.component.html',
})
export class CartComponent implements OnInit {
  cartItems: CartItem[] = [];
  totalPrice = 0;
  totalItems = 0;

  constructor(private cartService: CartService, private router: Router) {}

  ngOnInit() {
    this.cartService.cart$.subscribe(items => {
      this.cartItems = items;
      this.totalPrice = this.cartService.getTotalPrice();
      this.totalItems = this.cartService.getTotalItems();
    });
  }

  updateQuantity(item: CartItem, quantity: number) { this.cartService.updateQuantity(item.id, quantity); }
  removeItem(item: CartItem) { this.cartService.removeFromCart(item.id); }
  clearCart() { this.cartService.clearCart(); }

  checkout() {
    if (this.cartItems.length === 0) {
      alert('Votre panier est vide');
      return;
    }
    this.router.navigate(['/orders'], { queryParams: { openForm: 'true' } });
  }
}
