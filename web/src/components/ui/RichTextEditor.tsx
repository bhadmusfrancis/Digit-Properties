'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { createRichTextExtensions } from '@/lib/tiptap-rich-text-extensions';

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
  const extensions = useMemo(() => createRichTextExtensions(), []);

  const editor = useEditor({
    extensions,
    content: value || '',
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-slate max-w-none min-h-[120px] px-3 py-2 focus:outline-none prose-table:border-collapse prose-th:border prose-td:border prose-img:max-w-full',
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

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt('Image URL', 'https://');
    if (url?.trim()) {
      editor.chain().focus().setImage({ src: url.trim() }).run();
    }
  };

  return (
    <div className={`rounded-lg border border-gray-300 bg-white overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          Undo
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          Redo
        </ToolbarButton>
        <span className="mx-1 w-px bg-gray-200" />
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
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline"
        >
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <span className="line-through">S</span>
        </ToolbarButton>
        <span className="mx-1 w-px bg-gray-200" />
        <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Link">
          Link
        </ToolbarButton>
        <ToolbarButton onClick={addImage} title="Image from URL">
          Image
        </ToolbarButton>
        <span className="mx-1 w-px bg-gray-200" />
        {([1, 2, 3, 4] as const).map((level) => (
          <ToolbarButton
            key={level}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            active={editor.isActive('heading', { level })}
            title={`Heading ${level}`}
          >
            H{level}
          </ToolbarButton>
        ))}
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive('paragraph') && !editor.isActive('heading')}
          title="Normal text"
        >
          Normal
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
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Quote"
        >
          Quote
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Inline code"
        >
          {'</>'}
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal rule"
        >
          HR
        </ToolbarButton>
        <span className="mx-1 w-px bg-gray-200" />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title="Align left"
        >
          L
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title="Align center"
        >
          C
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title="Align right"
        >
          R
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          active={editor.isActive({ textAlign: 'justify' })}
          title="Justify"
        >
          J
        </ToolbarButton>
        <span className="mx-1 w-px bg-gray-200" />
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
          title="Insert table (3×3)"
        >
          Table
        </ToolbarButton>
      </div>
      <p className="border-b border-gray-100 bg-gray-50/80 px-2 py-1 text-[11px] text-gray-500">
        Paste from WordPress (or similar) keeps headings, lists, links, images, alignment, and tables when possible.
      </p>
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
