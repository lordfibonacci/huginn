import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Mention from '@tiptap/extension-mention'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MentionSuggestionList, type MentionItem, type MentionSuggestionListHandle } from './MentionSuggestionList'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  /** Members available for @-mention. When undefined or empty, mentions are disabled. */
  mentionMembers?: MentionItem[]
}

export function RichTextEditor({ content, onChange, placeholder, mentionMembers }: RichTextEditorProps) {
  const { t } = useTranslation()
  // Hold the latest member list in a ref so the suggestion source always sees
  // current data — Tiptap captures the items() function once at extension
  // configuration time.
  const membersRef = useRef<MentionItem[]>(mentionMembers ?? [])
  useEffect(() => { membersRef.current = mentionMembers ?? [] }, [mentionMembers])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: true }),
      Placeholder.configure({ placeholder: placeholder || t('richText.placeholder') }),
      Mention.configure({
        HTMLAttributes: {
          class: 'inline-block rounded px-1 bg-huginn-accent-soft text-huginn-accent font-medium',
        },
        renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
        suggestion: {
          char: '@',
          items: ({ query }) => {
            const q = query.toLowerCase()
            return membersRef.current
              .filter(m => m.label.toLowerCase().includes(q))
              .slice(0, 6)
          },
          render: () => {
            let component: ReactRenderer<MentionSuggestionListHandle> | null = null
            let popup: HTMLDivElement | null = null

            const positionPopup = (rect: DOMRect | null) => {
              if (!popup || !rect) return
              popup.style.position = 'absolute'
              popup.style.top = `${window.scrollY + rect.bottom + 4}px`
              popup.style.left = `${window.scrollX + rect.left}px`
              popup.style.zIndex = '70'
            }

            return {
              onStart: (props) => {
                component = new ReactRenderer(MentionSuggestionList, {
                  props,
                  editor: props.editor,
                })
                popup = document.createElement('div')
                popup.appendChild(component.element)
                document.body.appendChild(popup)
                positionPopup(props.clientRect?.() ?? null)
              },
              onUpdate: (props) => {
                component?.updateProps(props)
                positionPopup(props.clientRect?.() ?? null)
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') {
                  popup?.remove()
                  return true
                }
                return component?.ref?.onKeyDown(props.event) ?? false
              },
              onExit: () => {
                popup?.remove()
                component?.destroy()
                popup = null
                component = null
              },
            }
          },
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none outline-none min-h-[80px] px-4 py-3 break-words [overflow-wrap:anywhere]',
      },
    },
  })

  // Sync external content changes (e.g. switching cards). Skip if the editor
  // is focused — the user is actively typing and an in-flight prop update
  // would clobber their keystrokes.
  useEffect(() => {
    if (!editor) return
    if (editor.isFocused) return
    if (content === editor.getHTML()) return
    editor.commands.setContent(content)
  }, [content, editor])

  if (!editor) return null

  return (
    <div className="bg-huginn-surface rounded-lg border border-huginn-border focus-within:border-huginn-accent transition-colors">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-huginn-border">
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title={t('richText.bold')}
        >
          <span className="font-bold text-xs">B</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title={t('richText.italic')}
        >
          <span className="italic text-xs">I</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title={t('richText.strike')}
        >
          <span className="line-through text-xs">S</span>
        </ToolbarButton>
        <div className="w-px h-4 bg-huginn-border mx-1" />
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title={t('richText.bulletList')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M3 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm3.75-1.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5ZM6 8a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 8Zm.75 3.25a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5ZM4 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title={t('richText.orderedList')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M2.003 2.5a.5.5 0 0 1 .723-.447l.276.138a.5.5 0 0 1-.276.862v1.199a.5.5 0 0 1-1 0v-1.5a.5.5 0 0 1 .277-.252ZM6 3.75a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 3.75ZM6 8a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 8Zm.75 3.25a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title={t('richText.codeBlock')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M5.78 4.22a.75.75 0 0 0-1.06 0l-3.5 3.5a.75.75 0 0 0 0 1.06l3.5 3.5a.75.75 0 0 0 1.06-1.06L2.81 8.25l2.97-2.97a.75.75 0 0 0 0-1.06Zm4.44 0a.75.75 0 1 0-1.06 1.06l2.97 2.97-2.97 2.97a.75.75 0 1 0 1.06 1.06l3.5-3.5a.75.75 0 0 0 0-1.06l-3.5-3.5Z" />
          </svg>
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolbarButton({ active, onClick, title, children }: {
  active: boolean; onClick: () => void; title: string; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
        active
          ? 'bg-huginn-accent/20 text-huginn-accent'
          : 'text-huginn-text-muted hover:text-white hover:bg-huginn-surface'
      }`}
    >
      {children}
    </button>
  )
}
