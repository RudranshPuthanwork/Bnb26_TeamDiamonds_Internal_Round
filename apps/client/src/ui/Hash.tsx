import React from 'react';

export const Hash: React.FC<{ value: string }> = ({ value }) => (
  <span className="hash">{value}</span>
);
