import React, { type ReactNode } from 'react';
import styles from './Footnote.module.css';
import { COPY } from '../copy';

export interface FootnoteProps {
  children?: ReactNode;
  className?: string;
}

export const Footnote: React.FC<FootnoteProps> = ({
  children = COPY.brand.sampleNotice,
  className = '',
}) => {
  return <p className={`${styles.footnote} ${className}`.trim()}>{children}</p>;
};
