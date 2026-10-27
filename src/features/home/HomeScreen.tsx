import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { BellOff, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { ReminderCard } from './ReminderCard';
import { EmptyState, Chip } from '../../components/ui';
import { Button } from '../../components/ui/Button';
import { useReminders } from '../../hooks/useReminders';
import { splitBySections } from '../../utils/sortReminders';
import type { ReminderSection } from '../../domain/alerts';
import { cn } from '../../utils/cn';

const SECTION_KEYS: Partial<Record<ReminderSection, string>> = {
  overdue: 'home.overdue',
  today: 'home.todaySection',
  upcoming: 'home.upcoming',
  done: 'home.doneSection',
};

export function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { reminders, complete } = useReminders();
  const [showDone, setShowDone] = useState(false);

  const sections = useMemo(() => splitBySections(reminders), [reminders]);
  const isEmpty = reminders.length === 0;

  const order: ReminderSection[] = ['overdue', 'today', 'upcoming'];

  return (
    <div>
      <PageHeader
        title={t('app.name')}
        actions={
          <Button size="sm" variant="secondary" onClick={() => navigate('/reminder/new')} className="hidden md:inline-flex">
            <Plus size={15} aria-hidden />
            {t('nav.add')}
          </Button>
        }
      />

      {isEmpty ? (
        <EmptyState
          icon={<BellOff size={26} aria-hidden />}
          title={t('home.emptyTitle')}
          body={t('home.emptyBody')}
          action={
            <Button onClick={() => navigate('/reminder/new')} className="mt-2">
              <Plus size={16} aria-hidden />
              {t('home.addFirst')}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {order.map((section) => {
            const list = sections[section];
            if (list.length === 0) return null;
            return (
              <section key={section} aria-label={t(SECTION_KEYS[section]!)}>
                <h2
                  className={cn(
                    'mb-2 px-1 text-xs font-semibold tracking-wide',
                    section === 'overdue' ? 'text-danger' : 'text-fg-2',
                  )}
                >
                  {t(SECTION_KEYS[section]!)}
                  {section !== 'today' && ` (${list.length})`}
                </h2>
                <div className="flex flex-col gap-2">
                  {list.map((reminder) => (
                    <ReminderCard key={reminder.id} reminder={reminder} onComplete={(id) => void complete(id)} />
                  ))}
                </div>
              </section>
            );
          })}

          {sections.done.length > 0 && (
            <section aria-label={t('home.doneSection')}>
              <Chip active={showDone} onClick={() => setShowDone((v) => !v)} className="mb-2">
                {showDone ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
                {t(showDone ? 'home.hideDone' : 'home.showDone')} ({sections.done.length})
              </Chip>
              {showDone && (
                <div className="flex flex-col gap-2">
                  {sections.done.slice(0, 20).map((reminder) => (
                    <ReminderCard key={reminder.id} reminder={reminder} onComplete={(id) => void complete(id)} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
