import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import { useSocketContext } from '../../context/SocketContext';
import CardGrid from '../../components/CardGrid';
import SolvedPile from '../../components/SolvedPile';
import TeacherToolbar from '../../components/TeacherToolbar';
import type { GameSessionState, BoardCard, Participant } from 'shared/types';
import { sessionsApi, SessionCreated } from '../../services/api';

type Phase = 'loading' | 'waiting' | 'active' | 'completed' | 'abandoned';

export default function GameSession() {
  const { id: gameId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { connect, disconnect } = useSocketContext();
  const socketRef = useRef<Socket | null>(null);

  const sessionData = location.state as SessionCreated | null;
  const [sessionId, setSessionId] = useState(sessionData?.sessionId ?? '');
  const [joinCode, setJoinCode] = useState(sessionData?.joinCode ?? '');
  const [shareableLink, setShareableLink] = useState(sessionData?.shareableLink ?? '');

  const [phase, setPhase] = useState<Phase>('loading');
  const [gameState, setGameState] = useState<Partial<GameSessionState>>({});
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [board, setBoard] = useState<BoardCard[]>([]);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<{ totalPairs: number; totalFlips: number; duration: number } | null>(null);

  useEffect(() => {
    if (!sessionId) {
      navigate('/dashboard');
      return;
    }

    const socket = connect();
    socketRef.current = socket;

    socket.emit('teacher:join', { sessionId });

    socket.on('session:state', (state: GameSessionState) => {
      setGameState(state);
      setBoard(state.board);
      setParticipants(state.participants);
      setPhase(state.status === 'active' ? 'active' : 'waiting');
    });

    socket.on('player:joined', ({ nickname, role }: { nickname: string; role: string; participantCount: number }) => {
      setParticipants((prev) =>
        prev.some((p) => p.nickname === nickname)
          ? prev
          : [...prev, { nickname, role: role as 'teacher' | 'student', connected: true }],
      );
    });

    socket.on('player:left', ({ nickname }: { nickname: string; role: string; participantCount: number }) => {
      setParticipants((prev) => prev.map((p) => p.nickname === nickname ? { ...p, connected: false } : p));
    });

    socket.on('game:started', ({ board: newBoard }: { board: BoardCard[]; rows: number; cols: number }) => {
      setBoard(newBoard);
      setPhase('active');
    });

    socket.on('card:flipped', ({ cardIndex, content }: { cardIndex: number; content: string; flippedBy: string }) => {
      setBoard((prev) =>
        prev.map((c) => (c.index === cardIndex ? { ...c, state: 'face_up', content } : c)),
      );
    });

    socket.on('card:match', ({ cardIndex1, cardIndex2, pairIndex }: any) => {
      setBoard((prev) =>
        prev.map((c) =>
          c.index === cardIndex1 || c.index === cardIndex2
            ? { ...c, state: 'matched', pairIndex }
            : c,
        ),
      );
      setGameState((prev) => ({ ...prev, matchedPairs: (prev.matchedPairs ?? 0) + 1 }));
    });

    socket.on('cards:flip_back', ({ cardIndex1, cardIndex2 }: { cardIndex1: number; cardIndex2: number }) => {
      setBoard((prev) =>
        prev.map((c) =>
          c.index === cardIndex1 || c.index === cardIndex2
            ? { ...c, state: 'face_down', content: undefined }
            : c,
        ),
      );
    });

    socket.on('settings:updated', ({ flipBackDelay }: { flipBackDelay: number }) => {
      setGameState((prev) => ({ ...prev, flipBackDelay }));
    });

    socket.on('game:completed', (data: { totalPairs: number; totalFlips: number; duration: number }) => {
      setStats(data);
      setPhase('completed');
    });

    socket.on('game:abandoned', () => setPhase('abandoned'));

    return () => {
      disconnect();
    };
  }, [sessionId]);

  const handleCardClick = (cardIndex: number) => {
    socketRef.current?.emit('card:flip', { cardIndex });
  };

  const handleStartGame = () => {
    socketRef.current?.emit('game:start', { sessionId });
  };

  const handleEndGame = () => {
    socketRef.current?.emit('game:abandon', { sessionId });
  };

  const handleDelayChange = (flipBackDelay: number) => {
    socketRef.current?.emit('settings:update', { flipBackDelay });
    setGameState((prev) => ({ ...prev, flipBackDelay }));
  };

  const connectedStudents = participants.filter((p) => p.role === 'student' && p.connected).length;

  if (phase === 'loading') {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (phase === 'waiting') {
    return (
      <Box minHeight="100vh" bgcolor="background.default">
        <Box bgcolor="primary.main" color="white" py={2} px={3}>
          <Typography variant="h6">Waiting Room — {gameState.gameTitle}</Typography>
        </Box>
        <Container maxWidth="sm" sx={{ py: 6 }}>
          <Stack spacing={4} alignItems="center">
            <Paper elevation={3} sx={{ p: 4, width: '100%', textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Join Code
              </Typography>
              <Typography variant="h2" fontWeight={800} letterSpacing={8} color="primary.main">
                {joinCode}
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="center" mt={2}>
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                  {shareableLink}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => { navigator.clipboard.writeText(shareableLink); setCopied(true); }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Paper>

            <Paper elevation={1} sx={{ p: 3, width: '100%' }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Participants ({participants.filter((p) => p.connected).length})
              </Typography>
              <List dense>
                {participants.filter((p) => p.connected).map((p, i) => (
                  <ListItem key={i} disableGutters>
                    <ListItemText
                      primary={p.nickname}
                      secondary={p.role === 'teacher' ? 'Teacher (you)' : 'Student'}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>

            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                size="large"
                onClick={handleStartGame}
                disabled={connectedStudents === 0}
              >
                Start Game
              </Button>
              <Button variant="outlined" color="error" onClick={() => navigate('/dashboard')}>
                Cancel
              </Button>
            </Stack>
            {connectedStudents === 0 && (
              <Typography variant="caption" color="text.secondary">
                Waiting for at least one student to join...
              </Typography>
            )}
          </Stack>
        </Container>
        <Snackbar open={copied} autoHideDuration={2000} onClose={() => setCopied(false)} message="Link copied!" />
      </Box>
    );
  }

  if (phase === 'completed' || phase === 'abandoned') {
    return (
      <Box
        minHeight="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bgcolor="background.default"
      >
        <Container maxWidth="sm">
          <Paper elevation={3} sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              {phase === 'completed' ? '🎉 Game Complete!' : 'Game Ended'}
            </Typography>
            {stats && (
              <Stack spacing={1} my={3}>
                <Typography>Pairs matched: {stats.totalPairs}</Typography>
                <Typography>Total flips: {stats.totalFlips}</Typography>
                <Typography>Time: {Math.round(stats.duration / 1000)}s</Typography>
              </Stack>
            )}
            <Button variant="contained" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  // Active game
  return (
    <Box minHeight="100vh" bgcolor="background.default" display="flex" flexDirection="column">
      <TeacherToolbar
        gameTitle={gameState.gameTitle ?? ''}
        flipBackDelay={gameState.flipBackDelay ?? 3000}
        participantCount={participants.filter((p) => p.connected).length}
        onDelayChange={handleDelayChange}
        onEndGame={handleEndGame}
      />
      <Box
        flex={1}
        display="flex"
        flexDirection={{ xs: 'column', md: 'row' }}
        gap={2}
        p={2}
        alignItems={{ xs: 'center', md: 'flex-start' }}
      >
        <Box flex={1} display="flex" alignItems="center" justifyContent="center">
          <CardGrid
            board={board}
            rows={gameState.rows ?? 4}
            cols={gameState.cols ?? 4}
            onCardClick={handleCardClick}
            disabled={board.filter((c) => c.state === 'face_up').length >= 2}
          />
        </Box>
        <SolvedPile
          matchedPairs={gameState.matchedPairs ?? 0}
          totalPairs={gameState.totalPairs ?? 0}
          showFlipBack={gameState.flipBackDelay === 0 && board.filter((c) => c.state === 'face_up').length >= 2}
          onFlipBack={() => socketRef.current?.emit('cards:flip_back_manual')}
        />
      </Box>
    </Box>
  );
}
