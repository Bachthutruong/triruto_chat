// src/components/layout/DynamicTimeDisplay.tsx
'use client';
import { useState, useEffect } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { vi } from 'date-fns/locale';

type DynamicTimeDisplayProps = {
  timestamp: Date | string | number | undefined;
  type: 'distance' | 'format';
  formatString?: string;
  className?: string;
};

export function DynamicTimeDisplay({ timestamp, type, formatString = 'HH:mm dd/MM', className }: DynamicTimeDisplayProps) {
  const [displayTime, setDisplayTime] = useState<string>('...'); // Placeholder

  useEffect(() => {
    if (timestamp) {
      try {
        const dateObj = new Date(timestamp);
        if (isNaN(dateObj.getTime())) { // Check if date is valid
          setDisplayTime('Ngày không hợp lệ');
          return;
        }

        if (type === 'distance') {
          setDisplayTime(formatDistanceToNowStrict(dateObj, { addSuffix: true, locale: vi }));
        } else {
          setDisplayTime(format(dateObj, formatString, { locale: vi }));
        }
      } catch (error) {
        console.error("Error formatting date:", error);
        setDisplayTime('Lỗi ngày');
      }
    } else {
      setDisplayTime('N/A');
    }
  }, [timestamp, type, formatString]);

  return <span className={className}>{displayTime}</span>;
}
