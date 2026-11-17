export function FionaLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Two arrows forming intercept loop - man-in-the-middle concept */}
      <path
        d="M4 8L8 4L12 8M8 4V14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M20 16L16 20L12 16M16 20V10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <circle
        cx="12"
        cy="12"
        r="2"
        fill="currentColor"
      />
    </svg>
  );
}
