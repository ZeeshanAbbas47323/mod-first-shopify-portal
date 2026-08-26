"use client";

import * as React from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { toast } from "sonner";
import {
  Bold,
  Code,
  Code2,
  Eye,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { uploadImage } from "@/lib/upload-api";
import { apiErrorMessage } from "@/lib/auth-api";
import { cn, imgUrl } from "@/lib/utils";

type Mode = "rich" | "html" | "preview";

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        active && "bg-[#e3e3e3] text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({
  editor,
  uploadFolder,
}: {
  editor: Editor;
  uploadFolder: string;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  };

  const insertImage = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file, uploadFolder);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Image upload failed."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) insertImage(file);
        }}
      />

      <ToolbarButton
        label="Paragraph"
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <Pilcrow className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 !h-5" />

      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Inline code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 !h-5" />

      <ToolbarButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Blockquote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 !h-5" />

      <ToolbarButton label="Add link" active={editor.isActive("link")} onClick={setLink}>
        <Link2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Remove link"
        disabled={!editor.isActive("link")}
        onClick={() => editor.chain().focus().unsetLink().run()}
      >
        <Link2Off className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Insert image"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ImageIcon className="size-4" />
        )}
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 !h-5" />

      <ToolbarButton
        label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="size-4" />
      </ToolbarButton>
    </div>
  );
}

/** Shared typography styles so the editor, HTML preview and the storefront agree. */
const proseClasses = [
  "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-bold",
  "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold",
  "[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold",
  "[&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-sm [&_h4]:font-semibold",
  "[&_p]:my-2",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:my-0.5",
  "[&_a]:text-[#00527c] [&_a]:underline [&_a]:underline-offset-2",
  "[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-lg",
  "[&_hr]:my-4 [&_hr]:border-border",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
  "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse",
  "[&_td]:border [&_td]:border-border [&_td]:p-2",
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-2 [&_th]:text-left",
].join(" ");

/** Point relative <img src> at the API host so previews resolve. */
function resolveImages(html: string): string {
  return html.replace(
    /(<img[^>]+src=")(\/[^"]*)"/g,
    (_m, head: string, src: string) => `${head}${imgUrl(src)}"`
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something…",
  className,
  minHeight = "9rem",
  maxHeight = "18rem",
  uploadFolder = "content",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  /** Editing area min height, e.g. "24rem" for full-page editors. */
  minHeight?: string;
  /** Editing area max height before it scrolls. */
  maxHeight?: string;
  /** Upload folder for images inserted from the toolbar. */
  uploadFolder?: string;
}) {
  const [mode, setMode] = React.useState<Mode>("rich");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Keep the editor in sync when the form resets or the HTML tab is edited.
  React.useEffect(() => {
    if (editor && mode === "rich" && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor, mode]);

  const modeButton = (m: Mode, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setMode(m)}
      className={cn(
        "flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground",
        mode === m && "bg-[#e3e3e3] text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-input bg-muted/40 px-1.5 py-1">
        {mode === "rich" && editor ? (
          <Toolbar editor={editor} uploadFolder={uploadFolder} />
        ) : (
          <span className="px-1 text-xs text-muted-foreground">
            {mode === "html"
              ? "Raw HTML — saved exactly as typed."
              : "Preview of the saved HTML."}
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {modeButton("rich", "Editor", <Pilcrow className="size-3.5" />)}
          {modeButton("html", "HTML", <Code2 className="size-3.5" />)}
          {modeButton("preview", "Preview", <Eye className="size-3.5" />)}
        </div>
      </div>

      {mode === "rich" && (
        <EditorContent
          editor={editor}
          className={cn(
            "overflow-y-auto px-3 py-2 text-sm",
            "[&_.ProseMirror]:outline-none",
            proseClasses,
            "[&_.ProseMirror_p.is-editor-empty:first-child]:before:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child]:before:float-left [&_.ProseMirror_p.is-editor-empty:first-child]:before:h-0 [&_.ProseMirror_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]"
          )}
          style={{ minHeight, maxHeight }}
        />
      )}

      {mode === "html" && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          placeholder="<p>Your HTML…</p>"
          className="block w-full resize-y bg-transparent px-3 py-2 font-mono text-xs leading-relaxed outline-none"
          style={{ minHeight, maxHeight }}
        />
      )}

      {mode === "preview" && (
        <div
          className={cn("overflow-y-auto px-3 py-2 text-sm", proseClasses)}
          style={{ minHeight, maxHeight }}
          dangerouslySetInnerHTML={{ __html: resolveImages(value) }}
        />
      )}
    </div>
  );
}
