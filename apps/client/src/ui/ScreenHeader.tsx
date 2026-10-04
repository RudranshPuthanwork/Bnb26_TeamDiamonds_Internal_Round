import React, { type ReactNode } from 'react';
import styles from './ScreenHeader.module.css';
import { Rule } from './Rule';
import { COPY } from '../copy';

export interface ScreenHeaderProps {
  collection?: string;
  role?: string;
  page?: string;
  title?: string;
  links?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  collection = COPY.header.defaultCollection,
  role = COPY.header.defaultRole,
  page,
  title,
  links,
  children,
  className = '',
}) => {
  return (
    <header className={`${styles.header} ${className}`.trim()}>
      <div className={styles.runningLine}>
        <div className={styles.breadcrumb}>
          <span>{[COPY.brand.name, collection, role, page].filter(Boolean).join(COPY.header.divider)}</span>
        </div>
        {links && <nav className={styles.links}>{links}</nav>}
      </div>

      {title && (
        <div className={styles.titleArea}>
          <h1 className={styles.title}>{title}</h1>
        </div>
      )}

      {children && <div className={styles.extraContent}>{children}</div>}

      <Rule double className={styles.headerRule} />
    </header>
  );
};
