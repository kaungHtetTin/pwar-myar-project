import React, { useContext } from 'react';
import { OrderAttentionContext } from './OrderAttentionContext';
import { useLocale } from '../localization/LocaleContext';

export function OrderCountBadge({ className = '' }) {
  const count = useContext(OrderAttentionContext);
  const { language } = useLocale();
  if (!count) return null;
  return <span className={`order-attention-badge ${className}`}><span aria-hidden="true" data-no-localize>{count > 99 ? '99+' : count}</span><span className="sr-only">{language === 'my' ? `ဆောင်ရွက်ရန် အော်ဒါ ${count} ခု` : `${count} orders need attention`}</span></span>;
}
