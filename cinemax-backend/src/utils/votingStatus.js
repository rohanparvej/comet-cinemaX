import { PollState } from '../models/PollState.js';
import { ScreeningWinner } from '../models/ScreeningWinner.js';

const POLL_ID = 'poll';

// Voting is open when there is no current winner, OR the admin switched "Open voting" on
// (so a new round can run without removing the current winner).
export async function getVotingStatus() {
  const [winner, state] = await Promise.all([
    ScreeningWinner.exists({ is_current: true }),
    PollState.findById(POLL_ID).select('voting_open'),
  ]);
  const hasWinner = Boolean(winner);
  const switchOn = Boolean(state && state.voting_open);
  return { hasWinner, switchOn, open: !hasWinner || switchOn };
}

export function setVotingSwitch(on) {
  return PollState.updateOne({ _id: POLL_ID }, { voting_open: on }, { upsert: true });
}
