/**
 * V FOR X — Exchange → Relay Transport Bridge
 *
 * Converts matched aid offers/requests from the Exchange engine
 * into QR-burst messages compatible with the Relay format, enabling
 * offline P2P delivery coordination.
 *
 * Flow:
 *   1. Exchange finds matches between offers and requests
 *   2. This module converts each match into a RelayMessage
 *   3. The RelayMessage is encoded as a QR-scannable string
 *   4. Users scan QR codes to exchange delivery details offline
 */

import type { Match, AidPost } from "./exchange";
import {
  encodeMessage,
  createSupplyMessage,
  createAlert,
  type RelayMessage,
} from "./relay";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface MatchBundle {
  /** The original match */
  match: Match;
  /** Encoded relay message for the offer side */
  offerRelay: string;
  /** Encoded relay message for the request side */
  requestRelay: string;
  /** Short match ID for reference */
  matchId: string;
}

/* ═══════════════════════════════════════════════════════════════
   Bridge functions
   ═══════════════════════════════════════════════════════════════ */

/**
 * Convert a single match into a pair of QR-compatible relay messages.
 *
 * The offer side gets a message about what's needed; the request side
 * gets a message about what's available. Both sides can then scan
 * each other's QR codes to coordinate delivery offline.
 */
export function matchToRelay(match: Match): MatchBundle {
  const matchId = `M-${match.offer.id.slice(0, 6)}-${match.request.id.slice(0, 6)}`;

  // Message for the offerer (telling them what's needed)
  const offerMsg = createSupplyMessage(
    match.request.iso3,
    "need",
    `${match.request.resource} (${match.request.quantity})`,
    match.request.urgency >= 4 ? "URGENT" : "standard",
  );
  offerMsg.sender = match.request.handle;

  // Message for the requester (telling them what's available)
  const requestMsg = createSupplyMessage(
    match.offer.iso3,
    "have",
    `${match.offer.resource} (${match.offer.quantity})`,
    match.offer.contactMethod ?? "relay",
  );
  requestMsg.sender = match.offer.handle;

  return {
    match,
    offerRelay: encodeMessage(offerMsg),
    requestRelay: encodeMessage(requestMsg),
    matchId,
  };
}

/**
 * Convert all matches into relay bundles.
 */
export function matchesToRelays(matches: Match[]): MatchBundle[] {
  return matches.map(matchToRelay);
}

/**
 * Create an urgent alert for an unmatched high-urgency request.
 * This message can be relayed through the mesh to find a match.
 */
export function unmatchedToAlert(post: AidPost): string {
  if (post.type !== "request") return "";

  const urgencyText =
    post.urgency >= 5 ? "CRITICAL" : post.urgency >= 4 ? "URGENT" : "needed";

  const alertMsg = createAlert(
    post.iso3,
    `${urgencyText}: ${post.resource} (${post.quantity}) — ${post.handle}`,
    post.urgency >= 4 ? 9 : 5,
  );
  alertMsg.sender = post.handle;

  return encodeMessage(alertMsg);
}

/**
 * Batch-encode multiple posts into a single exportable string.
 * Useful for syncing the full exchange board via QR or file.
 */
export function exportExchangeBatch(posts: AidPost[]): string {
  const messages = posts
    .filter((p) => p.active)
    .map((p) => {
      const msg = createSupplyMessage(
        p.iso3,
        p.type === "offer" ? "have" : "need",
        `${p.resource} (${p.quantity})`,
        p.urgency.toString(),
      );
      msg.sender = p.handle;
      return encodeMessage(msg);
    });

  return messages.join("\n");
}
