import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

const FIELD_CLASSES =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-fg-1 placeholder:text-fg-2/70 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 transition disabled:opacity-50';

interface FieldProps {
  label?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}

export function Field({ label, error, children, htmlFor }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-medium text-fg-2">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...rest }: InputProps) {
  return (
    <Field label={label} error={error} htmlFor={rest.id}>
      <input className={cn(FIELD_CLASSES, className)} {...rest} />
    </Field>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className, ...rest }: TextareaProps) {
  return (
    <Field label={label} htmlFor={rest.id}>
      <textarea className={cn(FIELD_CLASSES, 'min-h-24 resize-y', className)} {...rest} />
    </Field>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className, children, ...rest }: SelectProps) {
  return (
    <Field label={label} htmlFor={rest.id}>
      <select className={cn(FIELD_CLASSES, 'appearance-none', className)} {...rest}>
        {children}
      </select>
    </Field>
  );
}
