import React from 'react';
import { Building2, CalendarDays, MapPin, Phone, ReceiptText, StickyNote, UserRound, WalletCards } from 'lucide-react';
import { money } from '../utils';

export function SupplierProfileCard({ supplier, paymentRecordCount = null }) {
  const showPaymentSummary = paymentRecordCount !== null && paymentRecordCount !== undefined;
  return (
    <section className="supplier-profile-card" aria-labelledby="supplier-profile-name">
      <div className="supplier-profile-identity">
        <span className="supplier-profile-avatar" aria-hidden="true"><Building2 size={24} /></span>
        <div>
          <span>Supplier profile</span>
          <strong id="supplier-profile-name" className="supplier-profile-name">{supplier.name}</strong>
          <p><UserRound size={14} /> {supplier.contact_person || 'No contact person'}</p>
        </div>
      </div>
      <div className="supplier-profile-details">
        <span><Phone size={16} /><span>Phone<strong>{supplier.phone || '-'}</strong></span></span>
        {showPaymentSummary
          ? <span><WalletCards size={16} /><span>Current balance<strong>{money(supplier.balance || 0)}</strong></span></span>
          : <span><CalendarDays size={16} /><span>Last purchase<strong>{supplier.last_purchase || '-'}</strong></span></span>}
        <span><MapPin size={16} /><span>Address<strong>{supplier.address || 'No address'}</strong></span></span>
        {showPaymentSummary
          ? <span><ReceiptText size={16} /><span>Payment records<strong>{paymentRecordCount}</strong></span></span>
          : <span><StickyNote size={16} /><span>Note<strong>{supplier.note || 'No note'}</strong></span></span>}
      </div>
    </section>
  );
}
