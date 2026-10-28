import React from 'react';
import { PlatformUserEmail } from './PlatformUserEmail';

export function BusinessOwnerEmail({ business, onClose, onSent }) {
  return <PlatformUserEmail owner businessName={business.name} customer={{ id: business.owner_id || business.id, name: business.owner_name || 'Business owner', email: business.owner_email }} endpoint={`/office/businesses/${business.id}/email`} onClose={onClose} onSent={onSent} />;
}
