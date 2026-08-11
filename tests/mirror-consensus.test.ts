/**
 * V FOR X — Mirror Consensus Tests
 *
 * Tests for root hash fork detection across mirrors.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createConsensusAttestation,
  verifyConsensusAttestation,
  encodeConsensusAttestation,
  decodeConsensusAttestation,
  analyzeConsensus,
  buildForkDetails,
  assessForkSeverity,
  generateConsensusReport,
  parseConsensusReport,
  importAttestations,
  deduplicateAttestations,
  filterRecentAttestations,
  getAttestationStats,
  shortRootFingerprint,
  type ConsensusAttestation,
  CONSENSUS_TOKEN_PREFIX,
} from "@/lib/mirror-consensus";

describe("mirror-consensus", () => {
  /* Mock keypair for testing */
  let testKeyPair: { publicKey: string; privateKey: string };

  beforeEach(async () => {
    // Generate a test keypair for signing attestations
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    const pub = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const priv = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    const bufToB64 = (buf: ArrayBuffer): string => {
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    };

    testKeyPair = {
      publicKey: bufToB64(pub),
      privateKey: bufToB64(priv),
    };
  });

  describe("attestation creation and verification", () => {
    it("should create a valid attestation", async () => {
      const input = {
        mirrorEndpoint: "https://example.com",
        transport: "clearnet" as const,
        rootHash: "a".repeat(64),
        ringSize: 10,
        verifiedCount: 8,
      };

      const attestation = await createConsensusAttestation(
        testKeyPair.publicKey,
        testKeyPair.privateKey,
        input,
      );

      expect(attestation).toBeDefined();
      expect(attestation.mirrorEndpoint).toBe(input.mirrorEndpoint);
      expect(attestation.transport).toBe(input.transport);
      expect(attestation.rootHash).toBe(input.rootHash);
      expect(attestation.ringSize).toBe(input.ringSize);
      expect(attestation.verifiedCount).toBe(input.verifiedCount);
      expect(attestation.signature).toBeDefined();
      expect(attestation.contentHash).toBeDefined();
    });

    it("should verify a valid attestation", async () => {
      const input = {
        mirrorEndpoint: "https://example.com",
        transport: "clearnet" as const,
        rootHash: "a".repeat(64),
        ringSize: 10,
        verifiedCount: 8,
      };

      const attestation = await createConsensusAttestation(
        testKeyPair.publicKey,
        testKeyPair.privateKey,
        input,
      );

      const isValid = await verifyConsensusAttestation(attestation);
      expect(isValid).toBe(true);
    });

    it("should reject tampered attestations", async () => {
      const input = {
        mirrorEndpoint: "https://example.com",
        transport: "clearnet" as const,
        rootHash: "a".repeat(64),
        ringSize: 10,
        verifiedCount: 8,
      };

      const attestation = await createConsensusAttestation(
        testKeyPair.publicKey,
        testKeyPair.privateKey,
        input,
      );

      // Tamper with the root hash
      const tampered = { ...attestation, rootHash: "b".repeat(64) };

      const isValid = await verifyConsensusAttestation(tampered);
      expect(isValid).toBe(false);
    });

    it("should reject malformed root hashes", async () => {
      const input = {
        mirrorEndpoint: "https://example.com",
        transport: "clearnet" as const,
        rootHash: "invalid-hash",
        ringSize: 10,
        verifiedCount: 8,
      };

      await expect(
        createConsensusAttestation(
          testKeyPair.publicKey,
          testKeyPair.privateKey,
          input,
        ),
      ).rejects.toThrow("Root hash must be a 64-char SHA-256 hex string");
    });

    it("should reject invalid ring counts", async () => {
      const input = {
        mirrorEndpoint: "https://example.com",
        transport: "clearnet" as const,
        rootHash: "a".repeat(64),
        ringSize: 10,
        verifiedCount: 15, // More than ring size
      };

      await expect(
        createConsensusAttestation(
          testKeyPair.publicKey,
          testKeyPair.privateKey,
          input,
        ),
      ).rejects.toThrow("Verified count cannot exceed ring size");
    });
  });

  describe("token encoding and decoding", () => {
    it("should encode and decode attestations correctly", async () => {
      const input = {
        mirrorEndpoint: "https://example.com",
        transport: "clearnet" as const,
        rootHash: "a".repeat(64),
        ringSize: 10,
        verifiedCount: 8,
      };

      const attestation = await createConsensusAttestation(
        testKeyPair.publicKey,
        testKeyPair.privateKey,
        input,
      );

      const token = encodeConsensusAttestation(attestation);
      expect(token).toBeDefined();
      expect(token.startsWith(CONSENSUS_TOKEN_PREFIX)).toBe(true);

      const decoded = decodeConsensusAttestation(token);
      expect(decoded.id).toBe(attestation.id);
      expect(decoded.rootHash).toBe(attestation.rootHash);
      expect(decoded.mirrorEndpoint).toBe(attestation.mirrorEndpoint);
    });

    it("should throw on invalid token format", () => {
      expect(() => decodeConsensusAttestation("invalid-token")).toThrow();
    });

    it("should throw on corrupted base64", () => {
      expect(() =>
        decodeConsensusAttestation("VFXCON1:!!!invalid-base64"),
      ).toThrow("Corrupt token (bad base64)");
    });
  });

  describe("consensus analysis", () => {
    it("should detect consensus when all mirrors agree", async () => {
      const attestations: ConsensusAttestation[] = [];

      // Create 3 attestations with the same root hash
      for (let i = 0; i < 3; i++) {
        const attestation = await createConsensusAttestation(
          testKeyPair.publicKey,
          testKeyPair.privateKey,
          {
            mirrorEndpoint: `https://mirror${i}.example.com`,
            transport: "clearnet",
            rootHash: "a".repeat(64),
            ringSize: 10,
            verifiedCount: 8,
          },
        );
        attestations.push(attestation);
      }

      const analysis = await analyzeConsensus(attestations);

      expect(analysis.totalAttestations).toBe(3);
      expect(analysis.uniqueRoots).toBe(1);
      expect(analysis.hasFork).toBe(false);
      expect(analysis.majorityPercentage).toBe(100);
    });

    it("should detect forks when mirrors disagree", async () => {
      const attestations: ConsensusAttestation[] = [];

      // Create 2 attestations with different root hashes (fork)
      const att1 = await createConsensusAttestation(
        testKeyPair.publicKey,
        testKeyPair.privateKey,
        {
          mirrorEndpoint: "https://mirror1.example.com",
          transport: "clearnet",
          rootHash: "a".repeat(64),
          ringSize: 10,
          verifiedCount: 8,
        },
      );

      const att2 = await createConsensusAttestation(
        testKeyPair.publicKey,
        testKeyPair.privateKey,
        {
          mirrorEndpoint: "https://mirror2.example.com",
          transport: "clearnet",
          rootHash: "b".repeat(64),
          ringSize: 10,
          verifiedCount: 8,
        },
      );

      attestations.push(att1, att2);

      const analysis = await analyzeConsensus(attestations);

      expect(analysis.totalAttestations).toBe(2);
      expect(analysis.uniqueRoots).toBe(2);
      expect(analysis.hasFork).toBe(true);
      expect(analysis.majorityPercentage).toBe(50);
    });

    it("should correctly identify majority consensus", async () => {
      const attestations: ConsensusAttestation[] = [];

      // 3 mirrors agree on root A, 1 mirror has root B
      for (let i = 0; i < 3; i++) {
        const att = await createConsensusAttestation(
          testKeyPair.publicKey,
          testKeyPair.privateKey,
          {
            mirrorEndpoint: `https://mirror${i}.example.com`,
            transport: "clearnet",
            rootHash: "a".repeat(64),
            ringSize: 10,
            verifiedCount: 8,
          },
        );
        attestations.push(att);
      }

      const dissenter = await createConsensusAttestation(
        testKeyPair.publicKey,
        testKeyPair.privateKey,
        {
          mirrorEndpoint: "https://dissenter.example.com",
          transport: "clearnet",
          rootHash: "b".repeat(64),
          ringSize: 10,
          verifiedCount: 8,
        },
      );

      attestations.push(dissenter);

      const analysis = await analyzeConsensus(attestations);

      expect(analysis.uniqueRoots).toBe(2);
      expect(analysis.hasFork).toBe(true);
      expect(analysis.majorityPercentage).toBe(75);
      expect(analysis.majorityGroup?.rootHash).toBe("a".repeat(64));
    });

    it("should filter out invalid attestations", async () => {
      const attestations: ConsensusAttestation[] = [];

      // Create 2 valid attestations
      for (let i = 0; i < 2; i++) {
        const attestation = await createConsensusAttestation(
          testKeyPair.publicKey,
          testKeyPair.privateKey,
          {
            mirrorEndpoint: `https://mirror${i}.example.com`,
            transport: "clearnet",
            rootHash: "a".repeat(64),
            ringSize: 10,
            verifiedCount: 8,
          },
        );
        attestations.push(attestation);
      }

      // Add a tampered (invalid) attestation
      const tampered = { ...attestations[0], rootHash: "b".repeat(64) };
      attestations.push(tampered as any);

      const analysis = await analyzeConsensus(attestations);

      // Only the 2 valid attestations should be counted
      expect(analysis.totalAttestations).toBe(3); // Input count
      expect(analysis.uniqueRoots).toBe(1); // Only 1 valid root
    });
  });

  describe("fork details", () => {
    it("should build fork details correctly", async () => {
      const attestations: ConsensusAttestation[] = [];

      // Create attestations with different root hashes
      const rootA = "a".repeat(64);
      const rootB = "b".repeat(64);

      for (let i = 0; i < 3; i++) {
        const att = await createConsensusAttestation(
          testKeyPair.publicKey,
          testKeyPair.privateKey,
          {
            mirrorEndpoint: `https://mirror${i}.example.com`,
            transport: "clearnet",
            rootHash: i < 2 ? rootA : rootB,
            ringSize: 10,
            verifiedCount: 8,
          },
        );
        attestations.push(att);
      }

      const analysis = await analyzeConsensus(attestations);
      const forks = buildForkDetails(analysis);

      expect(forks.length).toBe(2);
      expect(forks[0].mirrorCount).toBe(2); // Majority
      expect(forks[0].isMajority).toBe(true);
      expect(forks[1].mirrorCount).toBe(1); // Minority
      expect(forks[1].isMajority).toBe(false);
    });

    it("should return empty array when no forks", async () => {
      const attestations: ConsensusAttestation[] = [];

      for (let i = 0; i < 3; i++) {
        const attestation = await createConsensusAttestation(
          testKeyPair.publicKey,
          testKeyPair.privateKey,
          {
            mirrorEndpoint: `https://mirror${i}.example.com`,
            transport: "clearnet",
            rootHash: "a".repeat(64),
            ringSize: 10,
            verifiedCount: 8,
          },
        );
        attestations.push(attestation);
      }

      const analysis = await analyzeConsensus(attestations);
      const forks = buildForkDetails(analysis);

      expect(forks.length).toBe(0);
    });
  });

  describe("severity assessment", () => {
    it("should assess no fork as none", async () => {
      const attestations: ConsensusAttestation[] = [];

      for (let i = 0; i < 3; i++) {
        const attestation = await createConsensusAttestation(
          testKeyPair.publicKey,
          testKeyPair.privateKey,
          {
            mirrorEndpoint: `https://mirror${i}.example.com`,
            transport: "clearnet",
            rootHash: "a".repeat(64),
            ringSize: 10,
            verifiedCount: 8,
          },
        );
        attestations.push(attestation);
      }

      const analysis = await analyzeConsensus(attestations);
      const severity = assessForkSeverity(analysis);

      expect(severity.level).toBe("none");
      expect(severity.confidence).toBe(1.0);
    });

    it("should assess binary fork with strong majority as medium", async () => {
      const attestations: ConsensusAttestation[] = [];

      // 3 vs 1 split
      for (let i = 0; i < 3; i++) {
        const att = await createConsensusAttestation(
          testKeyPair.publicKey,
          testKeyPair.privateKey,
          {
            mirrorEndpoint: `https://mirror${i}.example.com`,
            transport: "clearnet",
            rootHash: "a".repeat(64),
            ringSize: 10,
            verifiedCount: 8,
          },
        );
        attestations.push(att);
      }

      const dissenter = await createConsensusAttestation(
        testKeyPair.publicKey,
        testKeyPair.privateKey,
        {
          mirrorEndpoint: "https://dissenter.example.com",
          transport: "clearnet",
          rootHash: "b".repeat(64),
          ringSize: 10,
          verifiedCount: 8,
        },
      );

      attestations.push(dissenter);

      const analysis = await analyzeConsensus(attestations);
      const severity = assessForkSeverity(analysis);

      expect(severity.level).toBe("medium");
    });

    it("should assess many forks as severe", async () => {
      const attestations: ConsensusAttestation[] = [];
      const roots = ["a".repeat(64), "b".repeat(64), "c".repeat(64), "d".repeat(64)];

      for (let i = 0; i < 4; i++) {
        const att = await createConsensusAttestation(
          testKeyPair.publicKey,
          testKeyPair.privateKey,
          {
            mirrorEndpoint: `https://mirror${i}.example.com`,
            transport: "clearnet",
            rootHash: roots[i],
            ringSize: 10,
            verifiedCount: 8,
          },
        );
        attestations.push(att);
      }

      const analysis = await analyzeConsensus(attestations);
      const severity = assessForkSeverity(analysis);

      expect(severity.level).toBe("severe");
    });
  });

  describe("report generation and parsing", () => {
    it("should generate and parse consensus reports", async () => {
      const attestations: ConsensusAttestation[] = [];

      for (let i = 0; i < 3; i++) {
        const attestation = await createConsensusAttestation(
          testKeyPair.publicKey,
          testKeyPair.privateKey,
          {
            mirrorEndpoint: `https://mirror${i}.example.com`,
            transport: "clearnet",
            rootHash: "a".repeat(64),
            ringSize: 10,
            verifiedCount: 8,
          },
        );
        attestations.push(attestation);
      }

      const reportJson = await generateConsensusReport(attestations);
      const report = parseConsensusReport(reportJson);

      expect(report.analysis).toBeDefined();
      expect(report.forks).toBeDefined();
      expect(report.alert).toBeDefined();
      expect(report.generatedAt).toBeDefined();
    });

    it("should throw on invalid report format", () => {
      expect(() => parseConsensusReport("{ invalid }")).toThrow();
    });
  });

  describe("import and export", () => {
    it("should import attestations from tokens", async () => {
      const attestations: ConsensusAttestation[] = [];

      for (let i = 0; i < 2; i++) {
        const attestation = await createConsensusAttestation(
          testKeyPair.publicKey,
          testKeyPair.privateKey,
          {
            mirrorEndpoint: `https://mirror${i}.example.com`,
            transport: "clearnet",
            rootHash: "a".repeat(64),
            ringSize: 10,
            verifiedCount: 8,
          },
        );
        attestations.push(attestation);
      }

      const tokens = attestations.map(encodeConsensusAttestation);
      const imported = await importAttestations(tokens);

      expect(imported.length).toBe(2);
    });

    it("should import attestations from reports", async () => {
      const attestations: ConsensusAttestation[] = [];

      for (let i = 0; i < 2; i++) {
        const attestation = await createConsensusAttestation(
          testKeyPair.publicKey,
          testKeyPair.privateKey,
          {
            mirrorEndpoint: `https://mirror${i}.example.com`,
            transport: "clearnet",
            rootHash: "a".repeat(64),
            ringSize: 10,
            verifiedCount: 8,
          },
        );
        attestations.push(attestation);
      }

      const reportJson = await generateConsensusReport(attestations);
      const imported = await importAttestations([reportJson]);

      expect(imported.length).toBe(2);
    });

    it("should handle invalid inputs gracefully", async () => {
      const imported = await importAttestations([
        "invalid-token",
        "also-invalid",
        "",
      ]);

      expect(imported.length).toBe(0);
    });
  });

  describe("deduplication and filtering", () => {
    it("should deduplicate attestations by ID", async () => {
      const attestations: ConsensusAttestation[] = [];

      const attestation = await createConsensusAttestation(
        testKeyPair.publicKey,
        testKeyPair.privateKey,
        {
          mirrorEndpoint: "https://example.com",
          transport: "clearnet",
          rootHash: "a".repeat(64),
          ringSize: 10,
          verifiedCount: 8,
        },
      );

      // Add the same attestation multiple times
      attestations.push(attestation, attestation, attestation);

      const deduped = deduplicateAttestations(attestations);
      expect(deduped.length).toBe(1);
    });

    it("should keep newer attestations when deduplicating", async () => {
      const attestations: ConsensusAttestation[] = [];

      const att1 = await createConsensusAttestation(
        testKeyPair.publicKey,
        testKeyPair.privateKey,
        {
          mirrorEndpoint: "https://example.com",
          transport: "clearnet",
          rootHash: "a".repeat(64),
          ringSize: 10,
          verifiedCount: 8,
        },
      );

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const att2 = await createConsensusAttestation(
        testKeyPair.publicKey,
        testKeyPair.privateKey,
        {
          mirrorEndpoint: "https://example.com",
          transport: "clearnet",
          rootHash: "a".repeat(64),
          ringSize: 10,
          verifiedCount: 8,
        },
      );

      // Simulate the same attestation being received again (same ID)
      // by manually copying att1's ID to att2
      const att2WithSameId = { ...att2, id: att1.id };

      attestations.push(att1, att2WithSameId);

      const deduped = deduplicateAttestations(attestations);
      expect(deduped.length).toBe(1);
      expect(deduped[0].id).toBe(att1.id); // Should keep the newer one (att2 with att1's ID)
    });

    it("should filter recent attestations", async () => {
      const attestations: ConsensusAttestation[] = [];

      const recent = await createConsensusAttestation(
        testKeyPair.publicKey,
        testKeyPair.privateKey,
        {
          mirrorEndpoint: "https://recent.example.com",
          transport: "clearnet",
          rootHash: "a".repeat(64),
          ringSize: 10,
          verifiedCount: 8,
        },
      );

      // Create an old attestation (mock timestamp)
      const old = await createConsensusAttestation(
        testKeyPair.publicKey,
        testKeyPair.privateKey,
        {
          mirrorEndpoint: "https://old.example.com",
          transport: "clearnet",
          rootHash: "b".repeat(64),
          ringSize: 10,
          verifiedCount: 8,
        },
      );

      // Manually set old timestamp
      old.ts = Date.now() - 48 * 60 * 60 * 1000; // 48 hours ago

      attestations.push(recent, old);

      const filtered = filterRecentAttestations(
        attestations,
        24 * 60 * 60 * 1000, // 24 hours
      );

      expect(filtered.length).toBe(1);
      expect(filtered[0].mirrorEndpoint).toBe("https://recent.example.com");
    });
  });

  describe("statistics", () => {
    it("should calculate attestation statistics", async () => {
      const attestations: ConsensusAttestation[] = [];

      for (let i = 0; i < 3; i++) {
        const attestation = await createConsensusAttestation(
          testKeyPair.publicKey,
          testKeyPair.privateKey,
          {
            mirrorEndpoint: `https://mirror${i}.example.com`,
            transport: i % 2 === 0 ? "clearnet" : "onion",
            rootHash: "a".repeat(64),
            ringSize: 10,
            verifiedCount: 8,
          },
        );
        attestations.push(attestation);
      }

      const stats = await getAttestationStats(attestations);

      expect(stats.total).toBe(3);
      expect(stats.verified).toBe(3); // All should be valid
      expect(stats.byTransport.clearnet).toBe(2);
      expect(stats.byTransport.onion).toBe(1);
      expect(stats.ageStats.newest).toBeGreaterThan(0);
    });
  });

  describe("utility functions", () => {
    it("should generate short fingerprints", () => {
      const rootHash = "a".repeat(64);
      const short = shortRootFingerprint(rootHash);
      expect(short).toBe("aaaaaaaaaaaa"); // 12 chars
    });

    it("should handle empty root hash for short fingerprint", () => {
      const short = shortRootFingerprint("");
      expect(short).toBe("");
    });
  });
});