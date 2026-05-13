import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';

/**
 * Paragraph / heading alignment compatible with WordPress:
 * - Inline `style="text-align: …"` (classic + blocks)
 * - Gutenberg `has-text-align-*` classes
 * - Classic `alignleft` / `aligncenter` / `alignright` / `alignjustify`
 */
const WordPressTextAlign = TextAlign.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: this.options.defaultAlignment,
            parseHTML: (element) => {
              const el = element as HTMLElement;
              const styleAlign = el.style?.textAlign?.trim();
              if (styleAlign && this.options.alignments.includes(styleAlign)) {
                return styleAlign;
              }
              if (el.classList?.length) {
                for (const cls of el.classList) {
                  const m = /^has-text-align-(left|center|right|justify)$/.exec(cls);
                  if (m && this.options.alignments.includes(m[1])) {
                    return m[1];
                  }
                }
                if (el.classList.contains('alignleft')) return 'left';
                if (el.classList.contains('aligncenter')) return 'center';
                if (el.classList.contains('alignright')) return 'right';
                if (el.classList.contains('alignjustify')) return 'justify';
              }
              return this.options.defaultAlignment;
            },
            renderHTML: (attributes) => {
              if (!attributes.textAlign) {
                return {};
              }
              return { style: `text-align: ${attributes.textAlign}` };
            },
          },
        },
      },
    ];
  },
});

export function createRichTextExtensions() {
  return [
    StarterKit.configure({
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
          class: null,
        },
      },
    }),
    Image.configure({
      inline: false,
      allowBase64: false,
      HTMLAttributes: {
        class: 'max-w-full h-auto rounded-md',
      },
    }),
    WordPressTextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),
    TableKit.configure({
      table: {
        resizable: false,
        HTMLAttributes: {
          class: 'border-collapse border border-gray-300 w-full my-4',
        },
      },
      tableCell: {
        HTMLAttributes: {
          class: 'border border-gray-300 px-2 py-1 align-top',
        },
      },
      tableHeader: {
        HTMLAttributes: {
          class: 'border border-gray-300 px-2 py-1 bg-gray-100 font-semibold',
        },
      },
    }),
  ];
}
