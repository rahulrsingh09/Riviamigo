import { CalendarClock, Download } from 'lucide-react';
import { Tooltip } from '@riviamigo/ui/primitives';
import { RELEASES_URL } from '../../lib/releaseCheck';
import type { RivianCredentialRenewalNotice } from '../../lib/rivianCredentialRenewal';

export function CredentialRenewalNotice({
  notice,
  compact = false,
  onClick,
}: {
  notice: RivianCredentialRenewalNotice;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={notice.message}
      aria-label={`${notice.label}. ${notice.message}`}
      className={compact
        ? '-mx-1 flex h-8 w-[calc(100%+0.5rem)] items-center justify-center rounded-lg bg-bg-elevated text-status-warning transition-colors hover:bg-bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
        : 'flex min-h-10 w-full items-center gap-2 rounded-lg bg-bg-elevated px-3 py-2 text-start text-status-warning transition-colors hover:bg-bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'}
    >
      <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!compact ? <span className="min-w-0 text-sm font-medium leading-5">{notice.label}</span> : null}
    </button>
  );
}

/** Only rendered when a newer release exists; otherwise the footer has no update affordance. */
export function GitHubReleasesLink({
  updateAvailable,
  currentVersion,
  latestVersion,
  size = 'desktop',
}: {
  updateAvailable: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  size?: 'desktop' | 'mobile' | 'collapsed';
}) {
  if (!updateAvailable || !latestVersion) return null;
  const dimensions = size === 'mobile'
    ? 'h-12 w-12'
    : size === 'collapsed'
      ? 'h-8 w-6'
      : 'h-8 w-8';
  const tooltip = (
    <span className="flex flex-col gap-1">
      <span className="font-medium text-status-warning">Update available</span>
      <span className="flex items-center justify-between gap-3">
        <span className="text-fg-tertiary">Current</span>
        <span className="font-mono">{currentVersion && currentVersion !== 'unknown' ? currentVersion : 'Unknown'}</span>
      </span>
      <span className="flex items-center justify-between gap-3">
        <span className="text-fg-tertiary">Latest</span>
        <span className="font-mono text-status-warning">{latestVersion}</span>
      </span>
    </span>
  );
  return (
    <Tooltip content={tooltip} align="end">
      <a
        href={RELEASES_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`New release ${latestVersion} available. View GitHub Releases`}
        className={`flex shrink-0 items-center justify-center rounded-lg text-status-warning transition-colors hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${dimensions}`}
      >
        <Download className={`${size === 'desktop' ? 'h-4 w-4' : 'h-5 w-5'} shrink-0`} aria-hidden="true" />
      </a>
    </Tooltip>
  );
}

