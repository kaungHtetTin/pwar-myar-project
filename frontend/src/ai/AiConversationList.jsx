import React from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { useLanguage } from '../components/LanguageProvider';

export function AiConversationList({ chat, onChoose, onNew }) {
  const { language } = useLanguage();
  return <section className="shop-chat-inbox ai-conversation-list" aria-label="AI conversations">
    <header className="shop-chat-inbox-heading"><h2>Conversations</h2><button type="button" disabled={chat.busy} onClick={onNew} aria-label="New chat" title="New chat"><Plus size={16} /></button></header>
    <div className="shop-chat-thread-list" onScroll={event => {
      const node = event.currentTarget;
      if (chat.moreThreads && !chat.historyBusy && !chat.historyError && node.scrollHeight - node.scrollTop - node.clientHeight < 100) void chat.history(false);
    }}>
      {chat.threads.map(thread => {
        const date = thread.updated_at ? new Date(thread.updated_at) : null;
        const validDate = date && !Number.isNaN(date.getTime());
        return <button className="shop-chat-thread" type="button" key={thread.id} data-no-localize={Boolean(thread.title) || undefined} aria-label={thread.title || 'New conversation'} aria-pressed={chat.conversation === thread.id} disabled={chat.busy || chat.loading} onClick={() => onChoose(thread.id)}>
          <span className="shop-chat-avatar"><MessageSquare size={16} /></span>
          <span className="shop-chat-thread-content"><span className="shop-chat-thread-heading"><strong>{thread.title || 'New conversation'}</strong></span>{validDate && <time className="shop-chat-preview" dateTime={date.toISOString()} title={date.toLocaleString(language === 'my' ? 'my-MM' : 'en-US')}>{date.toLocaleDateString(language === 'my' ? 'my-MM' : 'en-US', { month: 'short', day: 'numeric' })}</time>}</span>
        </button>;
      })}
      <div className="shop-chat-list-end">
        {!chat.historyBusy && !chat.threads.length && !chat.historyError && <p>No conversations yet.</p>}
        {chat.historyBusy && <p role="status">Loading history...</p>}
        {chat.historyError && <p role="alert">{chat.historyError}</p>}
        {(chat.moreThreads || chat.historyError) && <button type="button" disabled={chat.historyBusy} onClick={() => chat.history(false)}>{chat.historyError ? 'Retry conversations' : 'Load more conversations'}</button>}
      </div>
    </div>
  </section>;
}
