import React from 'react';
import { Box } from '@mui/material';
import type { BoardCard } from 'shared/types';
import MemoryCard from './MemoryCard';

interface CardGridProps {
  board: BoardCard[];
  rows: number;
  cols: number;
  onCardClick: (cardIndex: number) => void;
  disabled?: boolean;
}

export default function CardGrid({ board, rows, cols, onCardClick, disabled }: CardGridProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: { xs: 1, sm: 1.5 },
        width: '100%',
        maxWidth: `${cols * 160}px`,
        mx: 'auto',
      }}
    >
      {board.map((card) => (
        <MemoryCard
          key={card.index}
          card={card}
          onClick={() => onCardClick(card.index)}
          disabled={disabled}
        />
      ))}
    </Box>
  );
}
