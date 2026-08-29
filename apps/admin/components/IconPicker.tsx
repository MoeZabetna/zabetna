"use client";

import { CATEGORY_ICONS } from "@/lib/icons";

export function IconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-2 rounded-md border border-neutral-200 p-3">
      {CATEGORY_ICONS.map(({ name, icon: Icon }) => {
        const selected = value === name;
        return (
          <button
            key={name}
            type="button"
            title={name}
            onClick={() => onChange(name)}
            className={`flex h-9 w-9 items-center justify-center rounded-md border ${
              selected
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
            }`}
          >
            <Icon size={18} />
          </button>
        );
      })}
    </div>
  );
}
