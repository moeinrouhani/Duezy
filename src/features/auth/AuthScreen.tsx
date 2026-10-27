import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { syncNow } from '../../sync/engine';
import { ApiError } from '../../sync/api';

type AuthMode = 'login' | 'register';

/**
 * Standalone sign-in / registration page. Signing in is OPTIONAL — the app is
 * fully usable without an account; auth only enables cross-device sync.
 */
export function AuthScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showSnackbar = useUiStore((s) => s.showSnackbar);
  const user = useAuthStore((s) => s.user);
  const busy = useAuthStore((s) => s.busy);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Already signed in (or just signed in) → back to the app.
  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    try {
      if (mode === 'login') {
        await signIn(username.trim(), password);
        showSnackbar(t('auth.welcomeBackToast'));
      } else {
        await signUp(username.trim(), password, displayName.trim() || undefined);
        showSnackbar(t('auth.accountCreatedToast'));
      }
      void syncNow();
      navigate('/', { replace: true });
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : 'server';
      setError(t(`auth.error.${code}`, { defaultValue: t('auth.error.server') }));
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src="/icons/favicon.svg" alt="" width={56} height={56} />
          <h1 className="text-xl font-bold">{t('app.name')}</h1>
          <p className="text-xs text-fg-2">{t('auth.accountHint')}</p>
        </div>

        <form
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm"
        >
          <SegmentedControl<AuthMode>
            label={t('auth.loginTab')}
            value={mode}
            onChange={(next) => {
              setMode(next);
              setError(null);
            }}
            options={[
              { value: 'login', label: t('auth.loginTab') },
              { value: 'register', label: t('auth.registerTab') },
            ]}
          />

          <Input
            label={t('auth.usernameLabel')}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            dir="ltr"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            minLength={3}
            maxLength={32}
            autoFocus
          />
          {mode === 'register' && <p className="-mt-3 text-[0.7rem] leading-5 text-fg-2">{t('auth.usernameHint')}</p>}

          <Input
            label={t('auth.passwordLabel')}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            dir="ltr"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={8}
          />
          {mode === 'register' && <p className="-mt-3 text-[0.7rem] leading-5 text-fg-2">{t('auth.passwordHint')}</p>}

          {mode === 'register' && (
            <Input
              label={t('auth.displayNameLabel')}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={60}
            />
          )}

          {error && (
            <p className="text-xs leading-5 text-danger" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="mt-1 w-full" disabled={busy}>
            {t(mode === 'login' ? 'auth.loginAction' : 'auth.registerAction')}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="mx-auto mt-6 flex items-center gap-1.5 text-xs text-fg-2 transition hover:text-fg-1"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" aria-hidden />
          {t('common.back')}
        </button>
      </div>
    </div>
  );
}
