import {
  Car,
  FileText,
  Gift,
  GraduationCap,
  Heart,
  House,
  Plane,
  Receipt,
  Tag,
  User,
  Wallet,
  Wrench,
} from 'lucide-react';
import { cn } from '../../utils/cn';

const GLYPHS: Record<string, typeof Receipt> = {
  receipt: Receipt,
  car: Car,
  user: User,
  tag: Tag,
  wallet: Wallet,
  home: House,
  'graduation-cap': GraduationCap,
  heart: Heart,
  gift: Gift,
  plane: Plane,
  'file-text': FileText,
  wrench: Wrench,
};

export function CategoryGlyph({ name, size = 17 }: { name: string; size?: number }) {
  const Icon = GLYPHS[name] ?? Tag;
  return <Icon size={size} aria-hidden />;
}

/** Soft tinted tile carrying a category's icon in its own color. */
export function CategoryTile({
  icon,
  color,
  className,
}: {
  icon: string | undefined;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', className)}
      style={{ backgroundColor: `${color}1f`, color }}
      aria-hidden
    >
      <CategoryGlyph name={icon ?? 'tag'} />
    </span>
  );
}
