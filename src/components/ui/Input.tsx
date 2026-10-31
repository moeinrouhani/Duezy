import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

// No tailwind-merge in this project, so conflicting utilities must never be
// applied together — normal and error colors are separate, mutually exclusive sets.
const FIELD_BASE =
  'w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-fg-1 shadow-card placeholder:text-fg-2/70 ' +
  'focus:outline-none focus:ring-4 transition-[border-color,box-shadow] duration-150 disabled:opacity-50';
const FIELD_NORMAL = 'border-line hover:border-fg-2/40 focus:border-accent-500 focus:ring-accent-500/15';
const FIELD_ERROR = 'anim-shake border-danger hover:border-danger focus:border-danger focus:ring-danger/15';
const fieldClasses = (error?: string) => cn(FIELD_BASE, error ? FIELD_ERROR : FIELD_NORMAL);

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
      {error && (
        <p className="anim-fade-in text-xs text-danger" role="alert">
          {error}
        </p>
      )}
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
      <input aria-invalid={error ? true : undefined} className={cn(fieldClasses(error), className)} {...rest} />
    </Field>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className, ...rest }: TextareaProps) {
  return (
    <Field label={label} htmlFor={rest.id}>
      <textarea className={cn(fieldClasses(), 'min-h-24 resize-y', className)} {...rest} />
    </Field>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className, children, ...rest }: SelectProps) {
  return (
    <Field label={label} htmlFor={rest.id}>
      <div className="relative">
        <select className={cn(fieldClasses(), 'appearance-none pe-9', className)} {...rest}>
          {children}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute inset-y-0 end-3 my-auto text-fg-2"
          aria-hidden
        />
      </div>
    </Field>
  );
}
