import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Car,
  FileText,
  Gift,
  GraduationCap,
  Heart,
  House,
  Pencil,
  Plane,
  Plus,
  Receipt,
  Tag,
  Trash2,
  User,
  Wallet,
  Wrench,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, IconButton } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useConfirm } from '../../components/ui/Snackbar';
import { useCategories } from '../../hooks/useReminders';
import { getRepositories } from '../../repositories';
import { BUILT_IN_CATEGORY_IDS } from '../../domain/defaults';
import { ACCENTS, CATEGORY_COLOR_HEX } from '../../themes/accents';
import { cn } from '../../utils/cn';

export const CATEGORY_ICONS = [
  'receipt', 'car', 'user', 'tag', 'wallet', 'home',
  'graduation-cap', 'heart', 'gift', 'plane', 'file-text', 'wrench',
] as const;

export function CategoriesScreen() {
  const { t } = useTranslation();
  const { categories, refresh } = useCategories();
  const confirm = useConfirm();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('tag');
  const [color, setColor] = useState<(typeof ACCENTS)[number]['id']>('teal');
  const [nameError, setNameError] = useState(false);

  const openEditor = (id: string | null) => {
    const category = id ? categories.find((c) => c.id === id) : undefined;
    setEditingId(id);
    setName(category && !category.nameKey ? (category.name ?? '') : '');
    setIcon(category?.icon ?? 'tag');
    setColor(category?.color ?? 'teal');
    setNameError(false);
    setEditorOpen(true);
  };

  const save = async () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    const repos = await getRepositories();
    if (editingId) {
      await repos.categories.update(editingId, { name: name.trim(), icon, color });
    } else {
      await repos.categories.create({ name: name.trim(), icon, color });
    }
    await refresh();
    setEditorOpen(false);
  };

  const remove = async (id: string) => {
    const ok = await confirm('categories.deleteConfirmTitle', 'categories.deleteConfirmMessage');
    if (!ok) return;
    const repos = await getRepositories();
    await repos.categories.softDelete(id, BUILT_IN_CATEGORY_IDS.other);
    await refresh();
  };

  return (
    <div>
      <PageHeader
        title={t('categories.title')}
        actions={
          <Button size="sm" variant="secondary" onClick={() => openEditor(null)}>
            <Plus size={15} aria-hidden />
            {t('categories.addTitle')}
          </Button>
        }
      />

      <ul className="flex flex-col gap-2">
        {categories.map((category) => {
          const color = CATEGORY_COLOR_HEX[category.color];
          return (
            <li
              key={category.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: color }}>
                <CategoryGlyph name={category.icon} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">{category.nameKey ? t(category.nameKey) : category.name}</p>
                {category.isBuiltIn && <p className="text-[0.7rem] text-fg-2">{t('categories.builtInHint')}</p>}
              </div>
              {!category.isBuiltIn && (
                <>
                  <IconButton label={t('common.edit')} onClick={() => openEditor(category.id)}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton label={t('common.delete')} onClick={() => void remove(category.id)}>
                    <Trash2 size={16} className="text-danger" />
                  </IconButton>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editingId ? t('categories.editTitle') : t('categories.addTitle')}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Input
            label={t('categories.nameLabel')}
            placeholder={t('categories.namePlaceholder')}
            value={name}
            error={nameError ? t('categories.nameRequired') : undefined}
            onChange={(event) => {
              setName(event.target.value);
              if (event.target.value.trim()) setNameError(false);
            }}
            autoFocus
            required
          />

          <div>
            <p className="mb-1.5 text-xs font-medium text-fg-2">{t('categories.iconLabel')}</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_ICONS.map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  aria-pressed={icon === iconName}
                  onClick={() => setIcon(iconName)}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl border transition',
                    icon === iconName ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-300' : 'border-line text-fg-2 hover:text-fg-1',
                  )}
                >
                  <CategoryGlyph name={iconName} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-fg-2">{t('categories.colorLabel')}</p>
            <div className="flex gap-2">
              {ACCENTS.map((accent) => (
                <button
                  key={accent.id}
                  type="button"
                  aria-label={t('accent.' + accent.id)}
                  aria-pressed={color === accent.id}
                  onClick={() => setColor(accent.id)}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition',
                    color === accent.id ? 'border-fg-1 scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: accent.swatch }}
                />
              ))}
            </div>
          </div>

          <div className="mt-2 flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditorOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" className="flex-1">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

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

export function CategoryGlyph({ name }: { name: string }) {
  const Icon = GLYPHS[name] ?? Tag;
  return <Icon size={17} aria-hidden />;
}
