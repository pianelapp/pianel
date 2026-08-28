import X from 'lucide-react/dist/esm/icons/x';
import Plus from 'lucide-react/dist/esm/icons/plus';
import { bindingLabel } from './bindingLabel';
import type { ControlBinding } from '../../store';

interface ActionBindingRowProps {
  actionId: string;
  label: string;
  bindings: ControlBinding[];
  isLightMode: boolean;
  onAdd: () => void;
  onRemove: (bindingId: string) => void;
}

export function ActionBindingRow({
  actionId,
  label,
  bindings,
  isLightMode,
  onAdd,
  onRemove,
}: ActionBindingRowProps) {
  const labelClass = isLightMode ? 'text-zinc-700' : 'text-zinc-300';
  const valueClass = isLightMode ? 'text-zinc-600' : 'text-zinc-400';
  const accentClass = isLightMode ? 'text-cyan-700' : 'text-cyan-400';
  const removeClass = isLightMode ? 'text-red-600' : 'text-red-400';

  return (
    <div data-hf-action={actionId} className="flex flex-col py-1.5">
      <div className="flex items-center gap-2">
        <span className={`min-w-0 truncate text-sm font-medium ${labelClass}`}>
          {label}
        </span>
        {bindings.length === 0 && (
          <span className={`ml-auto shrink-0 text-xs ${valueClass}`}>
            unassigned
          </span>
        )}
        <button
          type="button"
          data-hf-add
          aria-label={`Add a binding for ${label}`}
          onClick={onAdd}
          className={`shrink-0 tap-target flex items-center justify-center ${
            bindings.length === 0 ? '' : 'ml-auto'
          } ${accentClass}`}>
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {bindings.map(binding => (
        <div key={binding.id} className="flex items-center gap-2 pl-3">
          <span
            data-hf-binding
            className={`min-w-0 truncate text-xs ${valueClass}`}>
            {bindingLabel(binding)}
          </span>
          <button
            type="button"
            data-hf-remove
            aria-label={`Remove ${bindingLabel(binding)}`}
            onClick={() => onRemove(binding.id)}
            className={`ml-auto shrink-0 tap-target flex items-center justify-center ${removeClass}`}>
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
