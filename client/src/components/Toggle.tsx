type Props = {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  description?: string;
};

export function Toggle({ label, checked, onChange, description }: Props) {
  return (
    <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div>
        <div className="font-semibold">{label}</div>
        {description && <p className="text-sm text-slate-600">{description}</p>}
      </div>
    </label>
  );
}
