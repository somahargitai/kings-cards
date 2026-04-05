import React from 'react';
import { Box, Typography } from '@mui/material';
import type { BoardCard } from 'shared/types';

interface MemoryCardProps {
  card: BoardCard;
  onClick: () => void;
  disabled?: boolean;
}

export default function MemoryCard({ card, onClick, disabled }: MemoryCardProps) {
  const isFlipped = card.state === 'face_up' || card.state === 'matched';
  const isMatched = card.state === 'matched';
  const isClickable = card.state === 'face_down' && !disabled;

  return (
    <Box
      onClick={isClickable ? onClick : undefined}
      sx={{
        perspective: '1000px',
        cursor: isClickable ? 'pointer' : 'default',
        aspectRatio: '1/1',
        minHeight: 100,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.4s ease',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front (face-down) */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: 2,
            background: 'linear-gradient(135deg, #1565C0 0%, #1976D2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isClickable ? 3 : 1,
            border: '2px solid rgba(255,255,255,0.15)',
            '&:hover': isClickable
              ? { boxShadow: 6, transform: 'scale(1.03)', transition: 'transform 0.15s' }
              : {},
          }}
        >
          <Typography
            sx={{ fontSize: '1.5rem', userSelect: 'none', opacity: 0.5 }}
          >
            ♔
          </Typography>
        </Box>

        {/* Back (face-up / matched) */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: 2,
            bgcolor: isMatched ? '#E8F5E9' : 'white',
            opacity: isMatched ? 0.75 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 2,
            border: isMatched ? '2px solid #4CAF50' : '2px solid #E0E0E0',
            p: 1,
          }}
        >
          <Typography
            variant="body1"
            fontWeight={600}
            textAlign="center"
            sx={{ wordBreak: 'break-word', lineHeight: 1.3 }}
          >
            {card.content ?? ''}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
