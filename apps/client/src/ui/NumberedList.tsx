import React, { type ReactNode } from 'react';
import styles from './NumberedList.module.css';

export interface NumberedListItem {
  id?: string;
  number: string | number;
  title: string;
  description: ReactNode;
  selected?: boolean;
  onClick?: () => void;
}

export interface NumberedListProps {
  items: NumberedListItem[];
  className?: string;
}

export const NumberedList: React.FC<NumberedListProps> = ({ items, className = '' }) => {
  return (
    <div className={`${styles.list} ${className}`.trim()} role="list">
      {items.map((item, idx) => (
        <button
          key={item.id ?? idx}
          type="button"
          onClick={item.onClick}
          className={`${styles.item} ${item.selected ? styles.itemSelected : ''}`.trim()}
        >
          <span className={styles.number}>{item.number}</span>
          <div className={styles.body}>
            <div className={styles.title}>{item.title}</div>
            <div className={styles.description}>{item.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
};
