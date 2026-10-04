import React from 'react';

export const Timestamp: React.FC<{ value: string }> = ({ value }) => (
  <span className="timestamp">{value}</span>
);
