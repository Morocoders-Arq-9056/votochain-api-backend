export const VOTACHAIN_LEDGER_ABI = [
  'function submitVote(bytes32 proposalId, bytes32 choiceCommitment, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
  'function voteCount(bytes32 proposalId) view returns (uint256)',
  'function getVotes(bytes32 proposalId, uint256 offset, uint256 limit) view returns (tuple[])',
  'function getVote(bytes32 proposalId, address voter) view returns (tuple)',
  'function hasVoted(bytes32 proposalId, address voter) view returns (bool)',
  'function proposals(bytes32 proposalId) view returns (uint8, bool, bool, uint64, uint64, uint256, bytes32)',
  'event VoteSubmitted(bytes32 indexed proposalId, address indexed voter, bytes32 indexed choiceCommitment, bytes32 nonce, uint64 submittedAt)',
] as const;
