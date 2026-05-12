/**
 * Coût d’un besoin emprunté : devis validé par le trésorier + budgets staff + lieu
 * (plus d’utilisation du minimum de tous les devis une fois qu’une règle de validation existe).
 */

export interface DevisLike {
  amount?: number | string | null;
  status?: string | null;
}

export interface BorrowedItemBudgetInput {
  estimatedBudget?: number | null;
  locationBudget?: number | null;
  rentalFee?: number | null;
  staff?: { budget?: number | null }[] | null;
}

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && !Number.isNaN(n) ? n : 0;
}

export function sumStaffBudgets(staff?: { budget?: number | null }[] | null): number {
  return (staff || []).reduce((s, m) => s + num(m?.budget), 0);
}

/** Montant du devis choisi par le trésorier (statut validated). */
export function validatedDevisAmount(devis: DevisLike[] | null | undefined): number | null {
  const v = (devis || []).find((d) => String(d?.status || '').toLowerCase() === 'validated');
  if (!v || v.amount == null || v.amount === '') return null;
  const a = num(v.amount);
  return a >= 0 ? a : null;
}

/** Plus bas devis encore « en lice » (pending), exclut rejected — utilisé seulement si aucun devis validé. */
export function minPendingDevisAmount(devis: DevisLike[] | null | undefined): number | null {
  const active = (devis || []).filter(
    (d) => d && String(d.status || '').toLowerCase() !== 'rejected' && d.amount != null && d.amount !== ''
  );
  if (!active.length) return null;
  const amounts = active.map((d) => num(d.amount));
  const finite = amounts.filter((n) => n >= 0);
  return finite.length ? Math.min(...finite) : null;
}

export type BorrowedBudgetMode = 'validated' | 'provisional';

export interface BorrowedBudgetBreakdown {
  /** Part fournisseur : devis validé, ou estimation (min pending / budget enregistré). */
  supplierQuote: number;
  staff: number;
  location: number;
  total: number;
  mode: BorrowedBudgetMode;
}

/**
 * Coût prévu = montant du devis validé + staff + lieu/redevance.
 * Si pas encore de validation : estimation (min des devis non rejetés + staff + lieu, ou estimatedBudget + extras).
 */
export function computeBorrowedItemBudgetBreakdown(
  item: BorrowedItemBudgetInput,
  devis?: DevisLike[] | null
): BorrowedBudgetBreakdown {
  const staffSum = sumStaffBudgets(item.staff);
  const loc = num(item.locationBudget) + num(item.rentalFee);
  const eb = num(item.estimatedBudget);

  const validated = validatedDevisAmount(devis ?? null);
  let supplierQuote = 0;
  let mode: BorrowedBudgetMode = 'provisional';

  if (validated != null) {
    supplierQuote = validated;
    mode = 'validated';
  } else {
    const minP = minPendingDevisAmount(devis ?? null);
    if (minP != null) {
      supplierQuote = minP;
    } else if (eb > 0) {
      supplierQuote = Math.max(0, eb - staffSum);
    }
  }

  const total = supplierQuote + staffSum + loc;
  return { supplierQuote, staff: staffSum, location: loc, total, mode };
}

export function computeBorrowedItemBudgetTotal(
  item: BorrowedItemBudgetInput,
  devis?: DevisLike[] | null
): number {
  return computeBorrowedItemBudgetBreakdown(item, devis).total;
}
