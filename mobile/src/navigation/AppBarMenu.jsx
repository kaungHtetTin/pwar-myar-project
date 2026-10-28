import React, { useContext } from 'react';
import { Bot, EllipsisVertical, MessageCircle } from 'lucide-react';
import { IconButton } from '../components/Controls';
import { useLocale } from '../localization/LocaleContext';
import { AppNavigationContext } from './AppNavigationContext';

export function AppBarMenu({ showAssistant = true, showChat = true }) {
  const { openNavigation, navigationOpen = false, shopChat, aiAssistant } = useContext(AppNavigationContext);
  const { language } = useLocale();
  const label = language === 'my' ? 'အက်ပ် မီနူးဖွင့်ရန်' : 'Open app menu';
  const chatLabel = language === 'my' ? 'ဆိုင် စကားပြောခန်း' : 'Shop chat';
  const unread = shopChat?.unreadCount || 0;
  const chatDescription = unread ? (language === 'my' ? `${chatLabel}၊ မဖတ်ရသေးသော မက်ဆေ့ချ် ${unread} ခု` : `${chatLabel}, ${unread} unread message${unread === 1 ? '' : 's'}`) : chatLabel;
  return <>{showAssistant && aiAssistant && !aiAssistant.current && <IconButton variant="ghost" className="app-bar-chat" aria-label="PwarMyar AI assistant" title="PwarMyar AI assistant" onClick={aiAssistant.open} aria-current={aiAssistant.current ? 'page' : undefined}><Bot size={20} aria-hidden="true" /></IconButton>}{showChat && shopChat && !aiAssistant?.current && <IconButton variant="ghost" className="app-bar-chat" aria-label={chatDescription} title={chatDescription} onClick={shopChat.open} aria-current={shopChat.current ? 'page' : undefined}><MessageCircle size={20} aria-hidden="true" />{unread > 0 && <span className="app-bar-chat-badge" aria-hidden="true" data-no-localize>{unread > 99 ? '99+' : unread}</span>}</IconButton>}<IconButton variant="ghost" className="app-bar-menu" aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={navigationOpen} aria-controls="mobile-app-drawer" onClick={openNavigation}><EllipsisVertical size={20} aria-hidden="true" /></IconButton></>;
}
