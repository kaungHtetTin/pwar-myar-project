import { LoadingSkeleton } from './LoadingSkeleton';
import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useText } from './i18n';
import { useCustomer } from './CustomerAccount';

export function ShopChat({ slug }) {
  const text = useText();
  const { customer, loading } = useCustomer();
  if (loading) return <LoadingSkeleton variant="cart-status" message="Loading account…" />;
  return <a className="button shop-chat-launcher" href={`#/chats?shop=${encodeURIComponent(slug)}`}><MessageCircle size={18} aria-hidden="true" />{text(customer ? 'Chat with shop' : 'Sign in to chat with shop')}</a>;
}