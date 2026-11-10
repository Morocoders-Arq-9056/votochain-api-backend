// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title VotoChainLedger
 * @notice Registro inmutable de votos verificados por firma EIP-712. $0 en Amoy.
 */
contract VotoChainLedger {
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId)");
    bytes32 private constant VOTE_TYPEHASH =
        keccak256("Vote(bytes32 proposalId,address voter,bytes32 choiceCommitment,bytes32 nonce)");

    string public constant DOMAIN_NAME = "VotoChain";
    string public constant DOMAIN_VERSION = "1";

    struct VoteRecord {
        bytes32 proposalId;
        address voter;
        bytes32 choiceCommitment;
        bytes32 nonce;
        uint8 choice;
        bytes32 salt;
        bool revealed;
        uint64 submittedAt;
        uint64 revealedAt;
    }

    struct Proposal {
        uint8 choiceCount;
        bool opened;
        bool closed;
        uint64 opensAt;
        uint64 closesAt;
        uint256 count;
        bytes32 merkleRoot;
    }

    address public immutable owner;
    bytes32 public immutable domainSeparator;

    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    mapping(bytes32 => Proposal) public proposals;
    mapping(bytes32 => VoteRecord[]) private records;
    mapping(bytes32 => mapping(address => uint256)) private recordIndex;

    event VoteSubmitted(
        bytes32 indexed proposalId,
        address indexed voter,
        bytes32 indexed choiceCommitment,
        bytes32 nonce,
        uint64 submittedAt
    );
    event ChoiceRevealed(bytes32 indexed proposalId, address indexed voter, uint8 choice);
    event ProposalOpened(bytes32 indexed proposalId, uint8 choiceCount, uint64 opensAt, uint64 closesAt);
    event ProposalClosed(bytes32 indexed proposalId, uint256 count, bytes32 merkleRoot, uint64 closedAt);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ProposalNotOpen();
    error ProposalNotClosed();
    error AlreadyVoted();
    error BadChoice();
    error OutOfWindow();
    error BadSignature();
    error UnknownVote();
    error AlreadyRevealed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes(DOMAIN_VERSION)),
                block.chainid
            )
        );
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function openProposal(
        bytes32 proposalId,
        uint8 choiceCount,
        uint64 opensAt,
        uint64 closesAt
    ) external onlyOwner {
        Proposal storage p = proposals[proposalId];
        p.choiceCount = choiceCount;
        p.opened = true;
        p.closed = false;
        p.opensAt = opensAt;
        p.closesAt = closesAt;
        emit ProposalOpened(proposalId, choiceCount, opensAt, closesAt);
    }

    function closeProposal(bytes32 proposalId, bytes32 merkleRoot) external onlyOwner {
        Proposal storage p = proposals[proposalId];
        p.closed = true;
        p.merkleRoot = merkleRoot;
        emit ProposalClosed(proposalId, p.count, merkleRoot, uint64(block.timestamp));
    }

    function submitVote(
        bytes32 proposalId,
        bytes32 choiceCommitment,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        Proposal storage p = proposals[proposalId];
        if (!p.opened || p.closed) revert ProposalNotOpen();
        if (block.timestamp < p.opensAt || block.timestamp > p.closesAt) revert OutOfWindow();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        bytes32 structHash = keccak256(
            abi.encode(VOTE_TYPEHASH, proposalId, msg.sender, choiceCommitment, nonce)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0) || signer != msg.sender) revert BadSignature();

        hasVoted[proposalId][msg.sender] = true;
        records[proposalId].push(
            VoteRecord({
                proposalId: proposalId,
                voter: msg.sender,
                choiceCommitment: choiceCommitment,
                nonce: nonce,
                choice: 0,
                salt: bytes32(0),
                revealed: false,
                submittedAt: uint64(block.timestamp),
                revealedAt: 0
            })
        );
        recordIndex[proposalId][msg.sender] = records[proposalId].length;
        p.count += 1;

        emit VoteSubmitted(proposalId, msg.sender, choiceCommitment, nonce, uint64(block.timestamp));
    }

    function revealChoice(bytes32 proposalId, uint8 choice, bytes32 salt) external {
        Proposal storage p = proposals[proposalId];
        if (!p.closed) revert ProposalNotClosed();
        if (choice >= p.choiceCount) revert BadChoice();
        uint256 idx = recordIndex[proposalId][msg.sender];
        if (idx == 0) revert UnknownVote();
        VoteRecord storage rec = records[proposalId][idx - 1];
        if (rec.revealed) revert AlreadyRevealed();
        if (keccak256(abi.encodePacked(uint8(choice), salt)) != rec.choiceCommitment) revert BadChoice();
        rec.choice = choice;
        rec.salt = salt;
        rec.revealed = true;
        rec.revealedAt = uint64(block.timestamp);
        emit ChoiceRevealed(proposalId, msg.sender, choice);
    }

    function voteCount(bytes32 proposalId) external view returns (uint256) {
        return proposals[proposalId].count;
    }

    function getVotes(bytes32 proposalId, uint256 offset, uint256 limit)
        external
        view
        returns (VoteRecord[] memory)
    {
        VoteRecord[] storage all = records[proposalId];
        uint256 total = all.length;
        if (offset >= total) return new VoteRecord[](0);
        uint256 size = total - offset;
        if (size > limit) size = limit;
        VoteRecord[] memory out = new VoteRecord[](size);
        for (uint256 i = 0; i < size; i++) {
            out[i] = all[offset + i];
        }
        return out;
    }

    function getVote(bytes32 proposalId, address voter) external view returns (VoteRecord memory) {
        uint256 idx = recordIndex[proposalId][voter];
        if (idx == 0) revert UnknownVote();
        return records[proposalId][idx - 1];
    }
}
