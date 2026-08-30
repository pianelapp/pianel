import React from 'react';

interface MetronomeIconProps {
  className?: string;
}

export function MetronomeIcon({ className }: MetronomeIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 11.4V9.1" />
      <path d="m12 17 6.59-6.59" />
      <path d="m15.05 5.7-.218-.691a3 3 0 0 0-5.663 0L4.418 19.695A1 1 0 0 0 5.37 21h13.253a1 1 0 0 0 .951-1.31L18.45 16.2" />
      <circle cx="20" cy="9" r="2" />
    </svg>
  );
}
