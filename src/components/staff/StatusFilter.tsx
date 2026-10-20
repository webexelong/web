interface StatusFilterProps {
  activeFilter: string;
  onFilterChange: (status: 'all' | 'pending' | 'preparing' | 'ready' | 'paid') => void;
  counts: {
    all: number;
    pending: number;
    preparing: number;
    ready: number;
    paid: number;
  };
}

const FILTERS = [
  { key: 'all', label: 'Tất cả', icon: 'apps', color: 'gray' },
  { key: 'pending', label: 'Chờ xác nhận', icon: 'schedule', color: 'yellow' },
  { key: 'preparing', label: 'Đang chuẩn bị', icon: 'restaurant', color: 'blue' },
  { key: 'ready', label: 'Sẵn sàng', icon: 'check_circle', color: 'green' },
  { key: 'paid', label: 'Đã thanh toán', icon: 'paid', color: 'gray' },
];

export default function StatusFilter({ activeFilter, onFilterChange, counts }: StatusFilterProps) {
  const getButtonClasses = (filterKey: string, color: string) => {
    const isActive = activeFilter === filterKey;
    
    const colorClasses = {
      gray: isActive 
        ? 'bg-primary dark:bg-orange-600 text-white border-primary dark:border-orange-600'
        : 'bg-surface-container-lowest dark:bg-gray-800 text-on-surface-variant dark:text-gray-400 border-outline-variant/30 dark:border-gray-700 hover:bg-primary/5 dark:hover:bg-orange-500/10',
      yellow: isActive 
        ? 'bg-amber-700 dark:bg-amber-600 text-white border-amber-700 dark:border-amber-600'
        : 'bg-surface-container-lowest dark:bg-gray-800 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 hover:bg-amber-50 dark:hover:bg-amber-900/20',
      blue: isActive 
        ? 'bg-blue-700 dark:bg-blue-600 text-white border-blue-700 dark:border-blue-600'
        : 'bg-surface-container-lowest dark:bg-gray-800 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20',
      green: isActive 
        ? 'bg-emerald-700 dark:bg-emerald-600 text-white border-emerald-700 dark:border-emerald-600'
        : 'bg-surface-container-lowest dark:bg-gray-800 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
    };

    return `flex items-center gap-2 px-4 py-3 rounded-2xl border font-bold text-xs transition-all ${
      colorClasses[color as keyof typeof colorClasses]
    } ${isActive ? 'shadow-md' : 'hover:shadow-sm'}`;
  };

  return (
    <div className="mb-6">
      {/* Desktop: Horizontal Filter */}
      <div className="hidden md:flex gap-3 overflow-x-auto pb-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => onFilterChange(filter.key as any)}
            className={getButtonClasses(filter.key, filter.color)}
          >
            <span className="material-symbols-outlined text-xl">{filter.icon}</span>
            <span className="whitespace-nowrap">{filter.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeFilter === filter.key 
                ? 'bg-white/20' 
                : 'bg-surface-container'
            }`}>
              {counts[filter.key as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      {/* Mobile: Dropdown Filter */}
      <div className="md:hidden">
          <label className="block text-xs font-bold text-on-surface-variant dark:text-gray-400 mb-2">
          Lọc theo trạng thái
        </label>
        <select
          value={activeFilter}
          onChange={(e) => onFilterChange(e.target.value as any)}
          className="w-full px-4 py-3 border border-outline-variant/30 dark:border-gray-700 rounded-2xl font-bold text-on-surface dark:text-gray-200 bg-surface-container-lowest dark:bg-gray-800 focus:ring-2 focus:ring-primary/20 dark:focus:ring-orange-500/20 focus:border-primary dark:focus:border-orange-500"
        >
          {FILTERS.map((filter) => (
            <option key={filter.key} value={filter.key}>
              {filter.label} ({counts[filter.key as keyof typeof counts]})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
