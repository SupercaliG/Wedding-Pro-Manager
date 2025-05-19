'use client';

import { useEffect, useState } from 'react';

interface TypingIndicatorProps {
  isTyping: boolean;
  senderName?: string;
}

/**
 * Component for displaying a typing indicator
 */
export function TypingIndicator({
  isTyping,
  senderName,
}: TypingIndicatorProps) {
  const [dots, setDots] = useState('');

  // Animate the dots
  useEffect(() => {
    if (!isTyping) return;

    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isTyping]);

  if (!isTyping) {
    return null;
  }

  return (
    <div className="flex items-center p-2 text-gray-500 text-sm">
      <div className="flex items-center space-x-2">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-xs">
          {senderName ? `${senderName} is typing${dots}` : `Typing${dots}`}
        </span>
      </div>
    </div>
  );
}