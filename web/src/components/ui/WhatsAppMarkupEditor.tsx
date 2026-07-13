'use client';

import { useCallback, useRef } from 'react';
import { formatWhatsAppMarkupToHtml } from '@/lib/whatsapp-description';

type WhatsAppMarkupEditorProps = {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
  className?: string;
};

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  value: string,
  onChange: (text: string) => void
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end);
  const wrapped = `${before}${selected || 'text'}${after}`;
  const next = value.slice(0, start) + wrapped + value.slice(end);
  onChange(next);

  requestAnimationFrame(() => {
    textarea.focus();
    const selStart = start + before.length;
    const selEnd = selStart + (selected || 'text').length;
    textarea.setSelectionRange(selStart, selEnd);
  });
}

export function WhatsAppMarkupEditor({
  value,
  onChange,
  placeholder = 'Describe the property…',
  minHeight = '180px',
  disabled = false,
  className = '',
}: WhatsAppMarkupEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyWrap = useCallback(
    (before: string, after: string) => {
      const el = textareaRef.current;
      if (!el || disabled) return;
      wrapSelection(el, before, after, value, onChange);
    },
    [value, onChange, disabled]
  );

  const ToolbarButton = ({
    onClick,
    children,
    title,
  }: { onClick: () => void; children: React.ReactNode; title?: string }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="rounded p-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );

  return (
    <div className={`rounded-lg border border-gray-300 bg-white overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1">
        <ToolbarButton onClick={() => applyWrap('*', '*')} title="Bold (*text*)">
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => applyWrap('_', '_')} title="Italic (_text_)">
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => applyWrap('~', '~')} title="Strikethrough (~text~)">
          <span className="line-through">S</span>
        </ToolbarButton>
      </div>
      <p className="border-b border-gray-100 bg-gray-50/80 px-2 py-1 text-[11px] text-gray-500">
        WhatsApp formatting: *bold*, _italic_, ~strikethrough~. Line breaks are preserved.
      </p>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="block w-full resize-y border-0 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
        style={{ minHeight }}
      />
      {value.trim() ? (
        <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">Preview</p>
          <div
            className="text-sm text-gray-700 leading-relaxed break-words [&_strong]:font-semibold [&_em]:italic [&_del]:line-through"
            dangerouslySetInnerHTML={{ __html: formatWhatsAppMarkupToHtml(value) }}
          />
        </div>
      ) : null}
    </div>
  );
}
