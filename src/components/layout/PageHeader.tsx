import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { IconButton } from '../ui/Button';

interface Props {
  title: string;
  showBack?: boolean;
  actions?: ReactNode;
}

export function PageHeader({ title, showBack, actions }: Props) {
  const navigate = useNavigate();
  return (
    <header className="mb-4 flex min-h-11 items-center gap-2">
      {showBack && (
        <IconButton label="back" onClick={() => void navigate(-1)}>
          <ArrowRight size={20} className="rtl:rotate-180" />
        </IconButton>
      )}
      <h1 className="flex-1 truncate text-xl font-bold">{title}</h1>
      {actions}
    </header>
  );
}
