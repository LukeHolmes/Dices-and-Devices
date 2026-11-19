from __future__ import annotations

HOLDOUT_RIDS = {55, 56, 57, 58, 59}


def parse_rid_spec(spec: str | list[int]) -> list[int]:
    if isinstance(spec, list):
        return sorted({int(x) for x in spec})
    out: set[int] = set()
    for part in str(spec).split(","):
        piece = part.strip()
        if not piece:
            continue
        if "-" in piece:
            a_s, b_s = piece.split("-", 1)
            a, b = int(a_s), int(b_s)
            lo, hi = min(a, b), max(a, b)
            for rid in range(lo, hi + 1):
                out.add(rid)
        else:
            out.add(int(piece))
    return sorted(out)


def assert_rids_allowed(rids: list[int], approval_id: str | None, configured_approval: str) -> None:
    blocked = [r for r in rids if r in HOLDOUT_RIDS]
    if not blocked:
        return
    if approval_id and configured_approval and approval_id == configured_approval:
        return
    raise PermissionError(f"holdout_rid_rejected: {blocked}")