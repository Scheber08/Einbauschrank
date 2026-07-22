import { useState } from 'react';
import { formatDate } from '../../engine/date';
import { commit, useAppState } from '../../state/store';
import type { NewsCategory } from '../../engine/types';
import { Empty, Panel } from '../components';

const CATEGORY_LABELS: Partial<Record<NewsCategory, string>> = {
  match: 'Spielberichte',
  transfer: 'Transfers',
  contract: 'Vertraege',
  injury: 'Verletzungen',
  award: 'Auszeichnungen',
  record: 'Rekorde',
  season: 'Saison',
  media: 'Medien',
};

export default function NewsTab() {
  const game = useAppState().game!;
  const [filter, setFilter] = useState<NewsCategory | 'all'>('all');

  const items = game.news.filter((n) => filter === 'all' || n.category === filter);

  function markAllRead() {
    for (const n of game.news) n.read = true;
    commit();
  }

  return (
    <Panel title="Nachrichten" action={
      <div className="row">
        <div className="chip-row">
          <span className={`chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}>Alle</span>
          {(Object.keys(CATEGORY_LABELS) as NewsCategory[]).map((key) => (
            <span key={key} className={`chip ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}>{CATEGORY_LABELS[key]}</span>
          ))}
        </div>
        <button className="small ghost" onClick={markAllRead}>Alle gelesen</button>
      </div>
    }>
      {items.length === 0 && <Empty text="Keine Meldungen in dieser Kategorie." />}
      <div className="scroll">
        {items.map((n) => (
          <article className={`news-item ${n.read ? '' : 'unread'}`} key={n.id}
            onClick={() => { if (!n.read) { n.read = true; commit(); } }}>
            <div className="row between">
              <span className="head" style={n.important ? { color: '#f5c542' } : undefined}>
                {n.headline}
              </span>
              <span className="tiny dim">{formatDate(n.date)}</span>
            </div>
            <div className="small muted">{n.body}</div>
          </article>
        ))}
      </div>
    </Panel>
  );
}
