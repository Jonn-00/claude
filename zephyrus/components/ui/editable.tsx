"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Text you can click to change in place. Enter or clicking away saves, Esc
 * puts it back. It looks like text until you hover it, so screens stay calm.
 */
export function Editable({
  value,
  onSave,
  label,
  placeholder = "Untitled",
  className,
  inputClassName,
  multiline = false,
  allowEmpty = false,
  startEditing = false,
  onDone,
}: {
  value: string;
  onSave: (v: string) => void;
  /** Accessible name, e.g. "Stage name". */
  label: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  allowEmpty?: boolean;
  startEditing?: boolean;
  onDone?: () => void;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  useEffect(() => {
    if (startEditing) setEditing(true);
  }, [startEditing]);
  useLayoutEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);

  const commit = () => {
    const v = draft.trim();
    setEditing(false);
    if ((v || allowEmpty) && v !== value) onSave(v);
    onDone?.();
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
    onDone?.();
  };

  if (editing) {
    const common = {
      ref,
      value: draft,
      "aria-label": label,
      placeholder,
      onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === "Escape") cancel();
        else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          commit();
        }
      },
      onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
      className: cn(
        "w-full min-w-0 rounded-[6px] bg-surface px-1 -mx-1 text-inherit outline-none ring-1 ring-sand/70",
        multiline && "resize-none py-0.5",
        inputClassName,
      ),
    };
    return multiline ? <textarea rows={3} {...common} /> : <input {...common} />;
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${value || placeholder}. Edit`}
      title="Click to edit"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          e.stopPropagation();
          setEditing(true);
        }
      }}
      className={cn(
        "-mx-1 cursor-text rounded-[6px] px-1 decoration-sand/60 decoration-dotted underline-offset-4 transition-colors hover:bg-active/60 hover:underline",
        !value && "text-faint",
        className,
      )}
    >
      {value || placeholder}
    </span>
  );
}
