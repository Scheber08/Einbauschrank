import { useState } from 'react';
import { formatDate } from '../../engine/date';
import { postSocial } from '../../state/actions';
import { commit, useAppState } from '../../state/store';
import type { NewsCategory } from '../../engine/types';
import { Empty, Panel, Pill } from '../components';
import { t, tNumber } from '../../i18n';
import { useLocale } from '../../i18n/useLocale';

/** Katalogschluessel je Rubrik - uebersetzt wird bei der Anzeige. */
const CATEGORY_LABELS: Partial<Record<NewsCategory, string>> = {
  match: 'news.cat.match',
  transfer: 'news.cat.transfer',
  contract: 'news.cat.contract',
  injury: 'news.cat.injury',
  award: 'news.cat.award',
  record: 'news.cat.record',
  season: 'news.cat.season',
  media: 'news.cat.media',
};

export default function NewsTab() {
  useLocale();
  const game = useAppState().game!;
  const [filter, setFilter] = useState<NewsCategory | 'all'>('all');

  const items = game.news.filter((n) => filter === 'all' || n.category === filter);

  function markAllRead() {
    for (const n of game.news) n.read = true;
    commit();
  }

  return (
    <>
      <SocialPanel />
      <Panel title={t('news.title')} action={
      <div className="row">
        <div className="chip-row">
          <span className={`chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}>Alle</span>
          {(Object.keys(CATEGORY_LABELS) as NewsCategory[]).map((key) => (
            <span key={key} className={`chip ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}>{t(CATEGORY_LABELS[key] ?? '')}</span>
          ))}
        </div>
        <button className="small ghost" onClick={markAllRead}>{t('news.markAllRead')}</button>
      </div>
    }>
      {items.length === 0 && <Empty text={t('news.emptyCategory')} />}
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
    </>
  );
}

const KIND_STYLE: Record<string, { label: string; color: string }> = {
  own: { label: t('news.cat.own'), color: '#37d67a' },
  fan: { label: t('news.cat.fan'), color: '#2bb7ff' },
  media: { label: t('news.cat.media'), color: '#f5c542' },
  critic: { label: t('news.cat.critic'), color: '#ff8a95' },
};

/** Soziales Netzwerk: Reaktionen der Oeffentlichkeit und eigene Beitraege. */
function SocialPanel() {
  const game = useAppState().game!;
  const social = game.social;
  if (!social || (social.feed.length === 0 && !social.draft)) return null;

  return (
    <Panel title={t('news.public')} action={
      <Pill>{t('news.followers', { n: tNumber(social.followers) })}</Pill>
    }>
      {social.draft && (
        <div style={{
          padding: '0.7rem 0.8rem', marginBottom: '0.8rem',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          background: '#0c1729',
        }}>
          <div className="tiny dim">{t('news.wantToComment')}</div>
          <div style={{ fontWeight: 620, margin: '0.2rem 0 0.6rem' }}>{social.draft.prompt}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {social.draft.options.map((o) => (
              <button key={o.id} style={{ textAlign: 'left', padding: '0.5rem 0.7rem' }}
                onClick={() => postSocial(o.id)}>
                <div className="small" style={{ fontWeight: 600 }}>{o.label}</div>
                <div className="tiny dim">
                  {o.text ? `"${o.text}"` : t('news.noPost')} - {o.tone}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {social.feed.length === 0 ? (
        <Empty text={t('news.nothingPosted')} />
      ) : (
        <div className="scroll">
          {social.feed.slice(0, 20).map((p) => {
            const style = KIND_STYLE[p.kind] ?? KIND_STYLE.media;
            return (
              <article className="news-item" key={p.id}>
                <div className="row between">
                  <span className="small" style={{ fontWeight: 620, color: style.color }}>
                    {p.author}
                  </span>
                  <span className="tiny dim">{formatDate(p.date)}</span>
                </div>
                <div className="small muted">{p.text}</div>
                <div className="tiny dim" style={{ marginTop: 2 }}>
                  {style.label} - {t('news.likes', { n: tNumber(p.likes) })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
