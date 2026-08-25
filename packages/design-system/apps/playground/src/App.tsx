import { useState } from 'react';
import {
  Button,
  Input,
  Text,
  Heading,
  Card,
  Badge,
  Stack,
  Divider,
  IconButton,
  Spinner,
} from '@casuya/react';
import { Icon } from '@casuya/icons';
import { ThemeProvider, useTheme } from '@casuya/theme';
import { SkipLink } from '@casuya/a11y';

function AppContent() {
  const [email, setEmail] = useState('');
  const { mode, setMode } = useTheme();

  return (
    <Stack spacing={8}>
      <header>
        <Stack direction="row" align="center" justify="between">
          <Heading level={3}>Casuya Design System</Heading>
          <Stack direction="row" spacing={3} align="center">
            <Button
              size="sm"
              variant={mode === 'light' ? 'primary' : 'ghost'}
              onClick={() => setMode('light')}
            >
              Light
            </Button>
            <Button
              size="sm"
              variant={mode === 'dark' ? 'primary' : 'ghost'}
              onClick={() => setMode('dark')}
            >
              Dark
            </Button>
            <Button
              size="sm"
              variant={mode === 'high-contrast' ? 'primary' : 'ghost'}
              onClick={() => setMode('high-contrast')}
            >
              High Contrast
            </Button>
          </Stack>
        </Stack>
      </header>

      <Divider />

      <section>
        <Heading level={4}>Buttons</Heading>
        <Stack direction="row" spacing={3} align="center">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline">Outline</Button>
          <Button loading>Loading</Button>
          <IconButton label="Settings">
            <Icon name="settings" />
          </IconButton>
        </Stack>
      </section>

      <section>
        <Heading level={4}>Inputs</Heading>
        <Stack spacing={4} style={{ maxWidth: 400 }}>
          <Input
            label="Email"
            type="email"
            placeholder="you@school.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            hint="We'll never share your email"
          />
          <Input
            label="Password"
            type="password"
            placeholder="Enter password"
            error="Password must be at least 8 characters"
          />
          <Input label="Disabled" disabled placeholder="This is disabled" />
        </Stack>
      </section>

      <section>
        <Heading level={4}>Badges</Heading>
        <Stack direction="row" spacing={3} align="center">
          <Badge variant="default">Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="info">Info</Badge>
        </Stack>
      </section>

      <section>
        <Heading level={4}>Cards</Heading>
        <Stack direction="row" spacing={4}>
          <Card variant="elevated" padding="md" style={{ flex: 1 }}>
            <Stack spacing={3}>
              <Heading level={5}>Elevated Card</Heading>
              <Text variant="body2" color="secondary">
                This card has a shadow and border.
              </Text>
            </Stack>
          </Card>
          <Card variant="outlined" padding="md" style={{ flex: 1 }}>
            <Stack spacing={3}>
              <Heading level={5}>Outlined Card</Heading>
              <Text variant="body2" color="secondary">
                This card has only a border.
              </Text>
            </Stack>
          </Card>
          <Card variant="filled" padding="md" style={{ flex: 1 }}>
            <Stack spacing={3}>
              <Heading level={5}>Filled Card</Heading>
              <Text variant="body2" color="secondary">
                This card has a background fill.
              </Text>
            </Stack>
          </Card>
        </Stack>
      </section>

      <section>
        <Heading level={4}>Text Variants</Heading>
        <Stack spacing={2}>
          <Text variant="body1">Body 1 — The quick brown fox jumps over the lazy dog.</Text>
          <Text variant="body2">Body 2 — The quick brown fox jumps over the lazy dog.</Text>
          <Text variant="caption">Caption — The quick brown fox jumps over the lazy dog.</Text>
          <Text variant="overline">Overline — The quick brown fox jumps over the lazy dog.</Text>
          <Text variant="label">Label — The quick brown fox jumps over the lazy dog.</Text>
        </Stack>
      </section>

      <section>
        <Heading level={4}>Icons</Heading>
        <Stack direction="row" spacing={2} wrap>
          <Icon name="search" title="Search" />
          <Icon name="settings" />
          <Icon name="user" />
          <Icon name="menu" />
          <Icon name="edit" />
          <Icon name="trash" />
          <Icon name="download" />
          <Icon name="upload" />
          <Icon name="book" />
          <Icon name="image" />
          <Icon name="video" />
          <Icon name="sun" />
          <Icon name="moon" />
          <Icon name="eye" />
          <Icon name="lock" />
        </Stack>
      </section>

      <section>
        <Heading level={4}>Loading State</Heading>
        <Stack direction="row" spacing={3} align="center">
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
          <Spinner color="primary" />
        </Stack>
      </section>

      <Divider />

      <footer>
        <Text variant="caption" color="tertiary" align="center">
          Casuya Design System v0.1.0 — Built for educational platforms
        </Text>
      </footer>
    </Stack>
  );
}

export function App() {
  return (
    <ThemeProvider defaultMode="light">
      <SkipLink />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem' }}>
        <AppContent />
      </div>
    </ThemeProvider>
  );
}
