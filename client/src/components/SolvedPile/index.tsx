import React from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReplayIcon from '@mui/icons-material/Replay';

interface SolvedPileProps {
  matchedPairs: number;
  totalPairs: number;
  showFlipBack?: boolean;
  onFlipBack?: () => void;
}

export default function SolvedPile({ matchedPairs, totalPairs, showFlipBack, onFlipBack }: SolvedPileProps) {
  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        borderRadius: 2,
        minWidth: { xs: '100%', md: 160 },
      }}
    >
      <Stack spacing={1} alignItems="center">
        <CheckCircleIcon color="success" />
        <Typography variant="subtitle2" color="text.secondary">
          Matched
        </Typography>
        <Typography variant="h4" fontWeight={700} color="success.main">
          {matchedPairs}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          of {totalPairs} pairs
        </Typography>
        <Box sx={{ width: '100%', height: 6, bgcolor: 'grey.200', borderRadius: 3, overflow: 'hidden' }}>
          <Box
            sx={{
              height: '100%',
              width: `${totalPairs > 0 ? (matchedPairs / totalPairs) * 100 : 0}%`,
              bgcolor: 'success.main',
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }}
          />
        </Box>
        {showFlipBack && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<ReplayIcon />}
            onClick={onFlipBack}
            fullWidth
          >
            Flip Back
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
