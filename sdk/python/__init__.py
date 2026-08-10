"""
V FOR X — Python SDK package
============================
Open data for 200 countries × ~87 fields. CC0 license. No auth, no rate limits.

Usage
-----
::

    from vforx import VForX

    vfx = VForX()
    print(vfx.get_country("SDN"))

See the module docstring in :mod:`vforx.vforx` for the full API.
"""

from .vforx import VForX, REMOTE_URL, __version__

__all__ = ["VForX", "REMOTE_URL", "__version__"]
