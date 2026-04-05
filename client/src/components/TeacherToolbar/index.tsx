import React from 'react';
import {
  AppBar,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Toolbar,
  Typography,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import StyleIcon from '@mui/icons-material/Style';
import { FLIP_DELAY_OPTIONS } from '../../constants/flipDelay';

interface TeacherToolbarProps {
  gameTitle: string;
  flipBackDelay: number;
  participantCount: number;
  onDelayChange: (delay: number) => void;
  onEndGame: () => void;
}


export default function TeacherToolbar({
  gameTitle,
  flipBackDelay,
  participantCount,
  onDelayChange,
  onEndGame,
}: TeacherToolbarProps) {
  return (
    <AppBar position="static" color="default" elevation={2}>
      <Toolbar sx={{ gap: 2, flexWrap: 'wrap' }}>
        <StyleIcon color="primary" />
        <Typography variant="subtitle1" fontWeight={600} sx={{ flexGrow: 1 }} noWrap>
          {gameTitle}
        </Typography>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Flip delay</InputLabel>
          <Select
            value={flipBackDelay}
            label="Flip delay"
            onChange={(e) => onDelayChange(Number(e.target.value))}
          >
            {FLIP_DELAY_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Chip icon={<PeopleIcon />} label={participantCount} variant="outlined" />

        <Button variant="outlined" color="error" size="small" onClick={onEndGame}>
          End Game
        </Button>
      </Toolbar>
    </AppBar>
  );
}
