import React from 'react';
import { CalendarDays, Mail, MapPin, Phone, ReceiptText, StickyNote, UserRound, UsersRound, WalletCards } from 'lucide-react';
import { money } from '../utils';

export function CustomerProfileCard({ customer, paymentRecordCount = null }) {
  const showPaymentSummary = paymentRecordCount !== null && paymentRecordCount !== undefined;
  const balance = Number(customer.balance || 0);
  const accountLabel = balance > 0 ? 'Customer owes shop' : balance < 0 ? 'Shop owes customer' : 'Account settled';
  return (
    <section className="supplier-profile-card customer-profile-card" aria-labelledby="customer-profile-name">
      <div className="supplier-profile-identity">
        <span className="supplier-profile-avatar" aria-hidden="true"><UsersRound size={24} /></span>
        <div>
          <span>Customer profile</span>
          <strong id="customer-profile-name" className="supplier-profile-name">{customer.name}</strong>
          <p><UserRound size={14} /> {accountLabel}</p>
        </div>
      </div>
      <div className="supplier-profile-details">
        <span><Phone size={16} /><span>Phone<strong>{customer.phone || '-'}</strong></span></span>
        {customer.email && <span><Mail size={16} /><span>Email<strong>{customer.email}</strong></span></span>}
        {showPaymentSummary
          ? <span><WalletCards size={16} /><span>Current balance<strong>{money(balance)}</strong></span></span>
          : <span><CalendarDays size={16} /><span>Last sale<strong>{customer.last_sale || '-'}</strong></span></span>}
        <span><MapPin size={16} /><span>Address<strong>{customer.address || 'No address'}</strong></span></span>
        {showPaymentSummary
          ? <span><ReceiptText size={16} /><span>Payment records<strong>{paymentRecordCount}</strong></span></span>
          : <span><StickyNote size={16} /><span>Note<strong>{customer.note || 'No note'}</strong></span></span>}
      </div>
    </section>
  );
}
