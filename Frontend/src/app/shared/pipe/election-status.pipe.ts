import { Pipe, PipeTransform } from '@angular/core';

/**
 * Mappe les statuts d'élection (anglais brut backend) vers leur libellé français.
 * PLANNED -> Planifiée
 * OPEN -> Ouverte
 * CLOSED -> Clôturée
 * CANCELLED -> Annulée
 */
@Pipe({
  name: 'electionStatus',
  standalone: true
})
export class ElectionStatusPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    switch (value.toUpperCase()) {
      case 'PLANNED': return 'Planifiée';
      case 'OPEN': return 'Ouverte';
      case 'CLOSED': return 'Clôturée';
      case 'CANCELLED': return 'Annulée';
      default: return value;
    }
  }
}

/**
 * Retourne les classes Tailwind pour le badge de statut.
 * PLANNED = jaune, OPEN = bleu, CLOSED = vert, CANCELLED = gris/rouge
 */
@Pipe({
  name: 'electionStatusColor',
  standalone: true
})
export class ElectionStatusColorPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return 'bg-gray-100 text-gray-800 border border-gray-200';
    switch (value.toUpperCase()) {
      case 'PLANNED':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'OPEN':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'CLOSED':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  }
}
