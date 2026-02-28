'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
  className?: string;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your content…',
  minHeight = '200px',
  disabled = false,
  className = '',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none min-h-[120px] px-3 py-2 focus:outline-none',
      },
      handleDOMEvents: {
        blur: () => {
          if (editor) onChange(editor.getHTML());
        },
      },
    },
  });

  const lastValueRef = useRef(value);
  useEffect(() => {
    if (!editor) return;
    const next = value ?? '';
    if (next !== lastValueRef.current) {
      lastValueRef.current = next;
      const current = editor.getHTML();
      if (next !== current) editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [value, editor]);

  const onUpdate = useCallback(() => {
    if (editor) {
      const html = editor.getHTML();
      lastValueRef.current = html;
      onChange(html);
    }
  }, [editor, onChange]);

  useEffect(() => {
    if (!editor) return;
    editor.on('update', onUpdate);
    return () => {
      editor.off('update', onUpdate);
    };
  }, [editor, onUpdate]);

  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) {
    return (
      <div className={`rounded-lg border border-gray-300 bg-gray-50 ${className}`} style={{ minHeight }}>
        <div className="p-3 text-gray-500 text-sm">Loading editor…</div>
      </div>
    );
  }

  const ToolbarButton = ({
    onClick,
    active,
    children,
    title,
  }: { onClick: () => void; active?: boolean; children: React.ReactNode; title?: string }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded p-1.5 text-sm font-medium transition ${active ? 'bg-primary-100 text-primary-800' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {children}
    </button>
  );

  return (
    <div className={`rounded-lg border border-gray-300 bg-white overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <span className="italic">I</span>
        </ToolbarButton>
        <span className="mx-1 w-px bg-gray-200" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          H3
        </ToolbarButton>
        <span className="mx-1 w-px bg-gray-200" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          1. List
        </ToolbarButton>
      </div>
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
