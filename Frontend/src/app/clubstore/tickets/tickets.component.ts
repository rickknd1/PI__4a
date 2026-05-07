import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, Product } from '../services/api.service';
import { CartService } from '../services/cart.service';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tickets.component.html',
})
export class TicketsComponent implements OnInit {
  tickets: Product[] = [];
  loading = true;
  searchTerm = '';
  nextEvent: Product | null = null;

  constructor(
    private apiService: ApiService,
    private cartService: CartService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadTickets();
    this.loadNextEvent();
  }

  loadTickets() {
    this.loading = true;
    this.apiService.getAllProducts().subscribe({
      next: data => {
        this.tickets = (data || []).filter(p => p.productType === 'EVENT_TICKET' && p.isAvailable);
        this.loading = false;
      },
      error: err => {
        console.error('Erreur chargement:', err);
        this.loading = false;
      },
    });
  }

  loadNextEvent() {
    this.apiService.getNextUpcomingEvent().subscribe({
      next: event => (this.nextEvent = event && (event as any).id ? event : null),
      error: err => console.error('Error loading next event:', err),
    });
  }

  get filteredTickets() {
    if (!this.searchTerm.trim()) return this.tickets;
    const term = this.searchTerm.toLowerCase();
    return this.tickets.filter(t =>
      t.name.toLowerCase().includes(term) ||
      (t.eventName && t.eventName.toLowerCase().includes(term)),
    );
  }

  addToCart(ticket: Product) {
    this.cartService.addToCart(ticket, 1);
    alert(`✅ ${ticket.name} ajouté au panier`);
  }

  buyNow(ticket: Product) {
    this.cartService.addToCart(ticket, 1);
    this.router.navigate(['/cart']);
  }

  viewEvent(event: Product) {
    this.router.navigate(['/products', event.id]);
  }

  formatEventDate(dateValue: any): string {
    if (!dateValue) return 'Date à confirmer';
    let date: Date;
    if (typeof dateValue === 'string') date = new Date(dateValue);
    else if (dateValue instanceof Date) date = dateValue;
    else return 'Date invalide';
    if (isNaN(date.getTime())) return 'Date invalide';
    return (
      date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) +
      ' à ' +
      date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    );
  }

  getStockStatus(stock: number): string {
    if (stock <= 0) return 'Complet';
    if (stock < 100) return `Plus que ${stock} places`;
    return `${stock} places disponibles`;
  }
}
