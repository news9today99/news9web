import { useRef, useEffect } from "react";
import { Bold, Italic, Heading2, List, Link as LinkIcon, Quote, Undo2, Redo2 } from "lucide-react";

// Simple contenteditable rich text editor. Stores HTML.
export default function RichTextEditor({ value, onChange, testId }) {
  const ref = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    if (!initialized.current) {
      ref.current.innerHTML = value || "";
      initialized.current = true;
    }
  }, [value]);

  const exec = (cmd, arg = null) => {
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
    ref.current?.focus();
  };

  const link = () => {
    const url = window.prompt("URL:");
    if (url) exec("createLink", url);
  };

  const btn = "p-2 hover:bg-slate-100 transition-colors border border-transparent hover:border-[#E2E8F0]";

  return (
    <div className="border border-[#E2E8F0]" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-1 border-b border-[#E2E8F0] p-1 bg-slate-50">
        <button type="button" onClick={() => exec("bold")} className={btn} title="Bold"><Bold className="w-4 h-4"/></button>
        <button type="button" onClick={() => exec("italic")} className={btn} title="Italic"><Italic className="w-4 h-4"/></button>
        <button type="button" onClick={() => exec("formatBlock", "<h2>")} className={btn} title="Heading"><Heading2 className="w-4 h-4"/></button>
        <button type="button" onClick={() => exec("formatBlock", "<blockquote>")} className={btn} title="Quote"><Quote className="w-4 h-4"/></button>
        <button type="button" onClick={() => exec("insertUnorderedList")} className={btn} title="List"><List className="w-4 h-4"/></button>
        <button type="button" onClick={link} className={btn} title="Link"><LinkIcon className="w-4 h-4"/></button>
        <div className="flex-1" />
        <button type="button" onClick={() => exec("undo")} className={btn} title="Undo"><Undo2 className="w-4 h-4"/></button>
        <button type="button" onClick={() => exec("redo")} className={btn} title="Redo"><Redo2 className="w-4 h-4"/></button>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={() => onChange(ref.current.innerHTML)}
        className="min-h-[200px] max-h-[400px] overflow-y-auto p-3 focus:outline-none font-body prose prose-sm max-w-none"
        data-testid={testId ? `${testId}-area` : undefined}
      />
    </div>
  );
}
