import mongoose from 'mongoose';

// One small settings document (_id "poll") for the voting switch.
// voting_open = the admin's "Open voting" switch. It only matters while a winner is current:
// with no current winner, voting is always open (see utils/votingStatus.js).
const pollStateSchema = new mongoose.Schema(
  {
    _id: { type: String },
    voting_open: { type: Boolean, default: false },
  },
  { collection: 'poll_state', timestamps: true }
);

export const PollState = mongoose.model('PollState', pollStateSchema);
