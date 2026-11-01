import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { copyText } from '../../utils/clipboard';
import { formatCardNumber } from '../../utils/digits';
import type { Lang } from '../../domain/types';
import { cn } from '../../utils/cn';

/**
 * Grouped bank-card number with a one-tap copy button that flips to a check
 * for a moment. Events are swallowed so a card shown inside a clickable row
 * (dashboard occurrence, detail list) doesn't trigger the row's own action.
 */
export function CardCopyChip({
  card,
  lang,
  className,
}: {
  card: string;
  lang: Lang;
  className?: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onCopy = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
    if (copied) return;
    void copyText(card).then((ok) => {
      if (!ok) return;
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {/* LTR isolates the dash grouping from the RTL bidi run around it. */}
      <span dir="ltr" className="tabular-nums">
        {formatCardNumber(card, lang)}
      </span>
      <button
        type="button"
        aria-label={t('common.copyCard')}
        title={t('common.copyCard')}
        onClick={onCopy}
        onKeyDown={onCopy}
        className={cn(
          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-fg-2',
          'transition-[background-color,color,transform] duration-150 hover:bg-surface-2 active:scale-90',
          copied ? 'text-success' : 'hover:text-accent-600 dark:hover:text-accent-400',
        )}
      >
        {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
      </button>
    </span>
  );
}
