import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { IconButton } from '../ui/Button';

interface Props {
  title: string;
  /** Quiet line under the title (e.g. today's date). */
  subtitle?: string;
  showBack?: boolean;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, showBack, actions }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <header className="mb-4 flex min-h-11 items-center gap-2">
      {showBack && (
        // Points toward the start edge: left in LTR, right in RTL.
        <IconButton label={t('common.back')} onClick={() => void navigate(-1)} className="-ms-2">
          <ArrowLeft size={20} className="rtl:rotate-180" />
        </IconButton>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-xs text-fg-2">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
