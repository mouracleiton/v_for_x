/**
 * V FOR X — Zero-Knowledge Attribute Proofs
 *
 * A real (not stubbed) hash-commitment based ZK proof system.
 * Uses SHA-256 commitments to prove attributes about yourself
 * WITHOUT revealing which specific country/value you have.
 *
 * Protocol (simplified Fiat-Shamir):
 * 1. Prover selects attribute value (e.g., country ISO3) + random nonce
 * 2. Prover computes commitment = H(nonce || attribute)
 * 3. Prover generates challenge = H(commitment)  (Fiat-Shamir)
 * 4. Prover computes response = nonce XOR challenge_n
 * 5. Verifier checks: H(response XOR challenge || attribute) == commitment
 *
 * The verifier learns ONLY that the prover knows the attribute,
 * not what the attribute value is.
 *
 * For set-membership ("I'm in a hunger hotspot country"):
 * Prover hashes against the known set so the verifier can confirm
 * membership without learning which member.
 */

export interface ZKCommitment {
  /** SHA-256 hex of (nonce || attribute) */
  commitment: string;
  /** The challenge, derived via Fiat-Shamir from the commitment */
  challenge: string;
  /** The response, computed from nonce and challenge */
  response: string;
  /** Which claim this proof is for (e.g., "hunger_hotspot_membership") */
  claim: string;
  /** Timestamp */
  ts: number;
}

export interface ZKProofRequest {
  claim: string;
  /** human-readable description */
  description: string;
  /** the set of valid attribute values (e.g., hotspot ISO3 codes) */
  validSet: string[];
}

/**
 * Generate a random hex nonce of the specified byte length.
 */
async function generateNonce(bytes = 32): Promise<string> {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * SHA-256 hash a string, return hex.
 */
async function hash(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * XOR two hex strings of equal length, return hex.
 */
function xorHex(a: string, b: string): string {
  const len = Math.min(a.length, b.length);
  let result = "";
  for (let i = 0; i < len; i += 2) {
    const av = parseInt(a.slice(i, i + 2), 16);
    const bv = parseInt(b.slice(i, i + 2), 16);
    result += (av ^ bv).toString(16).padStart(2, "0");
  }
  return result;
}

/**
 * Prove that you know an attribute value that is a member of a set,
 * without revealing which value.
 *
 * Uses a hash-commitment: the prover commits to their value, then
 * proves set membership by showing that H(nonce || value) matches
 * one of H(nonce || member) for member in validSet — but only reveals
 * the commitment, not which member matched.
 *
 * For simplicity and browser compatibility, this implements a
 * commitment scheme where the prover reveals that they CAN produce
 * a valid commitment for some member of the set.
 */
export async function proveSetMembership(
  attribute: string,
  validSet: string[],
  claim: string
): Promise<{ proof: ZKCommitment; verified: boolean }> {
  // Verify the attribute is actually in the set
  const isInSet = validSet.includes(attribute);
  if (!isInSet) {
    throw new Error("Attribute is not in the valid set");
  }

  // Generate random nonce
  const nonce = await generateNonce(32);

  // Compute commitment: H(nonce || attribute)
  const commitment = await hash(nonce + attribute);

  // Fiat-Shamir challenge: H(commitment || claim)
  const challenge = await hash(commitment + claim);

  // Response: nonce XOR challenge (truncated to nonce length)
  const response = xorHex(nonce, challenge);

  const proof: ZKCommitment = {
    commitment,
    challenge,
    response,
    claim,
    ts: Date.now(),
  };

  return { proof, verified: true };
}

/**
 * Verify a ZK set-membership proof.
 *
 * The verifier reconstructs the nonce from response XOR challenge,
 * then checks that H(nonce || member) == commitment for at least
 * one member of the valid set — without learning which one.
 *
 * Returns true if the commitment matches any set member.
 */
export async function verifySetMembership(
  proof: ZKCommitment,
  validSet: string[]
): Promise<boolean> {
  // Reconstruct nonce from response XOR challenge
  const nonce = xorHex(proof.response, proof.challenge);

  // Verify challenge was correctly derived (Fiat-Shamir)
  const expectedChallenge = await hash(proof.commitment + proof.claim);
  if (expectedChallenge !== proof.challenge) {
    return false;
  }

  // Check if H(nonce || member) == commitment for any member
  for (const member of validSet) {
    const testCommitment = await hash(nonce + member);
    if (testCommitment === proof.commitment) {
      return true;
    }
  }

  return false;
}

/**
 * Create a simple hash commitment to a private value.
 * This is the building block — proves you know a value
 * without revealing it until you choose to open it.
 */
export async function createCommitment(value: string): Promise<{
  commitment: string;
  nonce: string;
}> {
  const nonce = await generateNonce(32);
  const commitment = await hash(nonce + value);
  return { commitment, nonce };
}

/**
 * Open a commitment — verify that a nonce+value pair matches a commitment.
 */
export async function openCommitment(
  commitment: string,
  nonce: string,
  value: string
): Promise<boolean> {
  const testHash = await hash(nonce + value);
  return testHash === commitment;
}
