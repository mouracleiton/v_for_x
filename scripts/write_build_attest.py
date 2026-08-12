#!/usr/bin/env python3
"""
V FOR X — Write Build Attestation

Signs a static build with an Ed25519 key and writes BUILD_ATTESTATION.json.
This attestation file allows browsers to verify build authenticity without
any network calls during verification.

Usage:
  python3 scripts/write_build_attest.py [--key KEY_PATH] [--out OUT_DIR]

Requirements:
  - The build must be complete (out/ directory with manifest.json)
  - Private key must exist (default: ~/.vforx/build-private-key.pem)
  - PyNaCl library: pip install pynacl

Security:
  - The private key should NEVER be committed to git
  - Keep the key on a secure, offline machine if possible
  - The public key is embedded in lib/build-attest.ts for verification
"""

import hashlib
import json
import os
import sys
import base64
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

try:
    import nacl.signing
    import nacl.encoding
except ImportError:
    print("✗ PyNaCl required: pip install pynacl", file=sys.stderr)
    sys.exit(1)

# ═══════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════

DEFAULT_KEY_PATH = Path.home() / ".vforx" / "build-private-key.pem"
DEFAULT_OUT_DIR = Path("out")

ATTESTATION_FILE = "BUILD_ATTESTATION.json"
MANIFEST_FILE = "api/v1/manifest.json"
GIT_COMMIT_FILE = ".git-commit-sha"  # Written by CI


# ═══════════════════════════════════════════════════════════════
# Key Management
# ═══════════════════════════════════════════════════════════════

def generate_keypair(key_path: Path = DEFAULT_KEY_PATH) -> nacl.signing.SigningKey:
    """Generate a new Ed25519 keypair and save to disk."""
    if key_path.exists():
        print(f"✗ Key already exists: {key_path}", file=sys.stderr)
        sys.exit(1)

    key_path.parent.mkdir(parents=True, exist_ok=True)

    # Generate keypair
    signing_key = nacl.signing.SigningKey.generate()

    # Save private key (PEM-like format)
    private_key_pem = f"""-----BEGIN ED25519 PRIVATE KEY-----
{base64.b64encode(signing_key.encode()).decode()}
-----END ED25519 PRIVATE KEY-----
"""

    with open(key_path, "w") as f:
        f.write(private_key_pem)
    os.chmod(key_path, 0o600)

    # Print public key for embedding in lib/build-attest.ts
    verify_key = signing_key.verify_key
    print(f"✓ Generated new keypair: {key_path}")
    print(f"✓ Public key (embed in lib/build-attest.ts):")
    print(f"{verify_key.encode(encoder=nacl.encoding.Base64Encoder).decode()}")
    print()
    print("⚠️  BACKUP THIS KEY! If lost, you cannot sign future builds.")
    print("⚠️  NEVER commit this key to git.")

    return signing_key


def load_signing_key(key_path: Path = DEFAULT_KEY_PATH) -> nacl.signing.SigningKey:
    """Load the signing key from disk."""
    if not key_path.exists():
        print(f"✗ Key not found: {key_path}", file=sys.stderr)
        print(f"   Generate one with: python3 {__file__} --generate-key", file=sys.stderr)
        sys.exit(1)

    with open(key_path, "r") as f:
        pem = f.read()

    # Extract base64 key from PEM
    lines = pem.strip().split('\n')
    if len(lines) < 3:
        raise ValueError("Invalid PEM format")

    b64_key = '\n'.join(lines[1:-1])
    key_bytes = base64.b64decode(b64_key)

    return nacl.signing.SigningKey(key_bytes)


# ═══════════════════════════════════════════════════════════════
# Build Information
# ═══════════════════════════════════════════════════════════════

def get_git_commit(project_root: Path) -> str:
    """Get the current git commit SHA."""
    # Try .git-commit-sha file first (written by CI)
    commit_file = project_root / GIT_COMMIT_FILE
    if commit_file.exists():
        with open(commit_file) as f:
            commit = f.read().strip()
        if len(commit) >= 7:
            return commit

    # Fall back to git command
    import subprocess
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=project_root,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        # If git fails, use a placeholder
        return "unknown"


def get_manifest_hash(out_dir: Path) -> str:
    """Get the manifest root hash from the built data."""
    manifest_path = out_dir / MANIFEST_FILE
    if not manifest_path.exists():
        print(f"✗ Manifest not found: {manifest_path}", file=sys.stderr)
        sys.exit(1)

    with open(manifest_path) as f:
        manifest = json.load(f)

    root_hash = manifest.get("root")
    if not root_hash or len(root_hash) != 64:
        print(f"✗ Invalid manifest root hash", file=sys.stderr)
        sys.exit(1)

    return root_hash


# ═══════════════════════════════════════════════════════════════
# Attestation Creation
# ═══════════════════════════════════════════════════════════════

def create_attestation(
    git_commit: str,
    manifest_hash: str,
    signing_key: nacl.signing.SigningKey,
) -> dict:
    """Create and sign a build attestation."""
    timestamp = int(datetime.now(timezone.utc).timestamp())

    # Create build ID (commit + timestamp)
    build_id = f"{git_commit}-{timestamp}"

    # Get verify key
    verify_key = signing_key.verify_key
    public_key_b64 = verify_key.encode(encoder=nacl.encoding.Base64Encoder).decode()

    # Create attestation message (what we sign)
    message_dict = {
        "buildId": build_id,
        "gitCommit": git_commit,
        "timestamp": timestamp,
        "manifestHash": manifest_hash,
        "publicKey": public_key_b64,
        "format": "vfx-build-attestation-1",
    }

    # Canonical serialization (deterministic JSON)
    message_json = json.dumps(message_dict, separators=(",", ":"), sort_keys=True)
    message_bytes = message_json.encode("utf-8")

    # Sign with private key
    signature = signing_key.sign(message_bytes)
    signature_b64 = base64.b64encode(signature.signature).decode("utf-8")

    # Final attestation (includes signature)
    attestation = {
        **message_dict,
        "signature": signature_b64,
    }

    return attestation


def write_attestation(
    attestation: dict,
    out_dir: Path,
) -> Path:
    """Write the attestation to the build output."""
    output_path = out_dir / ATTESTATION_FILE

    with open(output_path, "w") as f:
        json.dump(attestation, f, indent=2, separators=(",", ": "))

    return output_path


# ═══════════════════════════════════════════════════════════════
# Verification
# ═══════════════════════════════════════════════════════════════

def verify_attestation(attestation: dict) -> bool:
    """Verify an attestation signature (for testing)."""
    try:
        # Extract signature
        signature_b64 = attestation.get("signature")
        if not signature_b64:
            return False

        signature_bytes = base64.b64decode(signature_b64)

        # Extract public key
        public_key_b64 = attestation.get("publicKey")
        if not public_key_b64:
            return False

        public_key_bytes = base64.b64decode(public_key_b64)
        verify_key = nacl.signing.VerifyKey(public_key_bytes)

        # Recreate message
        message_dict = {
            "buildId": attestation.get("buildId"),
            "gitCommit": attestation.get("gitCommit"),
            "timestamp": attestation.get("timestamp"),
            "manifestHash": attestation.get("manifestHash"),
            "publicKey": public_key_b64,
            "format": attestation.get("format"),
        }

        message_json = json.dumps(message_dict, separators=(",", ":"), sort_keys=True)
        message_bytes = message_json.encode("utf-8")

        # Verify
        verify_key.verify(message_bytes, signature_bytes)
        return True

    except Exception:
        return False


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Sign V FOR X builds with Ed25519 attestations"
    )
    parser.add_argument(
        "--key",
        type=Path,
        default=DEFAULT_KEY_PATH,
        help="Path to private key file (default: ~/.vforx/build-private-key.pem)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help="Build output directory (default: out/)",
    )
    parser.add_argument(
        "--generate-key",
        action="store_true",
        help="Generate a new keypair and exit",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Only verify existing attestation, don't create new one",
    )

    args = parser.parse_args()

    # Handle key generation
    if args.generate_key:
        generate_keypair(args.key)
        return

    # Check output directory exists
    if not args.out.exists():
        print(f"✗ Output directory not found: {args.out}", file=sys.stderr)
        sys.exit(1)

    project_root = Path(__file__).resolve().parent.parent

    # For verification only
    if args.verify_only:
        attestation_path = args.out / ATTESTATION_FILE
        if not attestation_path.exists():
            print(f"✗ Attestation not found: {attestation_path}", file=sys.stderr)
            sys.exit(1)

        with open(attestation_path) as f:
            attestation = json.load(f)

        if verify_attestation(attestation):
            print("✓ Attestation signature is valid")
            print(f"  Build ID: {attestation.get('buildId')}")
            print(f"  Git commit: {attestation.get('gitCommit')}")
            print(f"  Manifest hash: {attestation.get('manifestHash')}")
        else:
            print("✗ Attestation signature is INVALID", file=sys.stderr)
            sys.exit(1)
        return

    # Load signing key
    signing_key = load_signing_key(args.key)

    # Get build information
    git_commit = get_git_commit(project_root)
    manifest_hash = get_manifest_hash(args.out)

    print(f"Git commit: {git_commit}")
    print(f"Manifest hash: {manifest_hash}")

    # Create attestation
    attestation = create_attestation(git_commit, manifest_hash, signing_key)

    # Write to build output
    output_path = write_attestation(attestation, args.out)

    print(f"✓ Build attestation written: {output_path.relative_to(project_root)}")
    print(f"  Build ID: {attestation['buildId']}")

    # Verify it worked
    if verify_attestation(attestation):
        print("✓ Attestation signature verified")
    else:
        print("✗ Attestation signature failed verification", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
