import React, { useState } from 'react';

/** Abbreviated 0x3d7b…7122. Full value in title; click to show it in full for selecting. */
export const Hash: React.FC<{ value: string }> = ({ value }) => {
  const [open, setOpen] = useState(false);
  const short = value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
  return (
    <span
      className="hash"
      title={value}
      onClick={() => setOpen((o) => !o)}
      style={{ cursor: 'pointer' }}
    >
      {open ? value : short}
    </span>
  );
};
