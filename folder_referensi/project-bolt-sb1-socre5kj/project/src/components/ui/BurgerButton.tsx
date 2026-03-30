interface BurgerButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export default function BurgerButton({ isOpen, onClick }: BurgerButtonProps) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-lg bg-white/5 border border-white/8 hover:bg-white/10 hover:border-purple-400/30 transition-all duration-300"
      aria-label="Toggle menu"
    >
      <div className="w-6 h-5 flex flex-col justify-between">
        <span
          className={`block h-0.5 bg-gray-200 rounded transition-all duration-300 ${
            isOpen ? 'rotate-45 translate-y-2' : ''
          }`}
        ></span>
        <span
          className={`block h-0.5 bg-gray-200 rounded transition-all duration-300 ${
            isOpen ? 'opacity-0' : ''
          }`}
        ></span>
        <span
          className={`block h-0.5 bg-gray-200 rounded transition-all duration-300 ${
            isOpen ? '-rotate-45 -translate-y-2' : ''
          }`}
        ></span>
      </div>
    </button>
  );
}
